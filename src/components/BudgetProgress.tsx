'use client';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface BudgetProgressProps {
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    budgetAmount: number;
    spentAmount: number;
    period: string;
    currency?: string;
}

export function BudgetProgress({
    categoryName,
    categoryIcon,
    categoryColor,
    budgetAmount,
    spentAmount,
    period,
    currency = 'IDR',
}: BudgetProgressProps) {
    const percentUsed = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
    const isOverBudget = spentAmount > budgetAmount;
    const remaining = Math.max(0, budgetAmount - spentAmount);

    let statusColor = 'from-green-500 to-emerald-500';
    let statusBg = 'bg-green-500/10';
    let statusText = 'text-green-400';

    if (percentUsed > 100) {
        statusColor = 'from-red-500 to-pink-500';
        statusBg = 'bg-red-500/10';
        statusText = 'text-red-400';
    } else if (percentUsed > 80) {
        statusColor = 'from-yellow-500 to-orange-500';
        statusBg = 'bg-yellow-500/10';
        statusText = 'text-yellow-400';
    } else if (percentUsed > 60) {
        statusColor = 'from-blue-500 to-cyan-500';
        statusBg = 'bg-blue-500/10';
        statusText = 'text-blue-400';
    }

    return (
        <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                        style={{ backgroundColor: `${categoryColor}20` }}
                    >
                        {categoryIcon}
                    </div>
                    <div>
                        <h3 className="font-medium text-white">{categoryName}</h3>
                        <p className="text-xs text-gray-500 capitalize">{period}</p>
                    </div>
                </div>
                <div className={cn('px-2 py-1 rounded-full text-xs font-medium', statusBg, statusText)}>
                    {isOverBudget ? (
                        <span className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Over budget
                        </span>
                    ) : percentUsed >= 80 ? (
                        <span className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {Math.round(100 - percentUsed)}% left
                        </span>
                    ) : (
                        <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            On track
                        </span>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={cn(
                        'absolute inset-y-0 left-0 bg-gradient-to-r rounded-full transition-all duration-500',
                        statusColor
                    )}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
                {isOverBudget && (
                    <div
                        className="absolute inset-y-0 bg-red-500/50 rounded-full animate-pulse"
                        style={{
                            left: '100%',
                            width: `${Math.min(percentUsed - 100, 50)}%`,
                        }}
                    />
                )}
            </div>

            {/* Stats */}
            <div className="flex justify-between text-sm">
                <div>
                    <span className="text-gray-400">Spent: </span>
                    <span className={cn('font-medium', isOverBudget ? 'text-red-400' : 'text-white')}>
                        {formatCurrency(spentAmount, currency)}
                    </span>
                </div>
                <div>
                    <span className="text-gray-400">Budget: </span>
                    <span className="font-medium text-white">{formatCurrency(budgetAmount, currency)}</span>
                </div>
            </div>

            {/* Remaining */}
            {!isOverBudget && (
                <p className="text-xs text-gray-500">
                    {formatCurrency(remaining, currency)} remaining
                </p>
            )}
            {isOverBudget && (
                <p className="text-xs text-red-400">
                    {formatCurrency(spentAmount - budgetAmount, currency)} over budget
                </p>
            )}
        </div>
    );
}

// Compact version for dashboard
export function BudgetProgressCompact({
    categoryName,
    categoryIcon,
    budgetAmount,
    spentAmount,
    currency = 'IDR',
}: Omit<BudgetProgressProps, 'categoryColor' | 'period'>) {
    const percentUsed = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
    const isOverBudget = spentAmount > budgetAmount;

    let barColor = 'bg-green-500';
    if (percentUsed > 100) barColor = 'bg-red-500';
    else if (percentUsed > 80) barColor = 'bg-yellow-500';
    else if (percentUsed > 60) barColor = 'bg-blue-500';

    return (
        <div className="flex items-center gap-3">
            <span className="text-lg">{categoryIcon}</span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300 truncate">{categoryName}</span>
                    <span className={cn('text-xs', isOverBudget ? 'text-red-400' : 'text-gray-500')}>
                        {Math.round(percentUsed)}%
                    </span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={cn('h-full rounded-full transition-all', barColor)}
                        style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
