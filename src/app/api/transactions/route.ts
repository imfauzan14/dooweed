import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { transactions, categories } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { convertCurrency } from '@/lib/currency';
import { transactionSchema, validateInput, validatePagination } from '@/lib/validation';

import { requireAuth } from '@/lib/auth';

// GET /api/transactions - List transactions with optional filters
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const categoryId = searchParams.get('categoryId');
        const type = searchParams.get('type');
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Validate and sanitize pagination
        const { limit: safeLimit, offset: safeOffset } = validatePagination({
            limit: limit.toString(),
            offset: offset.toString()
        });

        // Build query conditions
        const conditions = [eq(transactions.userId, user.id)];

        if (startDate) {
            conditions.push(gte(transactions.date, startDate));
        }
        if (endDate) {
            conditions.push(lte(transactions.date, endDate));
        }
        if (categoryId) {
            conditions.push(eq(transactions.categoryId, categoryId));
        }
        if (type && (type === 'income' || type === 'expense')) {
            conditions.push(eq(transactions.type, type));
        }

        const results = await db
            .select({
                transaction: transactions,
                category: categories,
            })
            .from(transactions)
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .where(and(...conditions))
            .orderBy(desc(transactions.date))
            .limit(safeLimit)
            .offset(safeOffset);

        const data = results.map(({ transaction, category }) => ({
            ...transaction,
            category: category || null,
        }));

        return NextResponse.json({ data, count: data.length });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error fetching transactions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transactions' },
            { status: 500 }
        );
    }
}

// POST /api/transactions - Create a new transaction
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
            date,
            receiptId,
            recurringId,
        } = body;

        // Validate input
        const validation = validateInput(transactionSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        const validData = validation.data;

        // Convert to base currency (IDR)
        let amountInBase = validData.amount;
        if (validData.currency !== 'IDR') {
            console.log(`[DEBUG] Converting ${validData.amount} ${validData.currency} to IDR on ${validData.date}`);
            try {
                amountInBase = await convertCurrency(validData.amount, validData.currency, 'IDR', validData.date);
                console.log(`[DEBUG] Converted result: ${amountInBase}`);
            } catch (err) {
                console.error(`[DEBUG] Conversion failed:`, err);
                // Use fallback or return error
                return NextResponse.json(
                    { error: 'Currency conversion failed. Please try again.' },
                    { status: 503 }
                );
            }
        }

        const id = uuid();
        const newTransaction = {
            id,
            userId: user.id,
            type: validData.type,
            amount: validData.amount,
            currency: validData.currency,
            amountInBase,
            categoryId: validData.categoryId || null,
            description: validData.description || null,
            date: validData.date,
            receiptId: validData.receiptId || null,
            recurringId: validData.recurringId || null,
        };

        await db.insert(transactions).values(newTransaction);

        return NextResponse.json({ data: newTransaction }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error creating transaction:', error);
        return NextResponse.json(
            { error: 'Failed to create transaction' },
            { status: 500 }
        );
    }
}
