import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { transactions, categories } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { convertCurrency } from '@/lib/currency';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || 'default-user';

// GET /api/transactions - List transactions with optional filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const categoryId = searchParams.get('categoryId');
        const type = searchParams.get('type');
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        let query = db
            .select({
                transaction: transactions,
                category: categories,
            })
            .from(transactions)
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .where(eq(transactions.userId, DEFAULT_USER_ID))
            .orderBy(desc(transactions.date))
            .limit(limit)
            .offset(offset);

        const conditions = [eq(transactions.userId, DEFAULT_USER_ID)];

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
            .limit(limit)
            .offset(offset);

        const data = results.map(({ transaction, category }) => ({
            ...transaction,
            category: category || null,
        }));

        return NextResponse.json({ data, count: data.length });
    } catch (error) {
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

        // Validate required fields
        if (!type || !amount || !date) {
            return NextResponse.json(
                { error: 'Missing required fields: type, amount, date' },
                { status: 400 }
            );
        }

        // Convert to base currency (IDR)
        let amountInBase = amount;
        if (currency !== 'IDR') {
            console.log(`[DEBUG] Converting ${amount} ${currency} to IDR on ${date}`);
            try {
                amountInBase = await convertCurrency(amount, currency, 'IDR', date);
                console.log(`[DEBUG] Converted result: ${amountInBase}`);
            } catch (err) {
                console.error(`[DEBUG] Conversion failed:`, err);
            }
        }

        const id = uuid();
        const newTransaction = {
            id,
            userId: DEFAULT_USER_ID,
            type: type as 'income' | 'expense',
            amount: parseFloat(amount),
            currency,
            amountInBase,
            categoryId: categoryId || null,
            description: description || null,
            date,
            receiptId: receiptId || null,
            recurringId: recurringId || null,
        };

        await db.insert(transactions).values(newTransaction);

        return NextResponse.json({ data: newTransaction }, { status: 201 });
    } catch (error) {
        console.error('Error creating transaction:', error);
        return NextResponse.json(
            { error: 'Failed to create transaction' },
            { status: 500 }
        );
    }
}
