'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CURRENCIES, CurrencyCode, formatCurrency } from '@/lib/currency';
import { X, Calendar, DollarSign, Tag, FileText, RefreshCw, Trash2 } from 'lucide-react';

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

interface TransactionFormData {
    type: 'income' | 'expense';
    amount: string;
    currency: string;
    categoryId: string;
    description: string;
    date: string;
    receiptId?: string;
}

interface TransactionFormProps {
    initialData?: Partial<TransactionFormData> & { id?: string };
    categories: Category[];
    onSubmit: (data: TransactionFormData) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
    isLoading?: boolean;
}

export function TransactionForm({
    initialData,
    categories,
    onSubmit,
    onCancel,
    onDelete,
    isLoading,
}: TransactionFormProps) {
    const [formData, setFormData] = useState<TransactionFormData>({
        type: initialData?.type || 'expense',
        amount: initialData?.amount?.toString() || '',
        currency: initialData?.currency || 'IDR',
        categoryId: initialData?.categoryId || '',
        description: initialData?.description || '',
        date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
        receiptId: initialData?.receiptId,
    });

    const [exchangeRate, setExchangeRate] = useState<number | null>(null);

    // Sync formData when initialData changes (e.g., opening modal with new receipt)
    useEffect(() => {
        if (initialData) {
            setFormData({
                type: initialData.type || 'expense',
                amount: initialData.amount?.toString() || '',
                currency: initialData.currency || 'IDR',
                categoryId: initialData.categoryId || '',
                description: initialData.description || '',
                date: initialData.date || format(new Date(), 'yyyy-MM-dd'),
                receiptId: initialData.receiptId,
            });
        }
    }, [initialData]);

    const filteredCategories = categories.filter((c) => c.type === formData.type);

    useEffect(() => {
        // Fetch exchange rate when currency changes
        if (formData.currency !== 'IDR') {
            fetch(`/api/exchange-rates?from=${formData.currency}&to=IDR`)
                .then((res) => res.json())
                .then((data) => setExchangeRate(data.data?.rate || null));
        } else {
            setExchangeRate(null);
        }
    }, [formData.currency]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(formData);
    };

    const handleDelete = async () => {
        if (onDelete && confirm('Are you sure you want to delete this transaction?')) {
            await onDelete();
        }
    };

    const amountInIDR = exchangeRate && formData.amount
        ? parseFloat(formData.amount) * exchangeRate
        : null;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type Toggle */}
            <div className="flex gap-2 p-1 bg-gray-800/50 rounded-xl">
                <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'expense', categoryId: '' })}
                    className={cn(
                        'flex-1 py-3 rounded-lg font-medium transition-all',
                        formData.type === 'expense'
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                            : 'text-gray-400 hover:text-white'
                    )}
                >
                    Expense
                </button>
                <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'income', categoryId: '' })}
                    className={cn(
                        'flex-1 py-3 rounded-lg font-medium transition-all',
                        formData.type === 'income'
                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                            : 'text-gray-400 hover:text-white'
                    )}
                >
                    Income
                </button>
            </div>

            {/* Amount & Currency */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                    <DollarSign className="w-4 h-4" />
                    Amount
                </label>
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <input
                            type="number"
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-2xl font-bold text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>
                    <select
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {Object.entries(CURRENCIES).map(([code, info]) => (
                            <option key={code} value={code}>
                                {info.symbol} {code}
                            </option>
                        ))}
                    </select>
                </div>
                {amountInIDR && (
                    <p className="text-sm text-gray-500">
                        ≈ {formatCurrency(amountInIDR, 'IDR')}
                    </p>
                )}
            </div>

            {/* Category */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                    <Tag className="w-4 h-4" />
                    Category
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, categoryId: '' })}
                        className={cn(
                            'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all',
                            formData.categoryId === ''
                                ? 'border-blue-500 bg-blue-500/20'
                                : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                        )}
                    >
                        <span className="text-2xl">🚫</span>
                        <span className="text-xs text-gray-300 truncate w-full text-center">
                            None
                        </span>
                    </button>
                    {filteredCategories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, categoryId: cat.id })}
                            className={cn(
                                'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all',
                                formData.categoryId === cat.id
                                    ? 'border-blue-500 bg-blue-500/20'
                                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                            )}
                        >
                            <span className="text-2xl">{cat.icon}</span>
                            <span className="text-xs text-gray-300 truncate w-full text-center">
                                {cat.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    Date
                </label>
                <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
            </div>

            {/* Description */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                    <FileText className="w-4 h-4" />
                    Description (optional)
                </label>
                <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What's this for?"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
                {initialData?.id && onDelete && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="px-4 py-3 border border-red-900/50 text-red-500 hover:bg-red-900/20 rounded-xl transition-colors"
                        title="Delete Transaction"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                )}
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-3 px-4 border border-gray-700 rounded-xl text-gray-300 hover:bg-gray-800 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isLoading || !formData.amount}
                    className={cn(
                        'flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
                        formData.type === 'expense'
                            ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
                        'text-white shadow-lg',
                        (isLoading || !formData.amount) && 'opacity-50 cursor-not-allowed'
                    )}
                >
                    {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                    {initialData?.id ? 'Update' : 'Add'} {formData.type === 'income' ? 'Income' : 'Expense'}
                </button>
            </div>
        </form>
    );
}

// Modal wrapper for the form
interface TransactionModalProps extends Omit<TransactionFormProps, 'onCancel'> {
    isOpen: boolean;
    onClose: () => void;
}

export function TransactionModal({ isOpen, onClose, ...props }: TransactionModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 p-6 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-white mb-6">
                    {props.initialData?.id ? 'Edit Transaction' : 'New Transaction'}
                </h2>
                <TransactionForm {...props} onCancel={onClose} />
            </div>
        </div>
    );
}
