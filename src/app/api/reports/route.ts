import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { transactions, categories, receipts } from '@/db/schema';
import { eq, and, gte, lte, sql, desc, or, isNull } from 'drizzle-orm';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { generateTransactionCSV } from '@/lib/export';

// GET /api/reports - Get dashboard summary data
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'summary';
        const months = parseInt(searchParams.get('months') || '6');
        const monthParam = searchParams.get('month'); // YYYY-MM

        if (type === 'available_months') {
            const result = await db
                .select({
                    month: sql<string>`strftime('%Y-%m', date)`,
                })
                .from(transactions)
                .where(eq(transactions.userId, user.id))
                .groupBy(sql`strftime('%Y-%m', date)`)
                .orderBy(desc(sql`strftime('%Y-%m', date)`));

            return NextResponse.json({ data: result.map(r => r.month) });
        }

        const now = new Date();
        let startDate, endDate;

        if (monthParam) {
            startDate = `${monthParam}-01`;
            // Calculate end date of the month
            const [y, m] = monthParam.split('-').map(Number);
            const nextMonth = new Date(y, m, 0); // Last day of the month
            endDate = format(nextMonth, 'yyyy-MM-dd');
        } else if (searchParams.get('startDate') && searchParams.get('endDate')) {
            startDate = searchParams.get('startDate')!;
            endDate = searchParams.get('endDate')!;
        } else {
            // Default behavior: last N months or 'all'
            if (searchParams.get('months') === 'all') {
                startDate = '2000-01-01'; // Far past
                endDate = format(endOfMonth(now), 'yyyy-MM-dd');
            } else {
                startDate = format(startOfMonth(subMonths(now, months - 1)), 'yyyy-MM-dd');
                endDate = format(endOfMonth(now), 'yyyy-MM-dd');
            }
        }

        if (type === 'recent') {
            const recentTransactions = await db
                .select({
                    id: transactions.id,
                    type: transactions.type,
                    amount: transactions.amount,
                    amountInBase: transactions.amountInBase,
                    currency: transactions.currency,
                    description: transactions.description,
                    date: transactions.date,
                    receiptId: transactions.receiptId,
                    categoryId: transactions.categoryId,
                    categoryName: categories.name,
                    categoryColor: categories.color,
                    categoryIcon: categories.icon,
                })
                .from(transactions)
                .leftJoin(categories, eq(transactions.categoryId, categories.id))
                .leftJoin(receipts, eq(transactions.receiptId, receipts.id))
                .where(
                    and(
                        eq(transactions.userId, user.id),
                        gte(transactions.date, startDate),
                        lte(transactions.date, endDate),
                        // Exclude transactions from unverified receipts
                        or(
                            isNull(transactions.receiptId), // No receipt
                            eq(receipts.verified, true) // Verified receipt
                        )
                    )
                )
                .orderBy(desc(transactions.date), desc(transactions.createdAt))
                .limit(5);

            return NextResponse.json({ data: recentTransactions });
        }

        if (type === 'summary') {
            // Overall summary
            const totals = await db
                .select({
                    type: transactions.type,
                    total: sql<number>`SUM(COALESCE(amount_in_base, amount))`,
                    count: sql<number>`COUNT(*)`,
                })
                .from(transactions)
                .leftJoin(receipts, eq(transactions.receiptId, receipts.id))
                .where(
                    and(
                        eq(transactions.userId, user.id),
                        gte(transactions.date, startDate),
                        lte(transactions.date, endDate),
                        // Exclude unverified receipts
                        or(
                            isNull(transactions.receiptId),
                            eq(receipts.verified, true)
                        )
                    )
                )
                .groupBy(transactions.type);

            const income = totals.find(t => t.type === 'income')?.total || 0;
            const expense = totals.find(t => t.type === 'expense')?.total || 0;
            const incomeCount = totals.find(t => t.type === 'income')?.count || 0;
            const expenseCount = totals.find(t => t.type === 'expense')?.count || 0;

            return NextResponse.json({
                data: {
                    totalIncome: income,
                    totalExpense: expense,
                    balance: income - expense,
                    transactionCount: incomeCount + expenseCount,
                    period: { start: startDate, end: endDate },
                },
            });
        }

        if (type === 'monthly') {
            // Monthly breakdown for charts
            const monthlyData = await db
                .select({
                    month: sql<string>`strftime('%Y-%m', date)`,
                    type: transactions.type,
                    total: sql<number>`SUM(COALESCE(amount_in_base, amount))`,
                })
                .from(transactions)
                .where(
                    and(
                        eq(transactions.userId, user.id),
                        gte(transactions.date, startDate),
                        lte(transactions.date, endDate)
                    )
                )
                .groupBy(sql`strftime('%Y-%m', date)`, transactions.type)
                .orderBy(sql`strftime('%Y-%m', date)`);

            // Transform to chart-friendly format
            const monthMap = new Map<string, { income: number; expense: number }>();

            for (const row of monthlyData) {
                if (!monthMap.has(row.month)) {
                    monthMap.set(row.month, { income: 0, expense: 0 });
                }
                const entry = monthMap.get(row.month)!;
                if (row.type === 'income') {
                    entry.income = row.total;
                } else {
                    entry.expense = row.total;
                }
            }

            const chartData = Array.from(monthMap.entries()).map(([month, data]) => ({
                month,
                income: data.income,
                expense: data.expense,
                balance: data.income - data.expense,
            }));

            return NextResponse.json({ data: chartData });
        }

        if (type === 'category') {
            // Category breakdown
            const categoryData = await db
                .select({
                    categoryId: transactions.categoryId,
                    categoryName: categories.name,
                    categoryColor: categories.color,
                    categoryIcon: categories.icon,
                    type: transactions.type,
                    total: sql<number>`SUM(COALESCE(amount_in_base, amount))`,
                    count: sql<number>`COUNT(*)`,
                })
                .from(transactions)
                .leftJoin(categories, eq(transactions.categoryId, categories.id))
                .leftJoin(receipts, eq(transactions.receiptId, receipts.id))
                .where(
                    and(
                        eq(transactions.userId, user.id),
                        gte(transactions.date, startDate),
                        lte(transactions.date, endDate),
                        or(
                            isNull(transactions.receiptId),
                            eq(receipts.verified, true)
                        )
                    )
                )
                .groupBy(transactions.categoryId, categories.name, categories.color, categories.icon, transactions.type)
                .orderBy(desc(sql`SUM(COALESCE(amount_in_base, amount))`));

            return NextResponse.json({ data: categoryData });
        }

        if (type === 'export') {
            // CSV export
            const allTransactions = await db
                .select()
                .from(transactions)
                .where(
                    and(
                        eq(transactions.userId, user.id),
                        gte(transactions.date, startDate),
                        lte(transactions.date, endDate)
                    )
                )
                .orderBy(desc(transactions.date));

            const allCategories = await db
                .select()
                .from(categories)
                .where(eq(categories.userId, user.id));

            const csv = generateTransactionCSV(allTransactions, allCategories);

            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="transactions-${startDate}-${endDate}.csv"`,
                },
            });
        }

        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error generating report:', error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}
