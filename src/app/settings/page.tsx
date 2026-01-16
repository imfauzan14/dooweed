'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Edit2, Tag, Database, Globe, User, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { PageHeader } from '@/components/Navigation';
import { CURRENCIES } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

export default function SettingsPage() {
    const { user, signOut } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'categories' | 'preferences' | 'account'>('categories');
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    // Account tab state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasData, setHasData] = useState(false);

    // Currency preferences state
    type FallbackMethod = 'api' | 'llm' | 'custom';
    const [fallbackOrder, setFallbackOrder] = useState<FallbackMethod[]>(['api', 'llm', 'custom']);
    const [enabledMethods, setEnabledMethods] = useState<FallbackMethod[]>(['api', 'llm', 'custom']);
    const [customRates, setCustomRates] = useState<Record<string, Record<string, number>>>({});
    const [currencyLoading, setCurrencyLoading] = useState(false);
    const [currencySaved, setCurrencySaved] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        type: 'expense' as 'income' | 'expense',
        icon: '📁',
        color: '#6366F1',
    });

    // Common emojis for categories
    const emojiOptions = [
        // Food & Drink
        '🍔', '🍕', '🍣', '🍱', '🍜', '🍝', '🍖', '🍗', '🥩', '🥓',
        '🥗', '🥪', '🌮', '🌯', '🍲', '🥘', '🍳', '🥛', '☕', '🍵',
        '🍺', '🍷', '🍹', '🥤', '🍞', '🥐', '🥖', '🥨', '🥯', '🥞',
        '🧇', '🧀', '🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🍑', '🍍',
        // Transport
        '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
        '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🚂', '🚆', '🚇',
        '✈️', '🛫', '🛬', '🚁', '⛴️', '🛳️', '⛵', '🚀', '⛽', '🚧',
        // Shopping & Entertainment
        '🛍️', '🛒', '🎁', '📦', '👓', '🕶️', '👔', '👕', '👖', '🧣',
        '👗', '👘', '👙', '👚', '👛', '👜', '👝', '🎒', '👞', '👟',
        '🎬', '🎨', '🎭', '🎪', '🎫', '🎟️', '🎮', '🎲', '🎰', '🎳',
        '🎵', '🎧', '🎤', '🎹', '🎸', '🎻', '🎺', '🎷', '📷', '📹',
        // Health & Services
        '🏥', '💊', '💉', '🩸', '🩺', '🚑', '💈', '💇', '💅', '💆',
        '🧖', '🛁', '🧼', '🧽', '🧹', '🧺', '🧻', '🚿', '🚽', '🔧',
        '🔨', '🛠️', '⚙️', '🧱', '🔌', '🔋', '💡', '🔦', '🕯️', '🧯',
        // Home & Bills
        '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪',
        '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗼', '🗽', '⛪', '🕌',
        '🛋️', '🛏️', '🚪', '🪑', '🚽', '🚿', '🛁', '🔥', '💧', '⚡',
        '📡', '📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '💽', '💾', '💿',
        // Income & Finance
        '💰', '💴', '💵', '💶', '💷', '💸', '💳', '💎', '⚖️', '🗝️',
        '📈', '📉', '📊', '📋', '📌', '📍', '📎', '📏', '📐', '✂️',
        '🔒', '🔓', '🔏', '🔐', '🔑', '🔨', '⛏️', '⚒️', '🛠️', '🗡️',
        // Misc
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
        '🦁', 'cow', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
        '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
        '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
        '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕',
    ];

    const colorOptions = [
        '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
        '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
        '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
        '#EC4899', '#F43F5E', '#78716C', '#57534E', '#44403C',
    ];

    useEffect(() => {
        fetchCategories();
        checkHasData();
    }, []);

    const checkHasData = async () => {
        try {
            const [transRes, receiptsRes] = await Promise.all([
                fetch('/api/transactions'),
                fetch('/api/receipts')
            ]);
            const transData = await transRes.json();
            const receiptsData = await receiptsRes.json();

            setHasData((transData.data?.length > 0) || (receiptsData.data?.length > 0));
        } catch (error) {
            console.error('Failed to check data:', error);
        }
    };

    const fetchCurrencyPreferences = async () => {
        try {
            const res = await fetch('/api/settings/currency');
            const data = await res.json();
            if (data.success) {
                setFallbackOrder(data.data.fallbackOrder);
                setEnabledMethods(data.data.enabledMethods);
                setCustomRates(data.data.customRates || {});
            }
        } catch (error) {
            console.error('Failed to fetch currency preferences:', error);
        }
    };

    const saveCurrencyPreferences = async () => {
        setCurrencyLoading(true);
        setCurrencySaved(false);
        try {
            const res = await fetch('/api/settings/currency', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fallbackOrder, enabledMethods, customRates }),
            });
            const data = await res.json();
            if (data.success) {
                setCurrencySaved(true);
                setTimeout(() => setCurrencySaved(false), 2000);
            }
        } catch (error) {
            console.error('Failed to save currency preferences:', error);
        } finally {
            setCurrencyLoading(false);
        }
    };

    const moveMethod = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...fallbackOrder];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newOrder.length) return;
        [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
        setFallbackOrder(newOrder);
    };

    const toggleMethod = (method: FallbackMethod) => {
        const isEnabled = enabledMethods.includes(method);
        if (isEnabled) {
            // Check if at least one other method would remain enabled
            const remaining = enabledMethods.filter(m => m !== method);
            if (remaining.length === 0) {
                alert('At least one fallback method must be enabled');
                return;
            }
            setEnabledMethods(remaining);
        } else {
            setEnabledMethods([...enabledMethods, method]);
        }
    };

    // Load currency preferences when switching to Currency tab
    useEffect(() => {
        if (activeTab === 'preferences') {
            fetchCurrencyPreferences();
        }
    }, [activeTab]);

    // Auto-save when fallbackOrder or enabledMethods change
    useEffect(() => {
        if (activeTab === 'preferences' && fallbackOrder.length > 0) {
            saveCurrencyPreferences();
        }
    }, [fallbackOrder, enabledMethods]);


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
                <button
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-colors',
                        activeTab === 'account' ? 'bg-blue-500 text-white' : 'text-gray-400'
                    )}
                >
                    <User className="w-4 h-4 inline-block mr-2" />
                    Account
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {expenseCategories.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl group relative overflow-hidden"
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                                        style={{ backgroundColor: `${cat.color}20` }}
                                    >
                                        {cat.icon}
                                    </div>
                                    <span className="flex-1 text-sm text-white truncate min-w-0">{cat.name}</span>
                                    <div className="opacity-100 sm:opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity bg-gray-800/80 sm:bg-transparent rounded-lg p-1 sm:p-0 absolute right-2 sm:static backdrop-blur-sm sm:backdrop-blur-none border border-gray-700 sm:border-none shadow-lg sm:shadow-none">
                                        <button
                                            onClick={() => openEditModal(cat)}
                                            className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-md"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat.id)}
                                            className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-500/10 rounded-md"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Income Categories */}
                    <div className="glass-card rounded-2xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Income Categories</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {incomeCategories.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl group relative overflow-hidden"
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                                        style={{ backgroundColor: `${cat.color}20` }}
                                    >
                                        {cat.icon}
                                    </div>
                                    <span className="flex-1 text-sm text-white truncate min-w-0">{cat.name}</span>
                                    <div className="opacity-100 sm:opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity bg-gray-800/80 sm:bg-transparent rounded-lg p-1 sm:p-0 absolute right-2 sm:static backdrop-blur-sm sm:backdrop-blur-none border border-gray-700 sm:border-none shadow-lg sm:shadow-none">
                                        <button
                                            onClick={() => openEditModal(cat)}
                                            className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-md"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat.id)}
                                            className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-500/10 rounded-md"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
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
                    {/* Currency Fallback Settings */}
                    <div className="glass-card rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Globe className="w-5 h-5" />
                                    Currency Conversion Fallback
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    Reorder priority with arrows, toggle to enable/disable
                                </p>
                            </div>
                            {currencySaved && (
                                <div className="flex items-center gap-2 text-green-400 text-sm">
                                    <Save className="w-4 h-4" />
                                    Saved
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            {fallbackOrder.map((method, index) => {
                                const methodConfig = {
                                    api: {
                                        name: 'Frankfurter API',
                                        desc: 'Live exchange rates (primary)',
                                        color: 'blue',
                                        bgColor: 'bg-blue-500/20',
                                        textColor: 'text-blue-400',
                                        toggleColor: 'bg-blue-600',
                                        canToggle: true,
                                    },
                                    llm: {
                                        name: 'AI-Powered Estimation',
                                        desc: 'DeepSeek estimates rates from receipt context',
                                        color: 'purple',
                                        bgColor: 'bg-purple-500/20',
                                        textColor: 'text-purple-400',
                                        toggleColor: 'bg-purple-600',
                                        canToggle: true,
                                    },
                                    custom: {
                                        name: 'Custom Rates',
                                        desc: 'Manually configured fallback rates',
                                        color: 'emerald',
                                        bgColor: 'bg-emerald-500/20',
                                        textColor: 'text-emerald-400',
                                        toggleColor: 'bg-emerald-600',
                                        canToggle: true,
                                    },
                                };

                                const config = methodConfig[method];
                                const isEnabled = enabledMethods.includes(method);

                                return (
                                    <div
                                        key={method}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-xl border transition-all",
                                            isEnabled
                                                ? "bg-gray-800/50 border-gray-700"
                                                : "bg-gray-900/30 border-gray-800/50 opacity-60"
                                        )}
                                    >
                                        {/* Priority Number */}
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                                            config.bgColor,
                                            config.textColor
                                        )}>
                                            {index + 1}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1">
                                            <h3 className="font-medium text-white">{config.name}</h3>
                                            <p className="text-xs text-gray-400">{config.desc}</p>
                                        </div>

                                        {/* Controls */}
                                        <div className="flex items-center gap-2">
                                            {/* Up/Down Arrows */}
                                            <div className="flex flex-col gap-0.5">
                                                <button
                                                    onClick={() => moveMethod(index, 'up')}
                                                    disabled={index === 0}
                                                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                                                >
                                                    <ArrowUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => moveMethod(index, 'down')}
                                                    disabled={index === fallbackOrder.length - 1}
                                                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                                                >
                                                    <ArrowDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* Toggle */}
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={isEnabled}
                                                    onChange={() => toggleMethod(method)}
                                                />
                                                <div className={cn(
                                                    "w-11 h-6 rounded-full peer transition-all",
                                                    "after:content-[''] after:absolute after:top-[2px] after:left-[2px]",
                                                    "after:bg-white after:border-gray-300 after:border after:rounded-full",
                                                    "after:h-5 after:w-5 after:transition-all",
                                                    isEnabled ? [
                                                        config.toggleColor,
                                                        "after:translate-x-full"
                                                    ] : "bg-gray-700"
                                                )}></div>
                                            </label>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {currencyLoading && (
                            <div className="mt-4 text-sm text-gray-400 flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                                Saving preferences...
                            </div>
                        )}
                    </div>

                    {/* Custom Rates Editor */}
                    <div className="glass-card rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Custom Fallback Rates</h2>
                            <button className="px-3 py-1.5 text-sm border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors">
                                Reset to Defaults
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">
                            These rates are used when API fails and LLM estimation is unavailable
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.keys(CURRENCIES).slice(0, 6).map((currency) => (
                                <div key={currency} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                                    <span className="text-sm font-mono text-gray-400 w-12">{currency}</span>
                                    <span className="text-gray-600">→</span>
                                    <span className="text-sm font-mono text-gray-400 w-12">IDR</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="16850.00"
                                        className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            ))}
                        </div>

                        <button className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium">
                            Save Custom Rates
                        </button>
                    </div>
                </div>
            )
            }

            {
                activeTab === 'account' && (
                    <div className="space-y-6">
                        {/* User Info */}
                        <div className="glass-card rounded-2xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Profile Information</h2>
                            <div className="space-y-2 text-gray-300">
                                <p><span className="text-gray-500">Email:</span> {user?.email}</p>
                                <p><span className="text-gray-500">Name:</span> {user?.name || 'Not set'}</p>
                            </div>
                        </div>

                        {/* Change Password */}
                        <div className="glass-card rounded-2xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Change Password</h2>

                            {error && (
                                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            )}

                            {success && (
                                <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                                    <p className="text-green-400 text-sm">{success}</p>
                                </div>
                            )}

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setError('');
                                setSuccess('');

                                if (newPassword !== confirmPassword) {
                                    setError('New passwords do not match');
                                    return;
                                }

                                if (newPassword.length < 6) {
                                    setError('Password must be at least 6 characters');
                                    return;
                                }

                                setLoading(true);

                                try {
                                    const res = await fetch('/api/auth/change-password', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ currentPassword, newPassword }),
                                    });

                                    const data = await res.json();

                                    if (!res.ok) {
                                        throw new Error(data.error || 'Failed to change password');
                                    }

                                    setSuccess('Password changed successfully');
                                    setCurrentPassword('');
                                    setNewPassword('');
                                    setConfirmPassword('');
                                } catch (err: any) {
                                    setError(err.message);
                                } finally {
                                    setLoading(false);
                                }
                            }} className="space-y-4">
                                <div>
                                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
                                        Current Password
                                    </label>
                                    <input
                                        id="currentPassword"
                                        type="password"
                                        required
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                                        disabled={loading}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                                        New Password
                                    </label>
                                    <input
                                        id="newPassword"
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                                        disabled={loading}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                                        Confirm New Password
                                    </label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                                        disabled={loading}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    {loading ? 'Changing...' : 'Change Password'}
                                </button>
                            </form>
                        </div>

                        {/* Danger Zone */}
                        <div className="glass-card rounded-2xl p-6 border-red-900/30">
                            <h2 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>

                            <div className="space-y-4">
                                <div className="flex items-start justify-between pb-4 border-b border-red-900/30">
                                    <div className="flex-1">
                                        <h3 className="font-medium text-white mb-1">Clear All Data</h3>
                                        <p className="text-sm text-gray-400">
                                            Delete all transactions, receipts, and budgets. Your account and categories will remain.
                                        </p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!confirm('Are you sure you want to clear ALL your data? This action cannot be undone.')) {
                                                return;
                                            }

                                            setError('');
                                            setLoading(true);

                                            try {
                                                const res = await fetch('/api/auth/clear-data', {
                                                    method: 'DELETE',
                                                });

                                                const data = await res.json();

                                                if (!res.ok) {
                                                    throw new Error(data.error || 'Failed to clear data');
                                                }

                                                window.location.href = '/';
                                            } catch (err: any) {
                                                setError(err.message);
                                                alert('Error: ' + err.message);
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        disabled={loading || !hasData}
                                        className={cn(
                                            "ml-4 px-4 py-2 rounded-lg transition whitespace-nowrap",
                                            hasData
                                                ? "bg-red-900/50 text-red-300 hover:bg-red-900/70"
                                                : "bg-gray-800/50 text-gray-600 cursor-not-allowed"
                                        )}
                                    >
                                        {hasData ? 'Clear Data' : 'No Data'}
                                    </button>
                                </div>

                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-medium text-white mb-1">Delete Account</h3>
                                        <p className="text-sm text-gray-400">
                                            Permanently delete your account and all associated data. This action cannot be undone.
                                        </p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!confirm('Are you sure you want to DELETE your account? This will permanently delete all your data and cannot be undone.')) {
                                                return;
                                            }

                                            if (!confirm('This is your FINAL warning. Your account and ALL data will be permanently deleted. Continue?')) {
                                                return;
                                            }

                                            setError('');
                                            setLoading(true);

                                            try {
                                                const res = await fetch('/api/auth/account', {
                                                    method: 'DELETE',
                                                });

                                                const data = await res.json();

                                                if (!res.ok) {
                                                    throw new Error(data.error || 'Failed to delete account');
                                                }

                                                await signOut();
                                            } catch (err: any) {
                                                setError(err.message);
                                                alert('Error: ' + err.message);
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        disabled={loading}
                                        className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 whitespace-nowrap"
                                    >
                                        Delete Account
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Category Modal */}
            {
                showModal && (
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
                                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-4 max-h-60 overflow-y-auto p-4 bg-gray-900/50 rounded-xl border border-gray-800 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                        {emojiOptions.map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, icon: emoji })}
                                                className={cn(
                                                    'w-10 h-10 flex items-center justify-center text-xl rounded-xl transition-all',
                                                    formData.icon === emoji
                                                        ? 'bg-blue-500 text-white shadow-lg scale-110'
                                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:scale-105'
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
                )
            }
        </div >
    );
}
