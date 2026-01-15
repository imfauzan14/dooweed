'use client';

import { useState, useEffect } from 'react';
import { Plus, Repeat, Trash2, Edit2, Pause, Play } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/Navigation';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

interface RecurringTransaction {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    currency: string;
    categoryId: string;
    description: string | null;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    nextDate: string;
    endDate: string | null;
    isActive: boolean;
    category: Category | null;
}

export default function RecurringPage() {
    const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);

    const [formData, setFormData] = useState({
        type: 'expense' as 'income' | 'expense',
        amount: '',
        categoryId: '',
        description: '',
        frequency: 'monthly' as const,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [recurringRes, categoriesRes] = await Promise.all([
                fetch('/api/recurring'),
                fetch('/api/categories'),
            ]);

            const [recurringData, categoriesData] = await Promise.all([
                recurringRes.json(),
                categoriesRes.json(),
            ]);

            setRecurring(recurringData.data || []);
            setCategories(categoriesData.data || []);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const method = editingItem ? 'PUT' : 'POST';
            const response = await fetch('/api/recurring', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(editingItem && { id: editingItem.id }),
                    type: formData.type,
                    amount: parseFloat(formData.amount),
                    categoryId: formData.categoryId,
                    description: formData.description,
                    frequency: formData.frequency,
                    startDate: formData.startDate,
                    endDate: formData.endDate || null,
                }),
            });

            if (response.ok) {
                setShowModal(false);
                setEditingItem(null);
                resetForm();
                fetchData();
            }
        } catch (error) {
            console.error('Failed to save recurring transaction:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            type: 'expense',
            amount: '',
            categoryId: '',
            description: '',
            frequency: 'monthly',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: '',
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this recurring transaction?')) return;

        try {
            await fetch(`/api/recurring?id=${id}`, { method: 'DELETE' });
            fetchData();
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const handleToggleActive = async (item: RecurringTransaction) => {
        try {
            await fetch('/api/recurring', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
            });
            fetchData();
        } catch (error) {
            console.error('Failed to toggle:', error);
        }
    };

    const openEditModal = (item: RecurringTransaction) => {
        setEditingItem(item);
        setFormData({
            type: item.type,
            amount: item.amount.toString(),
            categoryId: item.categoryId,
            description: item.description || '',
            frequency: item.frequency,
            startDate: item.nextDate,
            endDate: item.endDate || '',
        });
        setShowModal(true);
    };

    const filteredCategories = categories.filter((c) => c.type === formData.type);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-48 skeleton rounded-lg" />
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-24 skeleton rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    const activeRecurring = recurring.filter((r) => r.isActive);
    const pausedRecurring = recurring.filter((r) => !r.isActive);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Recurring"
                subtitle="Automate your regular transactions"
                action={
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            resetForm();
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        Add Recurring
                    </button>
                }
            />

            {/* Process Due Button */}
            {activeRecurring.length > 0 && (
                <button
                    onClick={async () => {
                        await fetch('/api/recurring', { method: 'PATCH' });
                        fetchData();
                    }}
                    className="w-full py-3 border border-gray-700 rounded-xl text-gray-300 hover:bg-gray-800 transition-colors"
                >
                    Process Due Transactions
                </button>
            )}

            {/* Active Recurring */}
            {activeRecurring.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white">Active</h2>
                    {activeRecurring.map((item) => (
                        <RecurringCard
                            key={item.id}
                            item={item}
                            onEdit={() => openEditModal(item)}
                            onDelete={() => handleDelete(item.id)}
                            onToggle={() => handleToggleActive(item)}
                        />
                    ))}
                </div>
            )}

            {/* Paused Recurring */}
            {pausedRecurring.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-500">Paused</h2>
                    {pausedRecurring.map((item) => (
                        <RecurringCard
                            key={item.id}
                            item={item}
                            onEdit={() => openEditModal(item)}
                            onDelete={() => handleDelete(item.id)}
                            onToggle={() => handleToggleActive(item)}
                        />
                    ))}
                </div>
            )}

            {recurring.length === 0 && (
                <EmptyState
                    icon={<Repeat className="w-8 h-8" />}
                    title="No recurring transactions"
                    description="Set up automatic transactions for rent, subscriptions, salary, etc."
                    action={
                        <button
                            onClick={() => setShowModal(true)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white"
                        >
                            Add Recurring
                        </button>
                    }
                />
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingItem ? 'Edit Recurring' : 'New Recurring Transaction'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Type Toggle */}
                            <div className="flex gap-2 p-1 bg-gray-800/50 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'expense', categoryId: '' })}
                                    className={cn(
                                        'flex-1 py-2 rounded-lg font-medium',
                                        formData.type === 'expense' ? 'bg-red-500 text-white' : 'text-gray-400'
                                    )}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'income', categoryId: '' })}
                                    className={cn(
                                        'flex-1 py-2 rounded-lg font-medium',
                                        formData.type === 'income' ? 'bg-green-500 text-white' : 'text-gray-400'
                                    )}
                                >
                                    Income
                                </button>
                            </div>

                            {/* Amount */}
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="Amount"
                                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white"
                                required
                            />

                            {/* Category */}
                            <select
                                value={formData.categoryId}
                                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white"
                                required
                            >
                                <option value="">Select category</option>
                                {filteredCategories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.icon} {c.name}
                                    </option>
                                ))}
                            </select>

                            {/* Description */}
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Description"
                                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white"
                            />

                            {/* Frequency */}
                            <div className="grid grid-cols-4 gap-2">
                                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => (
                                    <button
                                        key={freq}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, frequency: freq })}
                                        className={cn(
                                            'py-2 rounded-lg text-sm font-medium capitalize',
                                            formData.frequency === freq
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-800 text-gray-400'
                                        )}
                                    >
                                        {freq}
                                    </button>
                                ))}
                            </div>

                            {/* Start Date */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Start Date</label>
                                <input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white"
                                    required
                                />
                            </div>

                            {/* End Date (optional) */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">End Date (optional)</label>
                                <input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingItem(null);
                                    }}
                                    className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium"
                                >
                                    {editingItem ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function RecurringCard({
    item,
    onEdit,
    onDelete,
    onToggle,
}: {
    item: RecurringTransaction;
    onEdit: () => void;
    onDelete: () => void;
    onToggle: () => void;
}) {
    return (
        <div
            className={cn(
                'flex items-center gap-4 p-4 glass-card rounded-xl',
                !item.isActive && 'opacity-60'
            )}
        >
            <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: `${item.category?.color || '#6B7280'}20` }}
            >
                {item.category?.icon || '📁'}
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                    {item.description || item.category?.name || 'Transaction'}
                </p>
                <p className="text-sm text-gray-500 capitalize">
                    {item.frequency} • Next: {format(new Date(item.nextDate), 'MMM d, yyyy')}
                </p>
            </div>

            <div className="text-right flex-shrink-0">
                <p
                    className={cn(
                        'text-lg font-semibold',
                        item.type === 'income' ? 'text-green-400' : 'text-red-400'
                    )}
                >
                    {item.type === 'income' ? '+' : '-'}
                    {formatCurrency(item.amount, item.currency)}
                </p>
            </div>

            <div className="flex gap-1 flex-shrink-0">
                <button
                    onClick={onToggle}
                    className={cn(
                        'p-2 rounded-lg transition-colors',
                        item.isActive
                            ? 'text-yellow-500 hover:bg-yellow-500/10'
                            : 'text-green-500 hover:bg-green-500/10'
                    )}
                >
                    {item.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                    onClick={onEdit}
                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    onClick={onDelete}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
