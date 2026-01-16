import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { exchangeRates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import OpenAI from 'openai';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';

const FRANKFURTER_API = 'https://api.frankfurter.dev';

// GET /api/exchange-rates - Get exchange rate with caching
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from') || 'USD';
        const to = searchParams.get('to') || 'IDR';
        const forceRefresh = searchParams.get('refresh') === 'true';

        if (from === to) {
            return NextResponse.json({ data: { rate: 1, from, to } });
        }

        const today = format(new Date(), 'yyyy-MM-dd');

        // 1. Check existing cache
        const existingCache = await db
            .select()
            .from(exchangeRates)
            .where(
                and(
                    eq(exchangeRates.baseCurrency, from),
                    eq(exchangeRates.targetCurrency, to),
                    eq(exchangeRates.date, today)
                )
            )
            .limit(1);

        const cachedRow = existingCache[0];

        if (!forceRefresh && cachedRow) {
            const cacheAge = differenceInMinutes(new Date(), new Date(cachedRow.fetchedAt!));
            // Use cache if less than 15 minutes old
            if (cacheAge < 15) {
                return NextResponse.json({
                    data: { rate: cachedRow.rate, from, to, cached: true, source: 'cache_fresh' },
                });
            }
        }

        let newRate: number | null = null;
        let source = '';

        // 2. Try Frankfurter API
        try {
            const response = await fetch(`${FRANKFURTER_API}/latest?from=${from}&to=${to}`, {
                signal: AbortSignal.timeout(5000) // 5s timeout
            });

            if (response.ok) {
                const apiData = await response.json();
                newRate = apiData.rates[to];
                source = 'frankfurter';
            }
        } catch (e) {
            console.warn('Frankfurter API failed:', e);
        }

        // 3. If Frankfurter failed, Try LLM (DeepSeek)
        if (!newRate && process.env.DEEPSEEK_API_KEY) {
            try {
                console.log(`[Exchange] Falling back to DeepSeek for ${from}->${to}`);
                const deepseek = new OpenAI({
                    apiKey: process.env.DEEPSEEK_API_KEY,
                    baseURL: 'https://api.deepseek.com/v1',
                });

                const completion = await deepseek.chat.completions.create({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an expert currency exchange rate assistant. Provide the current exchange rate for ${from} to ${to} as of today (${today}). Return JSON: { "rate": <number> }. CRITICAL: Rate must be exact number.`
                        },
                        {
                            role: 'user',
                            content: `1 ${from} = ? ${to}`
                        }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.1,
                    max_tokens: 100,
                });

                const parsed = JSON.parse(completion.choices[0].message.content || '{}');
                const llmRate = parseFloat(parsed.rate);
                if (!isNaN(llmRate) && llmRate > 0) {
                    newRate = llmRate;
                    source = 'llm_deepseek';
                }
            } catch (e) {
                console.error('LLM Fallback failed:', e);
            }
        }

        // 4. Update Cache or Use Stale
        if (newRate) {
            // We have a fresh rate (from API or LLM) -> Save it
            if (cachedRow) {
                await db
                    .update(exchangeRates)
                    .set({ rate: newRate, fetchedAt: new Date().toISOString() })
                    .where(eq(exchangeRates.id, cachedRow.id));
            } else {
                await db.insert(exchangeRates).values({
                    id: uuid(),
                    baseCurrency: from,
                    targetCurrency: to,
                    rate: newRate,
                    date: today,
                    fetchedAt: new Date().toISOString(),
                });
            }
            return NextResponse.json({ data: { rate: newRate, from, to, cached: false, source } });

        } else if (cachedRow) {
            // 5. If everything failed but we have STALE cache, use it
            console.warn('Using stale cache for', from, to);
            return NextResponse.json({
                data: { rate: cachedRow.rate, from, to, cached: true, source: 'cache_stale' },
            });
        }

        // 6. Complete Failure
        return NextResponse.json({
            data: { rate: 1, from, to, error: 'All rate sources failed' },
        });

    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        return NextResponse.json(
            { data: { rate: 1, error: 'Failed to fetch rate' } },
            { status: 200 }
        );
    }
}

// GET all supported currencies
export async function POST() {
    try {
        const response = await fetch(`${FRANKFURTER_API}/currencies`);

        if (!response.ok) {
            throw new Error('Failed to fetch currencies');
        }

        const currencies = await response.json();

        return NextResponse.json({ data: currencies });
    } catch (error) {
        console.error('Error fetching currencies:', error);
        // Return common currencies as fallback
        return NextResponse.json({
            data: {
                IDR: 'Indonesian Rupiah',
                USD: 'United States Dollar',
                EUR: 'Euro',
                GBP: 'British Pound',
                JPY: 'Japanese Yen',
                SGD: 'Singapore Dollar',
                MYR: 'Malaysian Ringgit',
                AUD: 'Australian Dollar',
            },
        });
    }
}
