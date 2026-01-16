// Currency utility functions using Frankfurter API (free, no key required)

export interface ExchangeRateResponse {
    base: string;
    date: string;
    rates: Record<string, number>;
}

const FRANKFURTER_API = 'https://api.frankfurter.dev';
const EXCHANGERATE_API = 'https://api.exchangerate-api.com/v4/latest'; // Free, supports IDR

// Common currencies with their symbols
export const CURRENCIES = {
    IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', decimals: 0 },
    USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
    EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
    GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
    JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0 },
    SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimals: 2 },
    MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', decimals: 2 },
    AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimals: 2 },
    CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimals: 2 },
    KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', decimals: 0 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

/**
 * Fetch latest exchange rate from Frankfurter API with LLM fallback
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    try {
        // Use internal API which handles caching and Frankfurter interaction
        const response = await fetch(
            `/api/exchange-rates?from=${from}&to=${to}`,
            { signal: AbortSignal.timeout(5000) } // 5s timeout
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch exchange rate: ${response.statusText}`);
        }

        const json = await response.json();
        // The API returns { data: { rate: number, ... } }
        return json.data.rate || 1;
    } catch (error) {
        console.error('[Currency] Internal API failed, falling back:', error);

        // Try LLM fallback (client-side backup)
        try {
            const llmRate = await getLLMFallbackRate(from, to);
            console.log(`[Currency] Using LLM fallback rate: ${llmRate}`);
            return llmRate;
        } catch (llmError) {
            console.error('[Currency] LLM fallback failed:', llmError);
            // Last resort: database/hardcoded rates
            const hardcodedRate = await getFallbackRate(from, to);
            console.warn(`[Currency] Using database fallback: ${hardcodedRate}`);
            return hardcodedRate;
        }
    }
}

/**
 * Fetch historical exchange rate for a specific date
 */
export async function getHistoricalRate(
    from: string,
    to: string,
    date: string
): Promise<number> {
    if (from === to) return 1;

    try {
        const response = await fetch(
            `${FRANKFURTER_API}/${date}?from=${from}&to=${to}`
        );

        if (!response.ok) {
            // Fallback to latest if historical not available
            return getExchangeRate(from, to);
        }

        const data: ExchangeRateResponse = await response.json();
        return data.rates[to] || 1;
    } catch {
        return getExchangeRate(from, to);
    }
}

/**
 * Convert amount between currencies
 * Uses Frankfurter API first, falls back to ExchangeRate-API for IDR support
 */
export async function convertCurrency(
    amount: number,
    from: string,
    to: string,
    date?: string
): Promise<number> {
    console.log(`[Currency] Converting ${amount} ${from} -> ${to} (Date: ${date || 'Latest'})`);

    // Check if conversion involves IDR - use ExchangeRate-API since Frankfurter doesn't support it
    if (from === 'IDR' || to === 'IDR') {
        // NOTE: ExchangeRate-API doesn't support historical dates, uses latest rate
        if (date) {
            console.warn('[Currency] Historical rate not available for IDR, using latest rate as approximation');
        }

        try {
            const baseResponse = await fetch(`${EXCHANGERATE_API}/${from}`, {
                signal: AbortSignal.timeout(5000)
            });
            if (!baseResponse.ok) throw new Error('ExchangeRate-API failed');

            const data = await baseResponse.json();
            const rate = data.rates[to];

            if (!rate) throw new Error(`No rate found for ${to}`);

            const converted = amount * rate;
            console.log(`[Currency] ExchangeRate-API: ${from} ${amount} x ${rate} = ${to} ${converted}`);
            return converted;
        } catch (error) {
            console.error('[Currency] ExchangeRate-API failed:', error);

            // Try LLM fallback
            try {
                const llmRate = await getLLMFallbackRate(from, to);
                console.log(`[Currency] Using LLM fallback rate: ${llmRate}`);
                return amount * llmRate;
            } catch (llmError) {
                console.error('[Currency] LLM fallback failed:', llmError);
                // Last resort: database/hardcoded rates
                const fallbackRate = await getFallbackRate(from, to);
                console.warn(`[Currency] Using database fallback: ${fallbackRate}`);
                return amount * fallbackRate;
            }
        }
    }

    // For non-IDR conversions, use Frankfurter (more accurate for EUR/USD etc.)
    const rate = date
        ? await getHistoricalRate(from, to, date)
        : await getExchangeRate(from, to);

    const converted = amount * rate;
    console.log(`[Currency] Frankfurter: ${from} ${amount} x ${rate} = ${to} ${converted}`);
    return converted;
}

/**
 * Fallback exchange rates - fetches from database settings
 * Falls back to compile-time defaults if database unavailable
 */
let cachedRates: Record<string, Record<string, number>> | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

