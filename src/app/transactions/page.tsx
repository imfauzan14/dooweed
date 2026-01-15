'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
    Plus,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Trash2,
    Edit2,
    Download,
} from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/Navigation';
import { TransactionModal } from '@/components/TransactionForm';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface Transaction {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    amountInBase: number | null;
    currency: string | null;
    description: string | null;
    date: string;
    category: {
        id: string;
        name: string;
        icon: string;
        color: string;
    } | null;
}

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [transactionsRes, categoriesRes] = await Promise.all([
                fetch('/api/transactions?limit=200'),
                fetch('/api/categories'),
            ]);

            const [transactionsData, categoriesData] = await Promise.all([
                transactionsRes.json(),
                categoriesRes.json(),
            ]);

            setTransactions(transactionsData.data || []);
            setCategories(categoriesData.data || []);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (data: any) => {
        try {
            const url = editingTransaction
                ? `/api/transactions/${editingTransaction.id}`
                : '/api/transactions';
            const method = editingTransaction ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                setShowModal(false);
                setEditingTransaction(null);
                fetchData();
            }
        } catch (error) {
            console.error('Failed to save transaction:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this transaction?')) return;

        try {
            const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
            if (response.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Failed to delete transaction:', error);
        }
    };

    const handleExport = async () => {
        window.open('/api/reports?type=export&months=12', '_blank');
    };

    // Filter transactions
    const filteredTransactions = transactions.filter((t) => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterCategory && t.category?.id !== filterCategory) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesDescription = t.description?.toLowerCase().includes(query);
            const matchesCategory = t.category?.name.toLowerCase().includes(query);
            if (!matchesDescription && !matchesCategory) return false;
        }
        if (dateRange.start && t.date < dateRange.start) return false;
        if (dateRange.end && t.date > dateRange.end) return false;
        return true;
    });

    // Group by date
    const groupedTransactions = filteredTransactions.reduce((groups, t) => {
        const date = t.date;
        if (!groups[date]) groups[date] = [];
        groups[date].push(t);
        return groups;
    }, {} as Record<string, Transaction[]>);

    const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-48 skeleton rounded-lg" />
                <div className="h-16 skeleton rounded-xl" />
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-20 skeleton rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Transactions"
                subtitle={`${filteredTransactions.length} transactions`}
                action={
                    <div className="flex gap-2">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-700 rounded-xl text-gray-300 hover:bg-gray-800 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                        <button
                            onClick={() => {
                                setEditingTransaction(null);
                                setShowModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium"
                        >
                            <Plus className="w-5 h-5" />
                            Add
                        </button>
                    </div>
                }
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 glass-card rounded-xl">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search transactions..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Type filter */}
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                </select>

                {/* Category filter */}
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Transaction List */}
            {sortedDates.length > 0 ? (
                <div className="space-y-6">
                    {sortedDates.map((date) => {
                        const dayTransactions = groupedTransactions[date];
                        const dayTotal = dayTransactions.reduce((sum, t) => {
                            const amount = t.amountInBase || t.amount;
                            return t.type === 'income' ? sum + amount : sum - amount;
                        }, 0);

                        return (
                            <div key={date} className="space-y-3">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-sm font-medium text-gray-400">
                                        {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                                    </h3>
                                    <span
                                        className={cn(
                                            'text-sm font-medium',
                                            dayTotal >= 0 ? 'text-green-400' : 'text-red-400'
                                        )}
                                    >
                                        {dayTotal >= 0 ? '+' : ''}
                                        {formatCurrency(dayTotal, 'IDR')}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {dayTransactions.map((t) => (
                                        <div
                                            key={t.id}
                                            className="flex items-center gap-4 p-4 glass-card rounded-xl card-lift"
                                        >
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                                                style={{ backgroundColor: `${t.category?.color || '#6B7280'}20` }}
                                            >
                                                {t.category?.icon || '📁'}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-white truncate">
                                                    {t.description || t.category?.name || 'Transaction'}
                                                </p>
                                                <p className="text-sm text-gray-500">{t.category?.name || 'Uncategorized'}</p>
                                            </div>

                                            <div className="text-right flex-shrink-0">
                                                <p
                                                    className={cn(
                                                        'text-lg font-semibold flex items-center gap-1 justify-end',
                                                        t.type === 'income' ? 'text-green-400' : 'text-red-400'
                                                    )}
                                                >
                                                    {t.type === 'income' ? (
                                                        <ArrowUpRight className="w-4 h-4" />
                                                    ) : (
                                                        <ArrowDownRight className="w-4 h-4" />
                                                    )}
                                                    {formatCurrency(t.amountInBase || t.amount, 'IDR')}
                                                </p>
                                                {t.currency !== 'IDR' && t.currency && (
                                                    <p className="text-xs text-gray-500">
                                                        {formatCurrency(t.amount, t.currency)}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex gap-1 flex-shrink-0">
                                                <button
                                                    onClick={() => {
                                                        setEditingTransaction(t);
                                                        setShowModal(true);
                                                    }}
                                                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(t.id)}
                                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <EmptyState
                    icon={<Filter className="w-8 h-8" />}
                    title="No transactions found"
                    description={
                        searchQuery || filterType !== 'all' || filterCategory
                            ? 'Try adjusting your filters'
                            : 'Add your first transaction to get started'
                    }
                    action={
                        !searchQuery && filterType === 'all' && !filterCategory ? (
                            <button
                                onClick={() => setShowModal(true)}
                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white"
                            >
                                Add Transaction
                            </button>
                        ) : undefined
                    }
                />
            )}

            {/* Add/Edit Modal */}
            <TransactionModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingTransaction(null);
                }}
                categories={categories}
                initialData={
                    editingTransaction
                        ? {
                            id: editingTransaction.id,
                            type: editingTransaction.type,
                            amount: editingTransaction.amount.toString(),
                            currency: editingTransaction.currency || 'IDR',
                            categoryId: editingTransaction.category?.id || '',
                            description: editingTransaction.description || '',
                            date: editingTransaction.date,
                        }
                        : undefined
                }
                onSubmit={handleSubmit}
            />
        </div>
    );
}
