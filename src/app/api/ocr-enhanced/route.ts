import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * POST /api/ocr-enhanced
 * Enhanced OCR endpoint using DeepSeek for semantic understanding
 * 
 * Body: { rawText: string }
 * Returns: Structured receipt data
 * 
 * NOTE: Tesseract runs CLIENT-SIDE, this endpoint only does DeepSeek processing
 */
export async function POST(request: NextRequest) {
    try {
        const { rawText } = await request.json();

        if (!rawText) {
            return NextResponse.json(
                { error: 'rawText is required' },
                { status: 400 }
            );
        }

        if (rawText.length < 10) {
            return NextResponse.json(
                { error: 'Raw text too short (min 10 characters)' },
                { status: 400 }
            );
        }

        console.log('[OCR Enhanced API] Processing with DeepSeek...');

        const deepseek = new OpenAI({
            apiKey: process.env.DEEPSEEK_API_KEY || 'placeholder',
            baseURL: 'https://api.deepseek.com/v1',
        });

        const completion = await deepseek.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert receipt parser. Extract structured data from OCR-scanned receipt text.

Return ONLY valid JSON with this exact structure:
{
  "merchant": "store/merchant name (null if not found)",
  "date": "YYYY-MM-DD format (null if not found)",
  "totalAmount": number or null,
  "currency": "IDR" | "USD" | "EUR" | "GBP" | "SGD" | null,
  "transactionType": "income" | "expense",
  "items": [{"name": "string", "price": number, "quantity": number}],
  "confidence": 0.0-1.0
}

CRITICAL RULES:
14. **Merchant Name**:
   - Extract the store or merchant name.
   - If the receipt is a **Bank Transfer** or **Digital Wallet** transaction, format it as **"Platform - Destination"** (e.g., "BCA - Budi Santoso", "GoPay - Bluebird", "OVO - Kopi Kenangan").
   - If unsure, use the most prominent business name. If it's a known franchise (Starbucks, McD, Indomaret, Alfamart), use the clean brand name. If it's a local store, use the full name excluding "PT" or legal suffixes.
2. **LANGUAGE**: Detect if receipt is Indonesian (ID) or English (EN).
   - ID: "Total", "Jumlah", "Kembali" (Change), "Pajak" (Tax).
   - EN: "Total", "Subtotal", "Change", "Tax".
3. **CURRENCY**: 
   - IDR: Look for "Rp", "IDR", or numbers with dot thousands separators (e.g., 50.000).
   - USD/EUR: Look for "$", "€", or numbers with comma separators (e.g., 50,000 for large, or 10.50).
4. **AMOUNTS**:
   - "Total Belanja", "Total Bayar", "Grand Total" = final amount.
   - Do NOT confuse "Total Item" or "Qty" with price.
   - Do NOT use "Kembalian" or "Change" as the total.
5. **TRANSACTION TYPE**:
   - Expense: Buying things, "Total Bayar", "Purchase".
   - Income: "Gaji", "Salary", "Transfer Masuk", "Topup".
6. **FORMATTING**:
   - Date: Convert all to YYYY-MM-DD.
   - Numbers: Return pure numbers (no separators).

If data is ambiguous or missing, set to null. Do not guess.`
                },
                {
                    role: 'user',
                    content: `Receipt OCR Text:\n\n${rawText}\n\nParse this receipt.`
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 1000,
        });

        const parsed = JSON.parse(completion.choices[0].message.content || '{}');

        return NextResponse.json({
            success: true,
            data: {
                merchant: parsed.merchant || null,
                date: parsed.date || null,
                amount: parsed.totalAmount ?? null,
                currency: parsed.currency || null, // Allow null if not detected, don't force IDR
                transactionType: parsed.transactionType || 'expense',
                items: parsed.items || [],
                confidence: parsed.confidence ?? 0.9,
                enhancementUsed: true,
                enhancementSource: 'deepseek',
            },
        });

    } catch (error) {
        console.error('[OCR Enhanced API] Error:', error);

        return NextResponse.json(
            {
                error: 'Failed to process receipt',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
