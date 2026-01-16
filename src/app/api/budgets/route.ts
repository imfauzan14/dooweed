import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { budgets, categories, transactions } from '@/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, format } from 'date-fns';

// GET /api/budgets - List all budgets with spending progress
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const allBudgets = await db
            .select({
                budget: budgets,
                category: categories,
            })
            .from(budgets)
            .leftJoin(categories, eq(budgets.categoryId, categories.id))
            .where(eq(budgets.userId, user.id));

        // Calculate current spending for each budget
        const budgetsWithProgress = await Promise.all(
            allBudgets.map(async ({ budget, category }) => {
                const now = new Date();
                let startDate: Date;
                let endDate: Date;

                switch (budget.period) {
                    case 'weekly':
                        startDate = startOfWeek(now, { weekStartsOn: 1 });
                        endDate = endOfWeek(now, { weekStartsOn: 1 });
                        break;
                    case 'monthly':
                        startDate = startOfMonth(now);
                        endDate = endOfMonth(now);
                        break;
                    case 'yearly':
                        startDate = startOfYear(now);
                        endDate = endOfYear(now);
                        break;
                    default:
                        startDate = startOfMonth(now);
                        endDate = endOfMonth(now);
                }

                // Get spending for this budget period
                // Universal budget (no categoryId) = sum ALL expenses
                // Category budget = sum expenses for that category only
                const whereConditions = [
                    eq(transactions.userId, user.id),
                    eq(transactions.type, 'expense'),
                    gte(transactions.date, format(startDate, 'yyyy-MM-dd')),
                    lte(transactions.date, format(endDate, 'yyyy-MM-dd'))
                ];

                // Add category filter only for category budgets
                if (budget.categoryId) {
                    whereConditions.push(eq(transactions.categoryId, budget.categoryId));
                }

                const spending = await db
                    .select({
                        total: sql<number>`SUM(COALESCE(amount_in_base, amount))`,
                    })
                    .from(transactions)
                    .where(and(...whereConditions));

                const spent = spending[0]?.total || 0;
                const remaining = Math.max(0, budget.amount - spent);
                const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

                return {
                    ...budget,
                    category,
                    spent,
                    remaining,
                    percentUsed: Math.round(percentUsed),
                    isOverBudget: spent > budget.amount,
                    periodStart: format(startDate, 'yyyy-MM-dd'),
                    periodEnd: format(endDate, 'yyyy-MM-dd'),
                };
            })
        );

        return NextResponse.json({ data: budgetsWithProgress });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error fetching budgets:', error);
        return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
    }
}

// POST /api/budgets - Create a new budget
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const { categoryId, amount, currency = 'IDR', period } = body;

        if (!amount || !period) {
            return NextResponse.json(
                { error: 'Missing required fields: amount, period' },
                { status: 400 }
            );
        }

        // Get existing budgets to check for conflicts
        const existingBudgets = await db
            .select()
            .from(budgets)
            .where(eq(budgets.userId, user.id));

        // RULE 1: If creating universal budget (no categoryId)
        if (!categoryId) {
            const hasCategoryBudgets = existingBudgets.some(b => b.categoryId !== null);
            if (hasCategoryBudgets) {
                return NextResponse.json({
                    error: 'Cannot create universal budget while category budgets exist. Delete all category budgets first.',
                    existingCategoryBudgets: existingBudgets.filter(b => b.categoryId).length
                }, { status: 400 });
            }
        }

        // RULE 2: If creating category budget
        if (categoryId) {
            const hasUniversalBudget = existingBudgets.some(b => b.categoryId === null);
            if (hasUniversalBudget) {
                return NextResponse.json({
                    error: 'Cannot create category budget while universal budget exists. Delete universal budget first.'
                }, { status: 400 });
            }
        }

        // Check if category exists (only if categoryId provided)
        if (categoryId) {
            const categoryExists = await db
                .select()
                .from(categories)
                .where(and(eq(categories.id, categoryId), eq(categories.userId, user.id)))
                .limit(1);

            if (categoryExists.length === 0) {
                return NextResponse.json({ error: 'Category not found' }, { status: 404 });
            }

            // Check if budget already exists for this category
            const existingBudget = await db
                .select()
                .from(budgets)
                .where(
                    and(
                        eq(budgets.userId, user.id),
                        eq(budgets.categoryId, categoryId),
                        eq(budgets.period, period)
                    )
                )
                .limit(1);

            if (existingBudget.length > 0) {
                return NextResponse.json(
                    { error: 'Budget already exists for this category and period' },
                    { status: 409 }
                );
            }
        }

        // Create the budget (works for both universal and category budgets)
        const id = uuid();
        const newBudget = {
            id,
            userId: user.id,
            categoryId: categoryId || null, // null for universal budget
            amount: parseFloat(amount),
            currency,
            period: period as 'weekly' | 'monthly' | 'yearly',
            startDate: format(new Date(), 'yyyy-MM-dd'),
        };

        await db.insert(budgets).values(newBudget);

        return NextResponse.json({ data: newBudget }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error creating budget:', error);
        return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
    }
}

// PUT /api/budgets - Update a budget
export async function PUT(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const { id, amount, period } = body;

        if (!id) {
            return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 });
        }

        const existing = await db
            .select()
            .from(budgets)
            .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
        }

        const updateValues: Partial<typeof budgets.$inferInsert> = {};
        if (amount !== undefined) updateValues.amount = parseFloat(amount);
        if (period) updateValues.period = period;

        await db.update(budgets).set(updateValues).where(eq(budgets.id, id));

        const updated = await db.select().from(budgets).where(eq(budgets.id, id)).limit(1);

        return NextResponse.json({ data: updated[0] });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error updating budget:', error);
        return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
    }
}

// DELETE /api/budgets - Delete a budget
export async function DELETE(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 });
        }

        const existing = await db
            .select()
            .from(budgets)
            .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
        }

        await db.delete(budgets).where(eq(budgets.id, id));

        return NextResponse.json({ message: 'Budget deleted successfully' });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error deleting budget:', error);
        return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
    }
}
