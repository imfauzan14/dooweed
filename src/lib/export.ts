// CSV Export utility for transactions

import { format } from 'date-fns';
import type { Transaction, Category } from '@/db/schema';

export interface ExportTransaction extends Transaction {
    categoryName?: string;
}

/**
 * Generate CSV content from transactions
 */
export function generateTransactionCSV(
    transactions: ExportTransaction[],
    categories: Category[]
): string {
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    const headers = [
        'Date',
        'Type',
        'Category',
        'Description',
        'Amount',
        'Currency',
        'Amount (Base Currency)',
    ];

    const rows = transactions.map(t => [
        format(new Date(t.date), 'yyyy-MM-dd'),
        t.type,
        categoryMap.get(t.categoryId || '') || 'Uncategorized',
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.amount.toString(),
        t.currency || 'IDR',
        t.amountInBase?.toString() || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return csvContent;
}

/**
 * Trigger download of CSV file
 */
export function downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * Generate monthly summary report
 */
export function generateMonthlySummary(
    transactions: ExportTransaction[],
    categories: Category[],
    year: number,
    month: number
): {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    byCategory: { name: string; type: string; amount: number }[];
} {
    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const filtered = transactions.filter(t => {
        const date = new Date(t.date);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals = new Map<string, number>();

    for (const t of filtered) {
        const amount = t.amountInBase || t.amount;

        if (t.type === 'income') {
            totalIncome += amount;
        } else {
            totalExpense += amount;
        }

        const catId = t.categoryId || 'uncategorized';
        categoryTotals.set(catId, (categoryTotals.get(catId) || 0) + amount);
    }

    const byCategory = Array.from(categoryTotals.entries()).map(([catId, amount]) => {
        const category = categoryMap.get(catId);
        return {
            name: category?.name || 'Uncategorized',
            type: category?.type || 'expense',
            amount,
        };
    });

    return {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        byCategory: byCategory.sort((a, b) => b.amount - a.amount),
    };
}

/**
 * Generate date range filter
 */
export function getDateRangeForPeriod(
    period: 'week' | 'month' | 'quarter' | 'year'
): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;

    switch (period) {
        case 'week':
            start = new Date(end);
            start.setDate(end.getDate() - 7);
            break;
        case 'month':
            start = new Date(end.getFullYear(), end.getMonth(), 1);
            break;
        case 'quarter':
            const quarter = Math.floor(end.getMonth() / 3);
            start = new Date(end.getFullYear(), quarter * 3, 1);
            break;
        case 'year':
            start = new Date(end.getFullYear(), 0, 1);
            break;
    }

    return { start, end };
}
