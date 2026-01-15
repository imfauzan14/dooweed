import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { exchangeRates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { format, differenceInHours } from 'date-fns';

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

        // Check cache first
        if (!forceRefresh) {
            const cached = await db
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

            if (cached.length > 0) {
                const cacheAge = differenceInHours(new Date(), new Date(cached[0].fetchedAt!));
                // Use cache if less than 6 hours old
                if (cacheAge < 6) {
                    return NextResponse.json({
                        data: { rate: cached[0].rate, from, to, cached: true },
                    });
                }
            }
        }

        // Fetch fresh rate from Frankfurter
        const response = await fetch(`${FRANKFURTER_API}/latest?from=${from}&to=${to}`);

        if (!response.ok) {
            // Return fallback rate if API fails
            return NextResponse.json({
                data: { rate: 1, from, to, error: 'API unavailable' },
            });
        }

        const apiData = await response.json();
        const rate = apiData.rates[to];

        // Update cache
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

        if (existingCache.length > 0) {
            await db
                .update(exchangeRates)
                .set({ rate, fetchedAt: new Date().toISOString() })
                .where(eq(exchangeRates.id, existingCache[0].id));
        } else {
            await db.insert(exchangeRates).values({
                id: uuid(),
                baseCurrency: from,
                targetCurrency: to,
                rate,
                date: today,
            });
        }

        return NextResponse.json({ data: { rate, from, to, cached: false } });
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        return NextResponse.json(
            { data: { rate: 1, error: 'Failed to fetch rate' } },
            { status: 200 } // Return 200 with fallback rate
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
