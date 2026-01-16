import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { recurringTransactions, transactions, categories } from '@/db/schema';
import { eq, and, lte, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { addDays, addWeeks, addMonths, addYears, format, parseISO, isBefore } from 'date-fns';
import { convertCurrency } from '@/lib/currency';

// GET /api/recurring - List all recurring transactions
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const result = await db
            .select({
                recurring: recurringTransactions,
                category: categories,
            })
            .from(recurringTransactions)
            .leftJoin(categories, eq(recurringTransactions.categoryId, categories.id))
            .where(eq(recurringTransactions.userId, user.id))
            .orderBy(desc(recurringTransactions.createdAt));

        const data = result.map(({ recurring, category }) => ({
            ...recurring,
            category,
        }));

        return NextResponse.json({ data });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error fetching recurring transactions:', error);
        return NextResponse.json({ error: 'Failed to fetch recurring transactions' }, { status: 500 });
    }
}

// POST /api/recurring - Create a new recurring transaction
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const {
            type,
            amount,
            currency = 'IDR',
            categoryId,
            description,
            frequency,
            startDate,
            endDate,
        } = body;

        if (!type || !amount || !frequency) {
            return NextResponse.json(
                { error: 'Missing required fields: type, amount, frequency' },
                { status: 400 }
            );
        }

        const id = uuid();
        const nextDate = startDate || format(new Date(), 'yyyy-MM-dd');

        const newRecurring = {
            id,
            userId: user.id,
            type: type as 'income' | 'expense',
            amount: parseFloat(amount),
            currency,
            categoryId: categoryId || null,
            description: description || null,
            frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
            nextDate,
            endDate: endDate || null,
            isActive: true,
        };

        await db.insert(recurringTransactions).values(newRecurring);

        return NextResponse.json({ data: newRecurring }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error creating recurring transaction:', error);
        return NextResponse.json({ error: 'Failed to create recurring transaction' }, { status: 500 });
    }
}

// PUT /api/recurring - Update a recurring transaction
export async function PUT(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const { id, amount, categoryId, description, frequency, endDate, isActive } = body;

        if (!id) {
            return NextResponse.json({ error: 'Recurring transaction ID is required' }, { status: 400 });
        }

        const existing = await db
            .select()
            .from(recurringTransactions)
            .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, user.id)))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Recurring transaction not found' }, { status: 404 });
        }

        const updateValues: Partial<typeof recurringTransactions.$inferInsert> = {};
        if (amount !== undefined) updateValues.amount = parseFloat(amount);
        if (categoryId !== undefined) updateValues.categoryId = categoryId;
        if (description !== undefined) updateValues.description = description;
        if (frequency) updateValues.frequency = frequency;
        if (endDate !== undefined) updateValues.endDate = endDate;
        if (isActive !== undefined) updateValues.isActive = isActive;

        await db.update(recurringTransactions).set(updateValues).where(eq(recurringTransactions.id, id));

        const updated = await db
            .select()
            .from(recurringTransactions)
            .where(eq(recurringTransactions.id, id))
            .limit(1);

        return NextResponse.json({ data: updated[0] });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error updating recurring transaction:', error);
        return NextResponse.json({ error: 'Failed to update recurring transaction' }, { status: 500 });
    }
}

// DELETE /api/recurring - Delete a recurring transaction
export async function DELETE(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Recurring transaction ID is required' }, { status: 400 });
        }

        const existing = await db
            .select()
            .from(recurringTransactions)
            .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, user.id)))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Recurring transaction not found' }, { status: 404 });
        }

        await db.delete(recurringTransactions).where(eq(recurringTransactions.id, id));

        return NextResponse.json({ message: 'Recurring transaction deleted successfully' });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error deleting recurring transaction:', error);
        return NextResponse.json({ error: 'Failed to delete recurring transaction' }, { status: 500 });
    }
}

// PATCH /api/recurring - Process due recurring transactions
export async function PATCH(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const today = format(new Date(), 'yyyy-MM-dd');

        // Find all active recurring transactions due today or earlier
        const dueRecurring = await db
            .select()
            .from(recurringTransactions)
            .where(
                and(
                    eq(recurringTransactions.userId, user.id),
                    eq(recurringTransactions.isActive, true),
                    lte(recurringTransactions.nextDate, today)
                )
            );

        const createdTransactions: string[] = [];

        for (const recurring of dueRecurring) {
            // Check if end date has passed
            if (recurring.endDate && isBefore(parseISO(recurring.endDate), new Date())) {
                // Deactivate this recurring transaction
                await db
                    .update(recurringTransactions)
                    .set({ isActive: false })
                    .where(eq(recurringTransactions.id, recurring.id));
                continue;
            }

            // Create the transaction
            const transactionId = uuid();
            let amountInBase = recurring.amount;

            if (recurring.currency !== 'IDR') {
                amountInBase = await convertCurrency(recurring.amount, recurring.currency!, 'IDR');
            }

            await db.insert(transactions).values({
                id: transactionId,
                userId: user.id,
                type: recurring.type,
                amount: recurring.amount,
                currency: recurring.currency,
                amountInBase,
                categoryId: recurring.categoryId,
                description: recurring.description,
                date: recurring.nextDate!,
                recurringId: recurring.id,
            });

            createdTransactions.push(transactionId);

            // Calculate next occurrence
            const currentDate = parseISO(recurring.nextDate!);
            let nextDate: Date;

            switch (recurring.frequency) {
                case 'daily':
                    nextDate = addDays(currentDate, 1);
                    break;
                case 'weekly':
                    nextDate = addWeeks(currentDate, 1);
                    break;
                case 'monthly':
                    nextDate = addMonths(currentDate, 1);
                    break;
                case 'yearly':
                    nextDate = addYears(currentDate, 1);
                    break;
                default:
                    nextDate = addMonths(currentDate, 1);
            }

            // Update next date
            await db
                .update(recurringTransactions)
                .set({ nextDate: format(nextDate, 'yyyy-MM-dd') })
                .where(eq(recurringTransactions.id, recurring.id));
        }

        return NextResponse.json({
            message: `Processed ${dueRecurring.length} recurring transactions`,
            createdTransactions,
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error processing recurring transactions:', error);
        return NextResponse.json({ error: 'Failed to process recurring transactions' }, { status: 500 });
    }
}
