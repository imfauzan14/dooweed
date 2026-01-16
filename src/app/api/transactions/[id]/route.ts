import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { transactions, receipts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { convertCurrency } from '@/lib/currency';

import { requireAuth } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request);
        const { id } = await params;

        const result = await db
            .select()
            .from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
            .limit(1);

        if (result.length === 0) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        return NextResponse.json({ data: result[0] });
    } catch (error) {
        console.error('Error fetching transaction:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transaction' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request);
        const { id } = await params;
        const body = await request.json();
        const { type, amount, currency, categoryId, description, date, receiptId } = body;

        // Check if transaction exists
        const existing = await db
            .select()
            .from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // Prepare update values
        const updateValues: Partial<typeof transactions.$inferInsert> = {};

        if (type) updateValues.type = type;
        if (amount !== undefined) updateValues.amount = parseFloat(amount);
        if (currency) updateValues.currency = currency;
        if (categoryId !== undefined) updateValues.categoryId = categoryId;
        if (description !== undefined) updateValues.description = description;
        if (date) updateValues.date = date;
        if (receiptId !== undefined) updateValues.receiptId = receiptId;

        // Recalculate base amount if currency or amount changed
        if (amount !== undefined || currency) {
            const finalAmount = amount !== undefined ? parseFloat(amount) : existing[0].amount;
            const finalCurrency = currency || existing[0].currency || 'IDR';
            const finalDate = date || existing[0].date;

            if (finalCurrency !== 'IDR') {
                updateValues.amountInBase = await convertCurrency(
                    finalAmount,
                    finalCurrency,
                    'IDR',
                    finalDate
                );
            } else {
                updateValues.amountInBase = finalAmount;
            }
        }

        await db
            .update(transactions)
            .set(updateValues)
            .where(eq(transactions.id, id));

        const updated = await db
            .select()
            .from(transactions)
            .where(eq(transactions.id, id))
            .limit(1);

        return NextResponse.json({ data: updated[0] });
    } catch (error) {
        console.error('Error updating transaction:', error);
        return NextResponse.json(
            { error: 'Failed to update transaction' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request);
        const { id } = await params;

        // Check if transaction exists
        const existing = await db
            .select()
            .from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        const transaction = existing[0];

        // If transaction has a linked receipt, delete it too
        if (transaction.receiptId) {
            try {
                // Delete the receipt (cascade will handle DB constraint if reverse, but here we do it manual)
                // Actually constraint is ON DELETE CASCADE on transactions.receiptId references receipts.id
                // So deleting receipt deletes transaction. NOT vice versa.
                // So we MUST delete receipt manually if we want cleanup.
                await db.delete(receipts).where(eq(receipts.id, transaction.receiptId));
            } catch (err) {
                console.error('Failed to delete associated receipt:', err);
                // Continue to delete transaction even if receipt delete fails?
                // Yes, better to leave orphan receipt than fail transaction delete?
                // Or maybe the user wants the file gone.
                // Let's log it.
            }
        }

        await db.delete(transactions).where(eq(transactions.id, id));

        return NextResponse.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        return NextResponse.json(
            { error: 'Failed to delete transaction' },
            { status: 500 }
        );
    }
}
