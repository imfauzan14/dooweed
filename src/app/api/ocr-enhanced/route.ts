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
1. "Total Belanja", "Total Bayar", "Grand Total" = final amount to charge
2. "Total Item", "Total Qty" = quantity count, NOT the price
3. "Kembalian", "Change", "Kembali" = change given, NOT the total
4. "Diskon", "Discount" = discount amount, NOT the total
5. Alfamart, Indomaret, stores, restaurants = EXPENSE
6. "Terima", "Received", "Diterima", salary, refund = INCOME
7. If merchant has logo/brand name, use the brand (e.g., "McDonalds" not "PT McDonald Indonesia")
8. Prefer explicit currency symbols ($, Rp, €) over words
9. Indonesian number format: 79.700 = 79700 (dots are thousands separators)
10. Date formats: "Tgl. 15-01-2026" = "2026-01-15"

If data is ambiguous or missing, set to null. Do not guess.`
                },
                {
                    role: 'user',
                    content: `Receipt OCR Text:\n\n${rawText}\n\nParse this receipt.`
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
            max_tokens: 1000,
        });

        const parsed = JSON.parse(completion.choices[0].message.content || '{}');

        return NextResponse.json({
            success: true,
            data: {
                merchant: parsed.merchant || null,
                date: parsed.date || null,
                amount: parsed.totalAmount ?? null,
                currency: parsed.currency || 'IDR',
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
