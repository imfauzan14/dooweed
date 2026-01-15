// Currency utility functions using Frankfurter API (free, no key required)

export interface ExchangeRateResponse {
    base: string;
    date: string;
    rates: Record<string, number>;
}

const FRANKFURTER_API = 'https://api.frankfurter.dev';

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
 * Fetch latest exchange rate from Frankfurter API
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    try {
        const response = await fetch(
            `${FRANKFURTER_API}/latest?from=${from}&to=${to}`
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch exchange rate: ${response.statusText}`);
        }

        const data: ExchangeRateResponse = await response.json();
        return data.rates[to] || 1;
    } catch (error) {
        console.error('Exchange rate fetch failed:', error);
        return 1; // Fallback to 1:1 if API fails
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
 */
export async function convertCurrency(
    amount: number,
    from: string,
    to: string,
    date?: string
): Promise<number> {
    console.log(`[Currency] Fetching rate for ${from} -> ${to} (Date: ${date || 'Latest'})`);
    const rate = date
        ? await getHistoricalRate(from, to, date)
        : await getExchangeRate(from, to);
    console.log(`[Currency] Rate: ${rate}, Converted: ${amount * rate}`);
    return amount * rate;
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
