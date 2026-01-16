import { z } from 'zod';

/**
 * Input validation schemas for API endpoints
 * Prevents SQL injection, invalid data, and DoS attacks
 */

// Transaction validation
export const transactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    amount: z.number()
        .positive('Amount must be positive')
        .max(1_000_000_000, 'Amount too large')
        .finite('Amount must be a finite number'),
    currency: z.string()
        .length(3, 'Currency must be 3-letter code (e.g., USD, IDR)')
        .regex(/^[A-Z]{3}$/, 'Currency must be uppercase letters'),
    categoryId: z.string().uuid('Invalid category ID').optional().nullable()
        .or(z.literal('').transform(() => null)), // Allow empty string => null
    description: z.string()
        .max(500, 'Description too long (max 500 characters)')
        .optional()
        .nullable(),
    date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
        .refine(dateStr => {
            const date = new Date(dateStr);
            return !isNaN(date.getTime()) && dateStr === date.toISOString().split('T')[0];
        }, 'Invalid date'),
    receiptId: z.string().uuid().optional().nullable(),
    recurringId: z.string().uuid().optional().nullable(),
});

// Receipt validation
export const receiptSchema = z.object({
    imageBase64: z.string()
        .min(100, 'Image data too small')
        .max(15_000_000, 'Image too large (max ~10MB after base64)') // ~10MB in base64
        .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/, 'Invalid image format'),
    ocrRawText: z.string().max(50000).optional().nullable(),
    ocrMerchant: z.string().max(200).optional().nullable(),
    ocrDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    ocrAmount: z.number().positive().optional().nullable(),
    ocrCurrency: z.string().length(3).optional().nullable(),
    ocrConfidence: z.number().min(0).max(1).optional().nullable(),
    verified: z.boolean().optional().default(false),
});

// Budget validation
export const budgetSchema = z.object({
    categoryId: z.string().uuid('Invalid category ID').optional().nullable() // Optional for universal budgets
        .or(z.literal('').transform(() => null)),
    amount: z.number()
        .positive('Budget amount must be positive')
        .max(1_000_000_000, 'Budget amount too large'),
    currency: z.string().length(3).default('IDR'),
    period: z.enum(['weekly', 'monthly', 'yearly']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Recurring transaction validation
export const recurringTransactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    amount: z.number().positive().max(1_000_000_000),
    currency: z.string().length(3).default('IDR'),
    categoryId: z.string().uuid().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    nextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    isActive: z.boolean().optional().default(true),
});

/**
 * Pagination validation helper
 * Prevents DoS via massive limit values
 */
export function validatePagination(params: {
    limit?: string | null;
    offset?: string | null;
}): { limit: number; offset: number } {
    const limit = Math.min(
        Math.max(1, parseInt(params.limit || '100')),
        1000 // Hard cap at 1000
    );
    const offset = Math.max(0, parseInt(params.offset || '0'));

    return { limit, offset };
}

/**
 * Date range validation helper
 * Ensures valid date range queries
 */
export function validateDateRange(params: {
    startDate?: string | null;
    endDate?: string | null;
}): { startDate?: string; endDate?: string } | null {
    const { startDate, endDate } = params;

    if (!startDate && !endDate) return null;

    // Validate format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
        throw new Error('Invalid startDate format (expected YYYY-MM-DD)');
    }
    if (endDate && !dateRegex.test(endDate)) {
        throw new Error('Invalid endDate format (expected YYYY-MM-DD)');
    }

    // Validate dates are real
    if (startDate && isNaN(new Date(startDate).getTime())) {
        throw new Error('Invalid startDate value');
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
        throw new Error('Invalid endDate value');
    }

    // Validate range
    if (startDate && endDate && startDate > endDate) {
        throw new Error('startDate must be before endDate');
    }

    return { startDate: startDate || undefined, endDate: endDate || undefined };
}

/**
 * Generic validation helper with Zod
 */
export function validateInput<T>(
    schema: z.Schema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string } {
    try {
        const validated = schema.parse(data);
        return { success: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const firstError = error.issues[0];
            return {
                success: false,
                error: `${firstError.path.join('.')}: ${firstError.message}`,
            };
        }
        return { success: false, error: 'Validation failed' };
    }
}
