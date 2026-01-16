import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '@/db';
import { exchangeRates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { format } from 'date-fns';

/**
 * POST /api/exchange-rates/fallback
 * LLM-powered fallback exchange rate fetcher
 * 
 * Used when primary APIs (ExchangeRate-API, Frankfurter) fail
 * Leverages DeepSeek's knowledge of current exchange rates
 * 
 * Body: { from: string, to: string }
 * Returns: { rate: number, source: 'llm', cached: boolean }
 */
export async function POST(request: NextRequest) {
    try {
        const { from, to } = await request.json();

        if (!from || !to) {
            return NextResponse.json(
                { error: 'from and to currency codes are required' },
                { status: 400 }
            );
        }

        // Validate currency codes (3-letter uppercase)
        if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
            return NextResponse.json(
                { error: 'Invalid currency code format (expected: USD, IDR, etc.)' },
                { status: 400 }
            );
        }

        if (from === to) {
            return NextResponse.json({ rate: 1, source: 'identity', cached: false });
        }

        // Check cache first (1 hour TTL)
        const cacheKey = `${from}_${to}_llm_fallback`;
        const today = format(new Date(), 'yyyy-MM-dd');

        const cached = await db.select()
            .from(exchangeRates)
            .where(and(
                eq(exchangeRates.id, cacheKey),
                eq(exchangeRates.date, today)
            ))
            .limit(1);

        if (cached.length > 0) {
            const fetchedAt = cached[0].fetchedAt;
            if (fetchedAt) {
                const age = Date.now() - new Date(fetchedAt).getTime();
                const ONE_HOUR = 60 * 60 * 1000;

                if (age < ONE_HOUR) {
                    console.log(`[LLM Fallback] Using cached rate (${Math.round(age / 1000)}s old)`);
                    return NextResponse.json({
                        rate: cached[0].rate,
                        source: 'llm',
                        cached: true,
                    });
                }
            }
        }

        // Fetch from LLM
        if (!process.env.DEEPSEEK_API_KEY) {
            console.error('[LLM Fallback] DeepSeek API key not configured');
            return NextResponse.json(
                { error: 'LLM fallback unavailable' },
                { status: 503 }
            );
        }

        console.log(`[LLM Fallback] Fetching ${from} → ${to} rate from DeepSeek...`);

        const deepseek = new OpenAI({
            apiKey: process.env.DEEPSEEK_API_KEY,
            baseURL: 'https://api.deepseek.com/v1',
        });

        const completion = await deepseek.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert currency exchange rate assistant. Provide the current exchange rate for the requested currency pair as of today (January 16, 2026).

Return ONLY a JSON object with this structure:
{
  "rate": <number>,
  "confidence": <0.0-1.0>,
  "note": "<brief explanation>"
}

CRITICAL RULES:
1. Return the CURRENT mid-market exchange rate (not buy/sell)
2. Rate should be accurate to at least 2 decimal places
3. If you're highly confident in the rate (e.g., major currencies like USD/EUR), set confidence to 0.9+
4. If uncertain (e.g., exotic currency pairs), set confidence to 0.5-0.7
5. Always provide the rate even if uncertain - it's better than failing completely`
                },
                {
                    role: 'user',
                    content: `What is the current exchange rate to convert 1 ${from} to ${to}?`
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 200,
        });

        const parsed = JSON.parse(completion.choices[0].message.content || '{}');
        const rate = parseFloat(parsed.rate);

        if (isNaN(rate) || rate <= 0) {
            throw new Error('Invalid rate returned by LLM');
        }

        console.log(`[LLM Fallback] ✅ Got rate: 1 ${from} = ${rate} ${to} (confidence: ${parsed.confidence})`);

        // Cache the result
        await db.insert(exchangeRates).values({
            id: cacheKey,
            baseCurrency: from,
            targetCurrency: to,
            rate,
            date: today,
        }).onConflictDoUpdate({
            target: exchangeRates.id,
            set: {
                rate,
                fetchedAt: new Date().toISOString(),
            },
        });

        return NextResponse.json({
            rate,
            source: 'llm',
            cached: false,
            confidence: parsed.confidence,
            note: parsed.note,
        });

    } catch (error) {
        console.error('[LLM Fallback] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch fallback rate',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
