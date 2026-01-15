'use client';

import { useState, useEffect } from 'react';
import { Download, Calendar, FileBarChart } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/Navigation';
import { MonthlyBarChart, BalanceTrendChart, ExpensePieChart, CategoryLegend } from '@/components/Charts';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface MonthlyData {
    month: string;
    income: number;
    expense: number;
    balance: number;
}

interface CategoryData {
    categoryName: string;
    categoryColor: string;
    categoryIcon: string;
    total: number;
    type: string;
}

export default function ReportsPage() {
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
    const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [months, setMonths] = useState(6);
    const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'expense'>('overview');

    useEffect(() => {
        fetchData();
    }, [months]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [monthlyRes, categoryRes] = await Promise.all([
                fetch(`/api/reports?type=monthly&months=${months}`),
                fetch(`/api/reports?type=category&months=${months}`),
            ]);

            const [monthlyResult, categoryResult] = await Promise.all([
                monthlyRes.json(),
                categoryRes.json(),
            ]);

            setMonthlyData(monthlyResult.data || []);
            setCategoryData(categoryResult.data || []);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = () => {
        window.open(`/api/reports?type=export&months=${months}`, '_blank');
    };

    // Calculate totals
    const totals = monthlyData.reduce(
        (acc, m) => ({
            income: acc.income + m.income,
            expense: acc.expense + m.expense,
        }),
        { income: 0, expense: 0 }
    );

    // Transform category data for pie charts
    const expenseCategories = categoryData
        .filter((c) => c.type === 'expense')
        .map((c) => ({
            name: c.categoryName || 'Uncategorized',
            value: c.total,
            color: c.categoryColor || '#6B7280',
            icon: c.categoryIcon || '📁',
        }));

    const incomeCategories = categoryData
        .filter((c) => c.type === 'income')
        .map((c) => ({
            name: c.categoryName || 'Uncategorized',
            value: c.total,
            color: c.categoryColor || '#6B7280',
            icon: c.categoryIcon || '📁',
        }));

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-48 skeleton rounded-lg" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-80 skeleton rounded-2xl" />
                    <div className="h-80 skeleton rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Reports"
                subtitle="Analyze your financial trends"
                action={
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium"
                    >
                        <Download className="w-5 h-5" />
                        Export CSV
                    </button>
                }
            />

            {/* Period Selector */}
            <div className="flex flex-wrap gap-2">
                {[3, 6, 12].map((m) => (
                    <button
                        key={m}
                        onClick={() => setMonths(m)}
                        className={cn(
                            'px-4 py-2 rounded-lg font-medium transition-colors',
                            months === m
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-800 text-gray-400 hover:text-white'
                        )}
                    >
                        {m} months
                    </button>
                ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-6 glass-card rounded-2xl">
                    <p className="text-sm text-gray-400 mb-1">Total Income</p>
                    <p className="text-2xl font-bold text-green-400">
                        {formatCurrency(totals.income, 'IDR')}
                    </p>
                </div>
                <div className="p-6 glass-card rounded-2xl">
                    <p className="text-sm text-gray-400 mb-1">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-400">
                        {formatCurrency(totals.expense, 'IDR')}
                    </p>
                </div>
                <div className="p-6 glass-card rounded-2xl">
                    <p className="text-sm text-gray-400 mb-1">Net Savings</p>
                    <p
                        className={cn(
                            'text-2xl font-bold',
                            totals.income - totals.expense >= 0 ? 'text-green-400' : 'text-red-400'
                        )}
                    >
                        {formatCurrency(totals.income - totals.expense, 'IDR')}
                    </p>
                </div>
            </div>

            {/* Charts */}
            {monthlyData.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Income vs Expenses */}
                    <div className="p-6 glass-card rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4">Income vs Expenses</h2>
                        <MonthlyBarChart data={monthlyData} />
                    </div>

                    {/* Balance Trend */}
                    <div className="p-6 glass-card rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4">Net Balance Trend</h2>
                        <BalanceTrendChart data={monthlyData} />
                    </div>

                    {/* Expense Breakdown */}
                    <div className="p-6 glass-card rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4">Expense Breakdown</h2>
                        {expenseCategories.length > 0 ? (
                            <>
                                <ExpensePieChart data={expenseCategories} />
                                <CategoryLegend data={expenseCategories} />
                            </>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-gray-500">
                                No expenses in this period
                            </div>
                        )}
                    </div>

                    {/* Income Breakdown */}
                    <div className="p-6 glass-card rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4">Income Breakdown</h2>
                        {incomeCategories.length > 0 ? (
                            <>
                                <ExpensePieChart data={incomeCategories} />
                                <CategoryLegend data={incomeCategories} />
                            </>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-gray-500">
                                No income in this period
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <EmptyState
                    icon={<FileBarChart className="w-8 h-8" />}
                    title="No data yet"
                    description="Start tracking transactions to see your reports"
                />
            )}

            {/* Monthly Table */}
            {monthlyData.length > 0 && (
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-gray-800">
                        <h2 className="text-lg font-semibold text-white">Monthly Breakdown</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-800">
                                    <th className="text-left p-4 text-gray-400 font-medium">Month</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Income</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Expenses</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyData.map((m) => {
                                    const date = new Date(m.month + '-01');
                                    return (
                                        <tr key={m.month} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                            <td className="p-4 text-white">
                                                {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                            </td>
                                            <td className="p-4 text-right text-green-400">
                                                {formatCurrency(m.income, 'IDR')}
                                            </td>
                                            <td className="p-4 text-right text-red-400">
                                                {formatCurrency(m.expense, 'IDR')}
                                            </td>
                                            <td
                                                className={cn(
                                                    'p-4 text-right font-medium',
                                                    m.balance >= 0 ? 'text-green-400' : 'text-red-400'
                                                )}
                                            >
                                                {m.balance >= 0 ? '+' : ''}
                                                {formatCurrency(m.balance, 'IDR')}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