const DEFAULT_RATES: Record<string, Record<string, number>> = {
    'USD': { 'IDR': 16850, 'EUR': 0.93, 'GBP': 0.79, 'SGD': 1.35, 'JPY': 157, 'CNY': 7.25 },
    'EUR': { 'IDR': 18150, 'USD': 1.08, 'GBP': 0.85, 'SGD': 1.46, 'JPY': 169 },
    'GBP': { 'IDR': 21350, 'USD': 1.27, 'EUR': 1.18, 'SGD': 1.72 },
    'SGD': { 'IDR': 12470, 'USD': 0.74, 'EUR': 0.68, 'GBP': 0.58 },
    'JPY': { 'IDR': 107, 'USD': 0.0064, 'EUR': 0.0059 },
    'CNY': { 'IDR': 2325, 'USD': 0.14, 'EUR': 0.13 },
    'IDR': {
        'USD': 1 / 16850,
        'EUR': 1 / 18150,
        'GBP': 1 / 21350,
        'SGD': 1 / 12470,
        'JPY': 1 / 107,
        'CNY': 1 / 2325
    },
};

async function getFallbackRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    // Use cached rates if fresh
    const now = Date.now();
    if (cachedRates !== null && (now - cacheTime) < CACHE_TTL) {
        const rate = lookupRate(cachedRates, from, to);
        if (rate) return rate;
    }

    // Fetch from database settings
    try {
        const response = await fetch('/api/settings?key=currencyFallbackRates');
        if (response.ok) {
            const data = await response.json();
            const fetchedRates: Record<string, Record<string, number>> = data.data.value;
            cachedRates = fetchedRates;
            cacheTime = now;
            const rate = lookupRate(fetchedRates, from, to);
            if (rate) return rate;
        }
    } catch (error) {
        console.error('[Currency] Failed to fetch fallback rates from settings:', error);
    }

    // Use compile-time defaults
    const rate = lookupRate(DEFAULT_RATES, from, to);
    if (rate) return rate;

    console.warn(`[Currency] No fallback rate for ${from} → ${to}, using 1:1`);
    return 1;
}

function lookupRate(rates: Record<string, Record<string, number>>, from: string, to: string): number | null {
    // Direct lookup
    if (rates[from]?.[to]) return rates[from][to];

    // Inverse lookup
    const inverse = rates[to]?.[from];
    if (inverse && inverse !== 0) return 1 / inverse;

    return null;
}

/**
 * Fetch exchange rate from LLM fallback API
 */
async function getLLMFallbackRate(from: string, to: string): Promise<number> {
    const response = await fetch('/api/exchange-rates/fallback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
        signal: AbortSignal.timeout(10000), // 10s timeout for LLM
    });

    if (!response.ok) {
        throw new Error(`LLM fallback API returned ${response.status}`);
    }

    const data = await response.json();
    return data.rate;
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number, currencyCode: string): string {
    const currency = CURRENCIES[currencyCode as CurrencyCode];

    if (!currency) {
        return `${currencyCode} ${amount.toFixed(2)}`;
    }

    const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals,
    }).format(amount);

    // Position symbol based on currency convention
    if (currencyCode === 'IDR') {
        return `${currency.symbol}${formatted}`;
    }

    return `${currency.symbol}${formatted}`;
}

/**
 * Parse currency string to extract amount and currency code
 */
export function parseCurrencyString(str: string): { amount: number; currency: string } | null {
    // Common patterns: "Rp 50.000", "$50.00", "50 USD", "IDR 50000"
    const patterns = [
        // Rp prefix (Indonesian)
        /(?:Rp\.?\s*)([\d.,]+)/i,
        // $ prefix
        /\$\s*([\d.,]+)/,
        // Currency code prefix
        /([A-Z]{3})\s*([\d.,]+)/,
        // Currency code suffix
        /([\d.,]+)\s*([A-Z]{3})/,
    ];

    for (const pattern of patterns) {
        const match = str.match(pattern);
        if (match) {
            if (pattern.source.includes('Rp')) {
                const amount = parseFloat(match[1].replace(/[.,]/g, (m) => m === '.' ? '' : '.'));
                return { amount, currency: 'IDR' };
            }
            if (pattern.source.startsWith('\\$')) {
                const amount = parseFloat(match[1].replace(/,/g, ''));
                return { amount, currency: 'USD' };
            }
            if (match[2] && /[A-Z]{3}/.test(match[1])) {
                const amount = parseFloat(match[2].replace(/,/g, ''));
                return { amount, currency: match[1] };
            }
            if (match[2] && /[A-Z]{3}/.test(match[2])) {
                const amount = parseFloat(match[1].replace(/,/g, ''));
                return { amount, currency: match[2] };
            }
        }
    }

    // Last resort: just try to find a number
    const numMatch = str.match(/([\d.,]+)/);
    if (numMatch) {
        const amount = parseFloat(numMatch[1].replace(/,/g, ''));
        return { amount, currency: 'IDR' }; // Default to IDR
    }

    return null;
}
