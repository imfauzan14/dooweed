import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { transactions, receipts, budgets, categories, recurringTransactions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

/**
 * DELETE /api/auth/clear-data
 * Delete all user data (transactions, receipts, budgets, categories)
 * Keeps the user account intact
 */
export async function DELETE(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        // Delete in correct order (respecting foreign keys)
        await db.delete(transactions).where(eq(transactions.userId, user.id));
        await db.delete(receipts).where(eq(receipts.userId, user.id));
        await db.delete(budgets).where(eq(budgets.userId, user.id));
        await db.delete(recurringTransactions).where(eq(recurringTransactions.userId, user.id));
        await db.delete(categories).where(eq(categories.userId, user.id));

        return NextResponse.json({
            success: true,
            message: 'All data cleared successfully. Your account remains active.',
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('[Auth] Clear data error:', error);
        return NextResponse.json(
            { error: 'Failed to clear data' },
            { status: 500 }
        );
    }
}
