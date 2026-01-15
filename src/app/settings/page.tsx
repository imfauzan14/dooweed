'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Edit2, Palette, Tag, Database, Globe } from 'lucide-react';
import { PageHeader } from '@/components/Navigation';
import { CURRENCIES } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

export default function SettingsPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'categories' | 'preferences'>('categories');
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        type: 'expense' as 'income' | 'expense',
        icon: '📁',
        color: '#6366F1',
    });

    // Common emojis for categories
    const emojiOptions = [
        '🍔', '🚗', '🛍️', '🎬', '💡', '🏥', '📚', '🛒', '🏠', '🛡️',
        '💇', '📱', '✈️', '🎁', '💰', '💻', '📈', '🏢', '🏪', '🎊',
        '↩️', '💵', '📦', '🎮', '🎵', '💪', '🏋️', '☕', '🍺', '👕',
    ];

    const colorOptions = [
        '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
        '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
        '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
        '#EC4899', '#F43F5E', '#78716C', '#57534E', '#44403C',
    ];

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/categories');
            const data = await response.json();
            setCategories(data.data || []);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const method = editingCategory ? 'PUT' : 'POST';
            const response = await fetch('/api/categories', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(editingCategory && { id: editingCategory.id }),
                    ...formData,
                }),
            });

            if (response.ok) {
                setShowModal(false);
                setEditingCategory(null);
                setFormData({ name: '', type: 'expense', icon: '📁', color: '#6366F1' });
                fetchCategories();
            }
        } catch (error) {
            console.error('Failed to save category:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this category? Transactions using it will become uncategorized.')) return;

        try {
            await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
            fetchCategories();
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            type: category.type,
            icon: category.icon,
            color: category.color,
        });
        setShowModal(true);
    };

    const expenseCategories = categories.filter((c) => c.type === 'expense');
    const incomeCategories = categories.filter((c) => c.type === 'income');

    return (
        <div className="space-y-6">
            <PageHeader
                title="Settings"
                subtitle="Manage categories and preferences"
            />

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-gray-800/50 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('categories')}
                    className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-colors',
                        activeTab === 'categories' ? 'bg-blue-500 text-white' : 'text-gray-400'
                    )}
                >
                    <Tag className="w-4 h-4 inline-block mr-2" />
                    Categories
                </button>
                <button
                    onClick={() => setActiveTab('preferences')}
                    className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-colors',
                        activeTab === 'preferences' ? 'bg-blue-500 text-white' : 'text-gray-400'
                    )}
                >
                    <Settings className="w-4 h-4 inline-block mr-2" />
                    Preferences
                </button>
            </div>

            {activeTab === 'categories' && (
                <div className="space-y-6">
                    {/* Add Category Button */}
                    <button
                        onClick={() => {
                            setEditingCategory(null);
                            setFormData({ name: '', type: 'expense', icon: '📁', color: '#6366F1' });
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        Add Category
                    </button>

                    {/* Expense Categories */}
                    <div className="glass-card rounded-2xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Expense Categories</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {expenseCategories.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl group"
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                        style={{ backgroundColor: `${cat.color}20` }}
                                    >
                                        {cat.icon}
                                    </div>
                                    <span className="flex-1 text-sm text-white truncate">{cat.name}</span>
                                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                        <button
                                            onClick={() => openEditModal(cat)}
                                            className="p-1 text-gray-500 hover:text-white"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat.id)}
                                            className="p-1 text-gray-500 hover:text-red-400"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Income Categories */}
                    <div className="glass-card rounded-2xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Income Categories</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {incomeCategories.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl group"
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                        style={{ backgroundColor: `${cat.color}20` }}
                                    >
                                        {cat.icon}
                                    </div>
                                    <span className="flex-1 text-sm text-white truncate">{cat.name}</span>
                                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                        <button
                                            onClick={() => openEditModal(cat)}
                                            className="p-1 text-gray-500 hover:text-white"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat.id)}
                                            className="p-1 text-gray-500 hover:text-red-400"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'preferences' && (
                <div className="space-y-6">
                    {/* App Info */}
                    <div className="glass-card rounded-2xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Database className="w-5 h-5" />
                            Database
                        </h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Provider</span>
                                <span className="text-white">Turso (LibSQL)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Storage</span>
                                <span className="text-white">Edge SQLite</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Globe className="w-5 h-5" />
                            Currency & Locale
                        </h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Default Currency</span>
                                <span className="text-white">IDR (Indonesian Rupiah)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Exchange Rate API</span>
                                <span className="text-white">Frankfurter (Free)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">OCR Languages</span>
                                <span className="text-white">English + Indonesian</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">About</h2>
                        <div className="space-y-3 text-sm">
                            <p className="text-gray-400">
                                Dooweed is a personal expense tracker with OCR receipt scanning.
                                All data is stored in your Turso database, and OCR processing happens
                                locally in your browser using Tesseract.js.
                            </p>
                            <p className="text-gray-500">
                                Built with Next.js • Deployed on Vercel • 100% Free tier
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 p-6">
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingCategory ? 'Edit Category' : 'New Category'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Type Toggle */}
                            <div className="flex gap-2 p-1 bg-gray-800/50 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                                    className={cn(
                                        'flex-1 py-2 rounded-lg font-medium',
                                        formData.type === 'expense' ? 'bg-red-500 text-white' : 'text-gray-400'
                                    )}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'income' })}
                                    className={cn(
                                        'flex-1 py-2 rounded-lg font-medium',
                                        formData.type === 'income' ? 'bg-green-500 text-white' : 'text-gray-400'
                                    )}
                                >
                                    Income
                                </button>
                            </div>

                            {/* Name */}
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Category name"
                                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white"
                                required
                            />

                            {/* Icon Selector */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Icon</label>
                                <div className="grid grid-cols-10 gap-2">
                                    {emojiOptions.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, icon: emoji })}
                                            className={cn(
                                                'p-2 text-xl rounded-lg transition-colors',
                                                formData.icon === emoji ? 'bg-blue-500' : 'bg-gray-800 hover:bg-gray-700'
                                            )}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Color Selector */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Color</label>
                                <div className="grid grid-cols-10 gap-2">
                                    {colorOptions.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color })}
                                            className={cn(
                                                'w-8 h-8 rounded-lg transition-all',
                                                formData.color === color && 'ring-2 ring-white ring-offset-2 ring-offset-gray-900'
                                            )}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="p-4 bg-gray-800/50 rounded-xl flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                    style={{ backgroundColor: `${formData.color}20` }}
                                >
                                    {formData.icon}
                                </div>
                                <div>
                                    <p className="font-medium text-white">{formData.name || 'Category Name'}</p>
                                    <p className="text-sm text-gray-500 capitalize">{formData.type}</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingCategory(null);
                                    }}
                                    className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium"
                                >
                                    {editingCategory ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
