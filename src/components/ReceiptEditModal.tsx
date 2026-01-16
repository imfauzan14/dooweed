'use client';

import { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CURRENCIES, CurrencyCode } from '@/lib/currency';

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

interface ReceiptEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    receiptId: string;
    onSuccess: () => void;
}

export function ReceiptEditModal({
    isOpen,
    onClose,
    receiptId,
    onSuccess,
}: ReceiptEditModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);

    // Form State
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('IDR');
    const [date, setDate] = useState('');
    const [merchant, setMerchant] = useState('');
    const [categoryId, setCategoryId] = useState('');

    const [transactionId, setTransactionId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && receiptId) {
            loadData();
        }
    }, [isOpen, receiptId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Fetch categories and receipt data in parallel
            const [categoriesRes, receiptRes] = await Promise.all([
                fetch('/api/categories'),
                fetch(`/api/receipts/${receiptId}`)
            ]);

            const [catData, receiptData] = await Promise.all([
                categoriesRes.json(),
                receiptRes.json()
            ]);

            setCategories(catData.data || []);

            if (receiptData.data) {
                const r = receiptData.data;
                setImageUrl(`/api/receipts/${r.id}/image`);
                setAmount(Math.abs(r.ocrAmount || 0).toString() || '');
                setCurrency(r.ocrCurrency || 'IDR');
                const validDate = r.ocrDate && /^\d{4}-\d{2}-\d{2}$/.test(r.ocrDate) ? r.ocrDate : new Date().toISOString().split('T')[0];
                setDate(validDate);
                setMerchant(r.ocrMerchant || '');

                // Try to find existing transaction to populate category/type
                const txRes = await fetch('/api/transactions?limit=100');
                const txs = await txRes.json();
                const tx = txs.data?.find((t: any) => t.receiptId === receiptId);

                if (tx) {
                    setTransactionId(tx.id);
                    setType(tx.type as 'income' | 'expense');
                    setCategoryId(tx.category?.id || tx.categoryId || '');
                    setAmount(tx.amount?.toString() || r.ocrAmount?.toString());
                    setMerchant(tx.description || r.ocrMerchant);
                    setDate(tx.date || r.ocrDate);
                } else {
                    setTransactionId(null);
                }
            }
        } catch (error) {
            console.error('Failed to load receipt data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!amount) return;

        setIsSaving(true);
        try {
            // 1. Update Receipt
            await fetch(`/api/receipts/${receiptId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ocrMerchant: merchant,
                    ocrDate: date,
                    ocrAmount: parseFloat(amount),
                    ocrCurrency: currency,
                    verified: true, // Mark as reviewed
                    isAutomated: false, // Clear auto flag when manually edited
                }),
            });

            // 2. Manage Transaction
            const transactionData = {
                type,
                amount: Math.abs(parseFloat(amount)),
                currency,
                categoryId: categoryId || null,
                description: merchant,
                date: date.match(/^\d{4}-\d{2}-\d{2}$/) ? date : new Date().toISOString().split('T')[0],
                receiptId,
            };

            if (transactionId) {
                // Update existing
                await fetch(`/api/transactions/${transactionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(transactionData),
                });
            } else {
                // Create new
                await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(transactionData),
                });
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this receipt and its transaction? This cannot be undone.')) return;

        setIsSaving(true);
        try {
            // Delete receipt (backend should cascade or we delete tx manually)
            // But let's be explicit and delete receipt which is the source of truth here
            await fetch(`/api/receipts/${receiptId}`, {
                method: 'DELETE',
            });

            // If we have a transaction ID, we might want to ensure it's deleted too, 
            // but usually deleting the receipt should handle it or it's fine if tx is gone.
            // Assuming /api/receipts DELETE handles cleanup or the user manually manages.
            // Wait, if I delete receipt, the transaction might remain if not cascaded.
            // Let's safe delete transaction if exists.
            if (transactionId) {
                await fetch(`/api/transactions/${transactionId}`, {
                    method: 'DELETE',
                });
            }

            onClose();
            onSuccess();
        } catch (error) {
            console.error('Failed to delete:', error);
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Edit Receipt</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Image Preview */}
                    <div className="aspect-[3/4] bg-black rounded-xl overflow-hidden relative group">
                        {isLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                            </div>
                        ) : imageUrl ? (
                            <img
                                src={imageUrl}
                                alt="Receipt"
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                                No image available
                            </div>
                        )}
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setType('expense')}
                                className={cn(
                                    'py-2 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all',
                                    type === 'expense'
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                                )}
                            >
                                <ArrowDownRight className="w-4 h-4" />
                                Expense
                            </button>
                            <button
                                onClick={() => setType('income')}
                                className={cn(
                                    'py-2 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all',
                                    type === 'income'
                                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                                )}
                            >
                                <ArrowUpRight className="w-4 h-4" />
                                Income
                            </button>
                        </div>

                        <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">Amount</label>
                            <div className="flex gap-2">
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="px-3 py-2.5 sm:py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-sm sm:text-base text-white outline-none focus:border-blue-500"
                                >
                                    {Object.keys(CURRENCIES).map((code) => (
                                        <option key={code} value={code}>{code}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500 text-base sm:text-lg font-bold"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-sm sm:text-base text-white outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">Merchant</label>
                            <input
                                type="text"
                                value={merchant}
                                onChange={(e) => setMerchant(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-sm sm:text-base text-white outline-none focus:border-blue-500"
                                placeholder="Merchant name"
                            />
                        </div>

                        <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">Category</label>
                            <div className="grid grid-cols-4 gap-2">
                                <button
                                    onClick={() => setCategoryId('')}
                                    className={cn(
                                        'flex flex-col items-center gap-1 p-2 rounded-xl transition-all',
                                        categoryId === ''
                                            ? 'bg-blue-500/20 border-2 border-blue-500 text-white shadow-lg shadow-blue-500/25'
                                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 border-2 border-transparent'
                                    )}
                                >
                                    <span className="text-xl">🚫</span>
                                    <span className="text-[10px] line-clamp-2 w-full text-center font-medium">Uncategorized</span>
                                </button>
                                {categories
                                    .filter(c => c.type === type)
                                    .map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setCategoryId(cat.id)}
                                            className={cn(
                                                'flex flex-col items-center gap-1 p-2 rounded-xl transition-all',
                                                categoryId === cat.id
                                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                                                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                                            )}
                                        >
                                            <span className="text-xl">{cat.icon}</span>
                                            <span className="text-[10px] line-clamp-2 w-full text-center">{cat.name}</span>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-800 flex gap-3">
                    <button
                        onClick={handleDelete}
                        className="px-4 py-3 border border-red-900/50 text-red-500 hover:bg-red-900/20 rounded-xl transition-colors"
                        title="Delete Receipt"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 border border-gray-700 rounded-xl text-gray-300 font-medium hover:bg-gray-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !amount}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
