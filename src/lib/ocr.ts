// Tesseract.js OCR utility for receipt scanning
// Runs entirely client-side, supports English (eng) and Indonesian (ind)

import { createWorker, Worker } from 'tesseract.js';

export interface OCRResult {
    rawText: string;
    merchant: string | null;
    date: string | null;
    amount: number | null;
    currency: string | null;
    confidence: number;
    items: ReceiptItem[];
    transactionType: 'income' | 'expense' | null;
}

export interface ReceiptItem {
    name: string;
    price: number;
    quantity?: number;
}

let worker: Worker | null = null;

/**
 * Initialize Tesseract worker with English and Indonesian support
 */
export async function initOCRWorker(): Promise<Worker> {
    if (worker) return worker;

    worker = await createWorker('eng+ind', 1, {
        logger: (m) => {
            if (m.status === 'recognizing text') {
                console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
        },
    });

    return worker;
}

/**
 * Terminate the OCR worker to free resources
 */
export async function terminateOCRWorker(): Promise<void> {
    if (worker) {
        await worker.terminate();
        worker = null;
    }
}

/**
 * Extract text and structured data from a receipt image
 */
export async function extractReceiptData(imageSource: string | File): Promise<OCRResult> {
    // Preprocess image to handle dark mode receipts (white text on black background)
    // Tesseract works best with black text on white background
    const processedImage = await preprocessImageForOCR(imageSource);

    const w = await initOCRWorker();

    const { data } = await w.recognize(processedImage);
    const rawText = data.text;
    const confidence = data.confidence / 100;

    // Parse the raw text for structured data
    const merchant = extractMerchant(rawText);
    const date = extractDate(rawText);
    const { amount, currency } = extractTotal(rawText);
    const items = extractItems(rawText);
    const transactionType = extractTransactionType(rawText);

    return {
        rawText,
        merchant,
        date,
        amount,
        currency,
        confidence,
        items,
        transactionType,
    };
}

/**
 * Process multiple receipts in batch
 */
export async function batchExtractReceipts(
    images: (string | File)[],
    onProgress?: (current: number, total: number, result?: OCRResult) => void
): Promise<OCRResult[]> {
    const results: OCRResult[] = [];

    for (let i = 0; i < images.length; i++) {
        const result = await extractReceiptData(images[i]);
        results.push(result);
        onProgress?.(i + 1, images.length, result);
    }

    return results;
}

/**
 * Extract transaction type (income or expense) from receipt text
 * Looks for +/- signs and keywords like "uang masuk", "uang keluar", "receive", etc.
 */
function extractTransactionType(text: string): 'income' | 'expense' | null {
    const lowerText = text.toLowerCase();

    // Indonesian keywords
    const incomeKeywordsID = ['uang masuk', 'terima', 'diterima', 'masuk', 'receive'];
    const expenseKeywordsID = ['uang keluar', 'bayar', 'dibayar', 'keluar', 'payment', 'pembelian'];

    // Check for +/- signs before amounts
    // Pattern: +Rp50.000 = income, -Rp400.000 = expense
    const plusPattern = /\+\s*Rp\.?\s*[\d.,]+/i;
    const minusPattern = /-\s*Rp\.?\s*[\d.,]+/i;

    if (plusPattern.test(text) || lowerText.includes('+rp')) {
        return 'income';
    }
    if (minusPattern.test(text) || lowerText.includes('-rp')) {
        return 'expense';
    }

    // Check for keywords
    for (const keyword of incomeKeywordsID) {
        if (lowerText.includes(keyword)) {
            return 'income';
        }
    }
    for (const keyword of expenseKeywordsID) {
        if (lowerText.includes(keyword)) {
            return 'expense';
        }
    }

    // Check for common English patterns
    if (/received|income|credited|deposit/i.test(lowerText)) {
        return 'income';
    }
    if (/paid|payment|purchase|debit|spent|charge/i.test(lowerText)) {
        return 'expense';
    }

    // Default to expense for receipts (most common case)
    return 'expense';
}

/**
 * Extract merchant name from receipt text
 * Usually the first non-empty line or prominent text at top
 */
function extractMerchant(text: string): string | null {
    const lines = text.split('\n').filter(line => line.trim().length > 2);

    // First few lines often contain merchant name
    for (let i = 0; i < Math.min(3, lines.length); i++) {
        const line = lines[i].trim();
        // Skip lines that look like addresses, dates, or numbers
        if (
            !line.match(/^\d+/) &&
            !line.match(/jl\.|jln\.|street|road|ave/i) &&
            !line.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/) &&
            line.length > 3
        ) {
            return line.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
        }
    }

    return lines[0]?.trim() || null;
}

