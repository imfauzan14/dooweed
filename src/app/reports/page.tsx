'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
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
    const [months, setMonths] = useState<number | 'all'>(6);
    const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'expense'>('overview');
    const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);

    useEffect(() => {
        // Fetch available months for range limits
        fetch('/api/reports?type=available_months')
            .then(res => res.json())
            .then(data => {
                if (data.data) setAvailableMonths(data.data);
            });
    }, []);

    useEffect(() => {
        fetchData();
    }, [months, customRange]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            let query = '';
            if (customRange) {
                query = `startDate=${customRange.start}&endDate=${customRange.end}`;
            } else {
                query = `months=${months}`;
            }

            const [monthlyRes, categoryRes] = await Promise.all([
                fetch(`/api/reports?type=monthly&${query}`),
                fetch(`/api/reports?type=category&${query}`),
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
        let query = '';
        if (customRange) {
            query = `startDate=${customRange.start}&endDate=${customRange.end}`;
        } else {
            query = `months=${months}`;
        }
        window.open(`/api/reports?type=export&${query}`, '_blank');
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
            <div className="flex flex-wrap items-center gap-2">
                {/* Available Months Dropdown */}
                <div className="relative">
                    <select
                        value={customRange ? 'custom' : (months === 0 ? 'all' : months.toString())}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'custom') {
                                setCustomRange({ start: availableMonths[availableMonths.length - 1] + '-01', end: format(new Date(), 'yyyy-MM-dd') });
                                setMonths(0);
                            } else if (val === 'all') {
                                setCustomRange(null);
                                setMonths(0); // 0 represents 'all' internally for now, or use string logic
                            } else {
                                setCustomRange(null);
                                setMonths(parseInt(val));
                            }
                        }}
                        className="appearance-none bg-gray-800 border border-gray-700 text-white pl-4 pr-10 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                        <option value="3">Last 3 Months</option>
                        <option value="6">Last 6 Months</option>
                        <option value="12">Last 12 Months</option>
                        <option value="all">All Time</option>
                        <option value="custom">Custom Range</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400">
                        <Calendar className="w-4 h-4" />
                    </div>
                </div>

                {/* Custom Range Picker */}
                {customRange && (
                    <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-xl border border-gray-700 animate-in slide-in-from-left-2 fade-in">
                        <input
                            type="date"
                            value={customRange.start}
                            min={availableMonths.length > 0 ? availableMonths[availableMonths.length - 1] + '-01' : undefined}
                            max={customRange.end}
                            onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                            className="bg-gray-700 border-none text-white text-sm rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            value={customRange.end}
                            min={customRange.start}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                            className="bg-gray-700 border-none text-white text-sm rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                )}
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
