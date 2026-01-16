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
    Tag,
    Image as ImageIcon,
    CheckSquare,
    Square,
    X,
    Zap, // Added Zap icon
} from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/Navigation';
import { TransactionModal } from '@/components/TransactionForm';
import { ReceiptEditModal } from '@/components/ReceiptEditModal';
import { ReceiptViewModal } from '@/components/ReceiptViewModal';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface Transaction {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    amountInBase: number | null;
    currency: string | null;
    description?: string;
    date: string;
    category?: Category | null;
    receiptId?: string | null;
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
    const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
    const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);

    // Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

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
                body: JSON.stringify({
                    ...data,
                    amount: parseFloat(data.amount),
                    categoryId: data.categoryId || null,
                }),
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

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.size} transactions?`)) return;

        setIsDeleting(true);
        try {
            await Promise.all(
                Array.from(selectedIds).map(id =>
                    fetch(`/api/transactions/${id}`, { method: 'DELETE' })
                )
            );
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            fetchData();
        } catch (error) {
            console.error('Failed to delete transactions:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const openViewModal = (transaction: Transaction) => {
        if (transaction.receiptId) {
            setViewingReceiptId(transaction.receiptId);
        }
        // Manual transactions: Do nothing on row click (edit only via pencil button)
    };

    const openEditModal = (transaction: Transaction) => {
        if (transaction.receiptId) {
            setEditingReceiptId(transaction.receiptId);
        } else {
            setEditingTransaction(transaction);
            setShowModal(true);
        }
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
                        {isSelectionMode ? (
                            <>
                                {selectedIds.size > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        disabled={isDeleting}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete ({selectedIds.size})
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setIsSelectionMode(false);
                                        setSelectedIds(new Set());
                                    }}
                                    className="p-2 border border-gray-700 rounded-xl text-gray-300 hover:bg-gray-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsSelectionMode(true)}
                                className="p-2 border border-gray-700 rounded-xl text-gray-300 hover:bg-gray-800 transition-colors"
                            >
                                <CheckSquare className="w-5 h-5" />
                            </button>
                        )}
                        {!isSelectionMode && (
                            <>
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
                            </>
                        )}
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
                                            onClick={(e) => {
                                                if (isSelectionMode) {
                                                    toggleSelection(t.id);
                                                } else {
                                                    if (t.receiptId) {
                                                        openViewModal(t);
                                                    } else {
                                                        openEditModal(t);
                                                    }
                                                }
                                            }}
                                            className={cn(
                                                "relative z-10 grid gap-3 items-center p-3 rounded-xl transition-all group hover:shadow-lg border border-gray-800/50 cursor-pointer",
                                                isSelectionMode
                                                    ? "grid-cols-[auto_auto_1fr_auto_auto]"
                                                    : "grid-cols-[auto_1fr_auto_auto]",
                                                selectedIds.has(t.id) ? "bg-blue-500/10 border-blue-500/30" : "bg-gray-900/40 hover:bg-gray-800/50"
                                            )}
                                        >
                                            {isSelectionMode && (
                                                <div className="text-gray-400 mr-1">
                                                    {selectedIds.has(t.id) ? (
                                                        <CheckSquare className="w-5 h-5 text-blue-500" />
                                                    ) : (
                                                        <Square className="w-5 h-5" />
                                                    )}
                                                </div>
                                            )}
                                            {/* Icon */}
                                            <div className="relative">
                                                <div
                                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl flex-shrink-0 relative z-10"
                                                    style={{ backgroundColor: `${t.category?.color || '#6B7280'}20` }}
                                                >
                                                    {t.category?.icon || <Tag className="w-5 h-5 sm:w-6 sm:h-6" />}
                                                </div>
                                                {/* Hide overlay on mobile */}
                                                {t.receiptId && (
                                                    <div className="hidden sm:flex absolute -bottom-1 -right-1 z-20 bg-gray-900 rounded-lg border border-gray-700 w-5 h-5 flex items-center justify-center overflow-hidden shadow-md">
                                                        <div className="w-2 h-2 bg-blue-400 rounded-full" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0 overflow-hidden">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="font-medium text-white truncate text-sm sm:text-base w-full">
                                                        {(t.description || t.category?.name || 'Transaction')}
                                                    </p>
                                                    {t.receiptId && (
                                                        <span className="hidden sm:flex flex-shrink-0 items-center gap-0.5 text-blue-400 text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                            <Zap className="w-3 h-3" /> Auto
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Hide tags on mobile */}
                                                <div className="hidden sm:flex flex-wrap gap-2">
                                                    {t.category ? (
                                                        <span
                                                            className="text-[10px] sm:text-xs px-2 py-0.5 rounded-md border truncate max-w-[120px]"
                                                            style={{
                                                                backgroundColor: `${t.category.color}15`,
                                                                color: t.category.color,
                                                                borderColor: `${t.category.color}30`
                                                            }}
                                                        >
                                                            {t.category.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] sm:text-xs text-gray-500 px-2 py-0.5 rounded-md bg-gray-800 border border-gray-700">
                                                            Uncategorized
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right flex-shrink-0 flex flex-col items-end justify-center self-start pt-1">
                                                <p
                                                    className={cn(
                                                        'font-bold text-sm sm:text-base whitespace-nowrap',
                                                        t.type === 'income' ? 'text-green-500' : 'text-red-500'
                                                    )}
                                                >
                                                    {t.type === 'income' ? '+' : '-'}
                                                    {formatCurrency(t.amount, t.currency || 'IDR')}
                                                </p>
                                                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                                                    {format(new Date(t.date), 'MMM d')}
                                                </p>
                                            </div>

                                            <div className="flex gap-1 flex-shrink-0 relative z-20">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (t.receiptId) {
                                                            setEditingReceiptId(t.receiptId);
                                                        } else {
                                                            openEditModal(t);
                                                        }
                                                    }}
                                                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (<EmptyState
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
            )
            }

            {/* Transaction Modal (for Manual Edits) */}
            <TransactionModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingTransaction(null);
                }}
                onDelete={editingTransaction ? () => handleDelete(editingTransaction.id) : undefined}
                initialData={editingTransaction ? {
                    id: editingTransaction.id,
                    type: editingTransaction.type,
                    amount: editingTransaction.amount.toString(),
                    currency: editingTransaction.currency || 'IDR',
                    categoryId: editingTransaction.category?.id || '',
                    description: editingTransaction.description,
                    date: editingTransaction.date,
                    receiptId: editingTransaction.receiptId || undefined
                } : undefined}
                categories={categories}
                onSubmit={handleSubmit}
                isLoading={isLoading}
            />

            {/* Receipt Edit Modal */}
            {
                editingReceiptId && (
                    <ReceiptEditModal
                        isOpen={!!editingReceiptId}
                        receiptId={editingReceiptId}
                        onClose={() => setEditingReceiptId(null)}
                        onSuccess={() => {
                            setEditingReceiptId(null);
                            fetchData();
                        }}
                    />
                )
            }

            {
                viewingReceiptId && (
                    <ReceiptViewModal
                        isOpen={!!viewingReceiptId}
                        receiptId={viewingReceiptId}
                        onClose={() => setViewingReceiptId(null)}
                        onEdit={() => {
                            const id = viewingReceiptId;
                            setViewingReceiptId(null);
                            setTimeout(() => setEditingReceiptId(id), 100);
                        }}
                    />
                )
            }
        </div >
    );
}