/**
 * Extract date from receipt text
 * Supports multiple formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.
 */
function extractDate(text: string): string | null {
    const datePatterns = [
        // DD/MM/YYYY or DD-MM-YYYY
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
        // YYYY-MM-DD or YYYY/MM/DD
        /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
        // DD MMM YYYY or DD MMMM YYYY
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
        // Indonesian: DD Bulan YYYY
        /(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i,
    ];

    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            // Normalize to YYYY-MM-DD
            if (pattern.source.startsWith('(\\d{4})')) {
                // YYYY-MM-DD format
                return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
            } else if (pattern.source.includes('Jan|Feb')) {
                // English month name
                const monthMap: Record<string, string> = {
                    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
                    january: '01', february: '02', march: '03', april: '04', june: '06',
                    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
                };
                const month = monthMap[match[2].toLowerCase().slice(0, 3)] || '01';
                return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
            } else if (pattern.source.includes('Januari')) {
                // Indonesian month name
                const monthMap: Record<string, string> = {
                    januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
                    juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
                };
                const month = monthMap[match[2].toLowerCase()] || '01';
                return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
            } else {
                // DD/MM/YYYY format
                return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
            }
        }
    }

    return null;
}

/**
 * Extract total amount from receipt text
 * Looks for keywords like TOTAL, SUBTOTAL, GRAND TOTAL
 * Filters out bank account numbers, phone numbers, order IDs
 */
function extractTotal(text: string): { amount: number | null; currency: string | null } {
    const lines = text.split('\n');

    // Keywords that indicate total amount (English and Indonesian)
    const totalKeywords = [
        'grand total', 'total', 'subtotal', 'sub total', 'jumlah', 'bayar',
        'amount due', 'to pay', 'net amount', 'total bayar', 'total harga'
    ];

    // Keywords that indicate NON-price numbers (to exclude)
    const excludeKeywords = [
        'rekening', 'account', 'rek', 'no.', 'nomor', 'telp', 'phone', 'hp', 'wa',
        'order', 'invoice', 'ref', 'trx', 'id', 'npwp', 'nik', 'ktp', 'bca', 'bni',
        'mandiri', 'bri', 'cimb', 'permata', 'danamon', 'bank', 'customer', 'pelanggan'
    ];

    let bestMatch: { amount: number; currency: string } | null = null;
    let bestKeywordIndex = -1;

    for (const line of lines) {
        const lowerLine = line.toLowerCase();

        // Skip lines with exclude keywords (bank accounts, phone numbers, etc.)
        if (excludeKeywords.some(kw => lowerLine.includes(kw))) {
            continue;
        }

        for (let i = 0; i < totalKeywords.length; i++) {
            if (lowerLine.includes(totalKeywords[i])) {
                // Extract amount from this line
                const amountMatch = extractAmountFromLine(line, false);
                if (amountMatch && (bestKeywordIndex === -1 || i < bestKeywordIndex)) {
                    bestMatch = amountMatch;
                    bestKeywordIndex = i;
                }
            }
        }
    }

    if (bestMatch) {
        return { amount: bestMatch.amount, currency: bestMatch.currency };
    }

    // Fallback: find amounts that look like prices (with currency symbols or reasonable range)
    // Only consider amounts between 1,000 and 100,000,000 IDR (reasonable receipt range)
    let bestFallback: { amount: number; currency: string } | null = null;

    for (const line of lines) {
        const lowerLine = line.toLowerCase();

        // Skip lines with exclude keywords
        if (excludeKeywords.some(kw => lowerLine.includes(kw))) {
            continue;
        }

        // Only extract amounts with explicit currency symbols in fallback mode
        const result = extractAmountFromLine(line, true);
        if (result && isReasonablePrice(result.amount, result.currency)) {
            if (!bestFallback || result.amount > bestFallback.amount) {
                bestFallback = result;
            }
        }
    }

    return bestFallback
        ? { amount: bestFallback.amount, currency: bestFallback.currency }
        : { amount: null, currency: null };
}

/**
 * Check if an amount looks like a reasonable receipt price
 * @param amount - The amount to check
 * @param currency - The currency code (affects reasonable range)
 */
