'use client';

import { useState, useEffect } from 'react';
import { Plus, PiggyBank, Trash2, Edit2 } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/Navigation';
import { BudgetProgress } from '@/components/BudgetProgress';
import { formatCurrency, CURRENCIES } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

interface Budget {
    id: string;
    categoryId: string;
    amount: number;
    currency: string;
    period: 'weekly' | 'monthly' | 'yearly';
    spent: number;
    remaining: number;
    percentUsed: number;
    isOverBudget: boolean;
    category: {
        name: string;
        icon: string;
        color: string;
    };
}

export default function BudgetsPage() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

    // Form state
    const [formData, setFormData] = useState<{
        categoryId: string;
        amount: string;
        period: 'weekly' | 'monthly' | 'yearly';
    }>({
        categoryId: '',
        amount: '',
        period: 'monthly',
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [budgetsRes, categoriesRes] = await Promise.all([
                fetch('/api/budgets'),
                fetch('/api/categories'),
            ]);

            const [budgetsData, categoriesData] = await Promise.all([
                budgetsRes.json(),
                categoriesRes.json(),
            ]);

            setBudgets(budgetsData.data || []);
            setCategories((categoriesData.data || []).filter((c: Category) => c.type === 'expense'));
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const url = editingBudget ? '/api/budgets' : '/api/budgets';
            const method = editingBudget ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(editingBudget && { id: editingBudget.id }),
                    categoryId: formData.categoryId,
                    amount: parseFloat(formData.amount),
                    period: formData.period,
                }),
            });

            if (response.ok) {
                setShowModal(false);
                setEditingBudget(null);
                setFormData({ categoryId: '', amount: '', period: 'monthly' });
                fetchData();
            }
        } catch (error) {
            console.error('Failed to save budget:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this budget?')) return;

        try {
            const response = await fetch(`/api/budgets?id=${id}`, { method: 'DELETE' });
            if (response.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Failed to delete budget:', error);
        }
    };

    const openEditModal = (budget: Budget) => {
        setEditingBudget(budget);
        setFormData({
            categoryId: budget.categoryId,
            amount: budget.amount.toString(),
            period: budget.period,
        });
        setShowModal(true);
    };

    const categoriesWithoutBudget = categories.filter(
        (c) => !budgets.some((b) => b.categoryId === c.id && b.period === formData.period)
    );

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-48 skeleton rounded-lg" />
                <div className="grid gap-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-32 skeleton rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
    const overBudgetCount = budgets.filter((b) => b.isOverBudget).length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Budgets"
                subtitle={`${budgets.length} active budgets`}
                action={
                    <button
                        onClick={() => {
                            setEditingBudget(null);
                            setFormData({ categoryId: '', amount: '', period: 'monthly' });
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        Add Budget
                    </button>
                }
            />

            {/* Summary */}
            {budgets.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 glass-card rounded-xl">
                        <p className="text-sm text-gray-400">Total Budget</p>
                        <p className="text-2xl font-bold text-white">
                            {formatCurrency(totalBudget, 'IDR')}
                        </p>
                    </div>
                    <div className="p-4 glass-card rounded-xl">
                        <p className="text-sm text-gray-400">Total Spent</p>
                        <p className="text-2xl font-bold text-white">
                            {formatCurrency(totalSpent, 'IDR')}
                        </p>
                    </div>
                    <div className="p-4 glass-card rounded-xl">
                        <p className="text-sm text-gray-400">Over Budget</p>
                        <p className={cn('text-2xl font-bold', overBudgetCount > 0 ? 'text-red-400' : 'text-green-400')}>
                            {overBudgetCount} categories
                        </p>
                    </div>
                </div>
            )}

            {/* Budget List */}
            {budgets.length > 0 ? (
                <div className="grid gap-4">
                    {budgets.map((budget) => (
                        <div key={budget.id} className="relative">
                            <BudgetProgress
                                categoryName={budget.category.name}
                                categoryIcon={budget.category.icon}
                                categoryColor={budget.category.color}
                                budgetAmount={budget.amount}
                                spentAmount={budget.spent}
                                period={budget.period}
                                currency={budget.currency}
                            />
                            <div className="absolute top-4 right-4 flex gap-1">
                                <button
                                    onClick={() => openEditModal(budget)}
                                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(budget.id)}
                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={<PiggyBank className="w-8 h-8" />}
                    title="No budgets set"
                    description="Create budgets to track your spending by category"
                    action={
                        <button
                            onClick={() => setShowModal(true)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white"
                        >
                            Create Budget
                        </button>
                    }
                />
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 p-6">
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingBudget ? 'Edit Budget' : 'New Budget'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Category */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Category</label>
                                <select
                                    value={formData.categoryId}
                                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                    disabled={!!editingBudget}
                                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                    required
                                >
                                    <option value="">Select category</option>
                                    {(editingBudget ? categories : categoriesWithoutBudget).map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.icon} {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Amount */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Budget Amount (IDR)</label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0"
                                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            {/* Period */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Period</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['weekly', 'monthly', 'yearly'] as const).map((period) => (
                                        <button
                                            key={period}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, period })}
                                            className={cn(
                                                'py-2 rounded-lg font-medium capitalize transition-all',
                                                formData.period === period
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-gray-800 text-gray-400 hover:text-white'
                                            )}
                                        >
                                            {period}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingBudget(null);
                                    }}
                                    className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-300 hover:bg-gray-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium"
                                >
                                    {editingBudget ? 'Update' : 'Create'} Budget
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