function isReasonablePrice(amount: number, currency?: string): boolean {
    // For non-IDR currencies (USD, EUR, etc.), amounts can be small decimals
    if (currency && currency !== 'IDR') {
        // Most purchases are between $0.01 and $50,000
        return amount >= 0.01 && amount <= 50000;
    }

    // For IDR or unknown currency in fallback mode:
    // Bank accounts in Indonesia are typically 10-16 digits (1 billion+)
    // Phone numbers are 10-13 digits (1 billion+)
    // Reasonable receipt totals are usually under 50 million IDR
    // and at least 100 IDR (minimum realistic purchase)
    return amount >= 100 && amount <= 50000000;
}

/**
 * Extract amount from a single line of text
 * @param requireCurrencySymbol - If true, only extract amounts with explicit currency symbols
 */
function extractAmountFromLine(line: string, requireCurrencySymbol: boolean = false): { amount: number; currency: string } | null {
    // USD patterns (check first since it's commonly used)
    // Pattern: $11.97, $ 11.97, USD 11.97, 11.97 USD, -11.97 USD
    const usdPatterns = [
        /[-+]?\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i,           // $11.97
        /[-+]?\s*USD\s*([\d,]+(?:\.\d{1,2})?)/i,          // USD 11.97
        /[-+]?\s*([\d,]+(?:\.\d{1,2})?)\s*USD/i,          // 11.97 USD (suffix)
    ];

    for (const pattern of usdPatterns) {
        const match = line.match(pattern);
        if (match) {
            const amount = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(amount) && amount > 0) {
                return { amount, currency: 'USD' };
            }
        }
    }

    // EUR patterns
    const eurPatterns = [
        /[-+]?\s*€\s*([\d,]+(?:[\.,]\d{1,2})?)/i,         // €11.97
        /[-+]?\s*EUR\s*([\d,]+(?:[\.,]\d{1,2})?)/i,       // EUR 11.97
        /[-+]?\s*([\d,]+(?:[\.,]\d{1,2})?)\s*EUR/i,       // 11.97 EUR (suffix)
    ];

    for (const pattern of eurPatterns) {
        const match = line.match(pattern);
        if (match) {
            // EUR often uses comma as decimal separator
            const amount = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(amount) && amount > 0) {
                return { amount, currency: 'EUR' };
            }
        }
    }

    // GBP patterns
    const gbpPatterns = [
        /[-+]?\s*£\s*([\d,]+(?:\.\d{1,2})?)/i,            // £11.97
        /[-+]?\s*GBP\s*([\d,]+(?:\.\d{1,2})?)/i,          // GBP 11.97
        /[-+]?\s*([\d,]+(?:\.\d{1,2})?)\s*GBP/i,          // 11.97 GBP (suffix)
    ];

    for (const pattern of gbpPatterns) {
        const match = line.match(pattern);
        if (match) {
            const amount = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(amount) && amount > 0) {
                return { amount, currency: 'GBP' };
            }
        }
    }

    // SGD patterns (Singapore Dollar)
    const sgdPatterns = [
        /[-+]?\s*SGD\s*([\d,]+(?:\.\d{1,2})?)/i,          // SGD 11.97
        /[-+]?\s*([\d,]+(?:\.\d{1,2})?)\s*SGD/i,          // 11.97 SGD (suffix)
        /[-+]?\s*S\$\s*([\d,]+(?:\.\d{1,2})?)/i,          // S$11.97
    ];

    for (const pattern of sgdPatterns) {
        const match = line.match(pattern);
        if (match) {
            const amount = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(amount) && amount > 0) {
                return { amount, currency: 'SGD' };
            }
        }
    }

    // Indonesian Rupiah patterns (check last since it's most common for Indonesian users)
    const idrPatterns = [
        /[-+]?\s*Rp\.?\s*([\d.,]+)/i,                     // Rp50.000
        /[-+]?\s*IDR\s*([\d.,]+)/i,                       // IDR 50000
        /[-+]?\s*([\d.,]+)\s*IDR/i,                       // 50000 IDR (suffix)
    ];

    for (const pattern of idrPatterns) {
        const match = line.match(pattern);
        if (match) {
            // Indonesian format: 50.000 = 50000 (dots as thousand separators)
            const amount = parseIndonesianNumber(match[1]);
            if (!isNaN(amount) && amount > 0) {
                return { amount, currency: 'IDR' };
            }
        }
    }

    // If we require currency symbols, stop here
    if (requireCurrencySymbol) {
        return null;
    }

    // Generic number extraction (only when not requiring currency symbol)
    // Be more strict: number should be at the end of the line (like a price column)
    // Look for decimal numbers that look like Western prices (11.97, 1,234.56)
    const priceAtEndPattern = /\s([\d,]+\.\d{2})\s*$/;
    const decimalMatch = line.match(priceAtEndPattern);
    if (decimalMatch) {
        const amount = parseFloat(decimalMatch[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0 && amount < 10000) {
            // Small amounts with decimals likely USD/EUR
            return { amount, currency: 'USD' };
        }
    }

    // Indonesian-style numbers at end of line
    const idrEndPattern = /\s([\d.]+)\s*$/;
    const endMatch = line.match(idrEndPattern);
    if (endMatch) {
        const amount = parseIndonesianNumber(endMatch[1]);
        if (!isNaN(amount) && isReasonablePrice(amount, 'IDR')) {
            return { amount, currency: 'IDR' };
        }
    }

    return null;
}

/**
 * Parse Indonesian number format (dots as thousand separators)
 */
function parseIndonesianNumber(numStr: string): number {
    // Indonesian format: 50.000 = 50000, 1.234.567 = 1234567
    // Count dots vs commas to determine format
    const dots = (numStr.match(/\./g) || []).length;
    const commas = (numStr.match(/,/g) || []).length;

    if (dots > 0 && commas === 0) {
        // Likely Indonesian: 50.000 or 1.234.567
        // Check if it looks like a decimal (single dot with 1-2 digits after)
        if (dots === 1 && /\.\d{1,2}$/.test(numStr)) {
            // Western decimal: 50.00
            return parseFloat(numStr);
        }
        // Indonesian thousand separators
        return parseFloat(numStr.replace(/\./g, ''));
    } else if (commas > 0) {
        // Western format with commas: 1,234,567.89
        return parseFloat(numStr.replace(/,/g, ''));
    }

    // Plain number
    return parseFloat(numStr);
}

/**
 * Extract line items from receipt
 */
function extractItems(text: string): ReceiptItem[] {
    const items: ReceiptItem[] = [];
    const lines = text.split('\n');

    // Pattern: item name followed by price
    const itemPattern = /^(.+?)\s+([\d.,]+)$/;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length < 5) continue;

        // Skip total lines
        if (/total|subtotal|jumlah|tax|pajak|service|diskon|discount/i.test(trimmed)) {
            continue;
        }

        const match = trimmed.match(itemPattern);
        if (match) {
            const name = match[1].trim();
            const priceStr = match[2];
            const price = parseFloat(priceStr.replace(/\./g, '').replace(',', '.'));

            if (!isNaN(price) && price > 0 && name.length > 1) {
                // Check for quantity prefix like "2x" or "2 x"
                const qtyMatch = name.match(/^(\d+)\s*[xX]\s*(.+)/);
                if (qtyMatch) {
                    items.push({
                        name: qtyMatch[2].trim(),
                        price,
                        quantity: parseInt(qtyMatch[1]),
                    });
                } else {
                    items.push({ name, price });
                }
            }
        }
    }

    return items;
}

/**
 * Convert image file to base64 string
 */
export function imageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Compress image before OCR/storage
 */
export async function compressImage(
    file: File,
    maxWidth = 1200,
    quality = 0.8
): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        img.onload = () => {
            let { width, height } = img;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            resolve(canvas.toDataURL('image/jpeg', quality));
        };

        img.src = URL.createObjectURL(file);
    });
}

/**
 * Preprocess image for OCR
 * - Check brightness
 * - Invert if dark background (white text on black)
 * - Increase contrast
 */
async function preprocessImageForOCR(imageSource: string | File): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let totalBrightness = 0;

            // Calculate average brightness
            for (let i = 0; i < data.length; i += 4) {
                totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
            }
            const avgBrightness = totalBrightness / (data.length / 4);

            // If image is dark (avg brightness < 128), invert it
            // This converts "white text on black" to "black text on white"
            if (avgBrightness < 128) {
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i];     // R
                    data[i + 1] = 255 - data[i + 1]; // G
                    data[i + 2] = 255 - data[i + 2]; // B
                    // Leave Alpha (data[i+3]) alone
                }
                ctx.putImageData(imageData, 0, 0);
            }

            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };

        // Handle File or String input
        if (typeof imageSource === 'string') {
            img.src = imageSource;
        } else {
            img.src = URL.createObjectURL(imageSource);
        }
    });
}
