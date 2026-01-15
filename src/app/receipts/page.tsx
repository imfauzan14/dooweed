'use client';

import { useState, useEffect } from 'react';
import { Camera, Receipt, X, Trash2, Check, ArrowUpRight, ArrowDownRight, ArrowUpDown } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/Navigation';
import { ReceiptScanner } from '@/components/ReceiptScanner';
import { format } from 'date-fns';
import { formatCurrency, CURRENCIES } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

interface ScanResult {
    imageBase64: string;
    rawText: string;
    merchant: string | null;
    date: string | null;
    amount: number | null;
    currency: string | null;
    confidence: number;
    items: any[];
    transactionType?: 'income' | 'expense' | null;
    editedType?: 'income' | 'expense';
    editedAmount?: number;
    editedDate?: string;
    editedMerchant?: string;
    editedCategoryId?: string;
}

interface SavedReceipt {
    id: string;
    imageBase64?: string;
    ocrMerchant: string | null;
    ocrDate: string | null;
    ocrAmount: number | null;
    ocrCurrency: string | null;
    ocrConfidence: number | null;
    verified: boolean;
    createdAt: string;
}

export default function ReceiptsPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [savedReceipts, setSavedReceipts] = useState<SavedReceipt[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Edit modal state
    const [editingReceipt, setEditingReceipt] = useState<SavedReceipt | null>(null);
    const [receiptImage, setReceiptImage] = useState<string | null>(null);
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

    // Edit form fields
    const [editType, setEditType] = useState<'income' | 'expense'>('expense');
    const [editAmount, setEditAmount] = useState<string>('');
    const [editCurrency, setEditCurrency] = useState('IDR');
    const [editDate, setEditDate] = useState('');
    const [editMerchant, setEditMerchant] = useState('');
    const [editCategoryId, setEditCategoryId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [categoriesRes, receiptsRes] = await Promise.all([
                fetch('/api/categories'),
                fetch('/api/receipts?limit=100'),
            ]);

            const [categoriesData, receiptsData] = await Promise.all([
                categoriesRes.json(),
                receiptsRes.json(),
            ]);

            setCategories(categoriesData.data || []);
            setSavedReceipts(receiptsData.data || []);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this receipt? This will also delete the associated transaction.')) return;

        try {
            const res = await fetch(`/api/receipts/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setSavedReceipts(prev => prev.filter(r => r.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete receipt:', error);
        }
    };

    // Filter receipts
    const filteredReceipts = savedReceipts.filter((r) => {
        if (filterVerified !== 'all') {
            const isVerified = filterVerified === 'verified';
            if (r.verified !== isVerified) return false;
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesMerchant = r.ocrMerchant?.toLowerCase().includes(query);
            if (!matchesMerchant) return false;
        }
        return true;
    }).sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'date') {
            cmp = new Date(a.ocrDate || 0).getTime() - new Date(b.ocrDate || 0).getTime();
        } else if (sortBy === 'amount') {
            cmp = (a.ocrAmount || 0) - (b.ocrAmount || 0);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
    });

    const handleCreateTransaction = async (result: ScanResult) => {
        try {
            // First save the receipt
            const receiptRes = await fetch('/api/receipts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: result.imageBase64,
                    ocrRawText: result.rawText,
                    ocrMerchant: result.editedMerchant || result.merchant,
                    ocrDate: result.editedDate || result.date,
                    ocrAmount: result.editedAmount || result.amount,
                    ocrCurrency: result.currency || 'IDR',
                    ocrConfidence: result.confidence,
                    verified: true,
                }),
            });
            const receiptData = await receiptRes.json();
            const receiptId = receiptData.data?.id;

            // Create transaction with the currency from scan result
            await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: result.editedType || 'expense',
                    amount: result.editedAmount || result.amount,
                    currency: result.currency || 'IDR',
                    categoryId: result.editedCategoryId,
                    description: result.editedMerchant || result.merchant || '',
                    date: result.editedDate || result.date,
                    receiptId,
                }),
            });

            fetchData();
        } catch (error) {
            console.error('Failed to create transaction:', error);
        }
    };

    const openEditReceipt = async (receipt: SavedReceipt) => {
        setEditingReceipt(receipt);
        setIsLoadingReceipt(true);
        setReceiptImage(`/api/receipts/${receipt.id}/image`);

        // Initialize form with receipt data
        setEditType('expense');
        setEditAmount(receipt.ocrAmount?.toString() || '');
        setEditCurrency(receipt.ocrCurrency || 'IDR');
        setEditDate(receipt.ocrDate || format(new Date(), 'yyyy-MM-dd'));
        setEditMerchant(receipt.ocrMerchant || '');
        setEditCategoryId('');

        setIsLoadingReceipt(false);
    };

    const handleSaveEdit = async () => {
        if (!editingReceipt || !editAmount || !editCategoryId) return;

        setIsSaving(true);
        try {
            // Update receipt as verified
            await fetch(`/api/receipts/${editingReceipt.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ocrMerchant: editMerchant,
                    ocrDate: editDate,
                    ocrAmount: parseFloat(editAmount),
                    ocrCurrency: editCurrency,
                    verified: true,
                }),
            });

            // Delete existing transaction for this receipt to prevent duplicates
            // We do this by searching for transactions with this receiptId first or just assuming standard one-to-one for now
            // But since our API doesn't support delete-by-receipt-id directly, and we don't have transaction ID here...
            // Actually, the cascade delete on receipt delete suggests we rely on receipt ID. 
            // Better approach: Update the POST /api/transactions to handle deduplication or just fetch transactions first.
            // For now, let's just create. Wait, the user complained it creates duplicates.
            // Let's use a specialized check. Or better: fetch transactions for this receipt and delete them.

            const txRes = await fetch(`/api/transactions?limit=100`); // Ideally filter by receiptId if API supported it.
            // Since API doesn't support filter by receiptId, we rely on the fact that this is a hacky fix.
            // IMPROVEMENT: Let's add functionality to DELETE /api/transactions?receiptId=... or just implement PUT.
            // For now, let's try to accept that we need to fix the API.

            // To fix this properly, I will update the API route in the next step to support delete-by-receipt or update.
            // For this specific file change, I will just leave the POST but I will modify the API in the next step.
            // Wait, I can't leave it broken.
            // I will implement a client-side fetch to find the transaction.

            const allTxRes = await fetch('/api/transactions?limit=100');
            const allTx = await allTxRes.json();
            const existingTx = allTx.data.find((t: any) => t.receiptId === editingReceipt.id);

            if (existingTx) {
                await fetch(`/api/transactions/${existingTx.id}`, { method: 'DELETE' });
            }

            // Create transaction
            await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: editType,
                    amount: parseFloat(editAmount),
                    currency: editCurrency,
                    categoryId: editCategoryId,
                    description: editMerchant,
                    date: editDate,
                    receiptId: editingReceipt.id,
                }),
            });

            setEditingReceipt(null);
            setReceiptImage(null);
            fetchData();
        } catch (error) {
            console.error('Failed to save:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredCategories = categories.filter(c => c.type === editType);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-48 skeleton rounded-lg" />
                <div className="h-64 skeleton rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Receipts"
                subtitle="Scan and manage your receipts"
            />

            {/* Scanner */}
            <div className="glass-card rounded-2xl p-4 md:p-6">
                <ReceiptScanner
                    onCreateTransaction={handleCreateTransaction}
                    onSkip={async (result) => {
                        try {
                            await fetch('/api/receipts', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    imageBase64: result.imageBase64,
                                    ocrRawText: result.rawText,
                                    ocrMerchant: result.merchant,
                                    ocrDate: result.date,
                                    ocrAmount: result.amount,
                                    ocrCurrency: result.currency || 'IDR',
                                    ocrConfidence: result.confidence,
                                    verified: false, // Save as unverified
                                }),
                            });
                            fetchData();
                        } catch (error) {
                            console.error('Failed to save skipped receipt:', error);
                        }
                    }}
                    categories={categories}
                />
            </div>

            {/* History Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">History</h2>
                <div className="flex gap-2">
                    {/* Additional filters can go here */}
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 glass-card rounded-xl">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search merchant..."
                    className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                    value={filterVerified}
                    onChange={(e) => setFilterVerified(e.target.value as any)}
                    className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Status</option>
                    <option value="unverified">Unverified</option>
                </select>

                <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white hover:bg-gray-800 transition-colors"
                    title="Toggle Sort Order"
                >
                    <ArrowUpDown className="w-5 h-5" />
                </button>
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                </select>
            </div>

            {/* List View */}
            <div className="space-y-3">
                {filteredReceipts.map((receipt) => (
                    <div
                        key={receipt.id}
                        onClick={() => openEditReceipt(receipt)}
                        className="flex items-center gap-4 p-3 glass-card rounded-xl card-lift cursor-pointer hover:bg-gray-800/50 transition-colors"
                    >
                        {/* Thumbnail */}
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0 border border-gray-700 relative">
                            <img
                                src={`/api/receipts/${receipt.id}/image`}
                                alt="Receipt"
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                            {!receipt.verified && (
                                <div className="absolute top-0 right-0 w-3 h-3 bg-yellow-500 rounded-bl-lg" />
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">
                                {receipt.ocrMerchant || 'Unknown Merchant'}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>{receipt.ocrDate ? format(new Date(receipt.ocrDate), 'MMM d, yyyy') : 'No date'}</span>
                                {receipt.verified ? (
                                    <span className="flex items-center gap-0.5 text-green-400 text-xs bg-green-500/10 px-1.5 py-0.5 rounded">
                                        <Check className="w-3 h-3" /> Verified
                                    </span>
                                ) : (
                                    <span className="text-yellow-500 text-xs bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                        Needs Review
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex flex-col items-end gap-2">
                            <span className="font-bold text-white whitespace-nowrap">
                                {receipt.ocrCurrency} {receipt.ocrAmount?.toLocaleString()}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(receipt.id);
                                }}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {filteredReceipts.length === 0 && (
                    <EmptyState
                        icon={<Receipt className="w-8 h-8" />}
                        title="No receipts found"
                        description="Try adjusting your filters or scan a new receipt"
                    />
                )}
            </div>

            {/* Edit Modal */}
            {editingReceipt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Edit Receipt</h3>
                            <button
                                onClick={() => setEditingReceipt(null)}
                                className="p-2 text-gray-400 hover:text-white rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Image Preview */}
                            <div className="aspect-[3/4] bg-black rounded-xl overflow-hidden relative group">
                                {isLoadingReceipt ? (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                                    </div>
                                ) : receiptImage ? (
                                    <img
                                        src={receiptImage}
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
                                        onClick={() => setEditType('expense')}
                                        className={cn(
                                            'py-2 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all',
                                            editType === 'expense'
                                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                                                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                                        )}
                                    >
                                        <ArrowDownRight className="w-4 h-4" />
                                        Expense
                                    </button>
                                    <button
                                        onClick={() => setEditType('income')}
                                        className={cn(
                                            'py-2 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all',
                                            editType === 'income'
                                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                                                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                                        )}
                                    >
                                        <ArrowUpRight className="w-4 h-4" />
                                        Income
                                    </button>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-400 mb-1 block">Amount</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={editCurrency}
                                            onChange={(e) => setEditCurrency(e.target.value)}
                                            className="px-3 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                                        >
                                            {Object.keys(CURRENCIES).map((code) => (
                                                <option key={code} value={code}>{code}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(e.target.value)}
                                            className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500 text-lg font-bold"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-400 mb-1 block">Date</label>
                                    <input
                                        type="date"
                                        value={editDate}
                                        onChange={(e) => setEditDate(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-400 mb-1 block">Merchant</label>
                                    <input
                                        type="text"
                                        value={editMerchant}
                                        onChange={(e) => setEditMerchant(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                                        placeholder="Merchant name"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-400 mb-1 block">Category</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {categories
                                            .filter(c => c.type === editType)
                                            .map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setEditCategoryId(cat.id)}
                                                    className={cn(
                                                        'flex flex-col items-center gap-1 p-2 rounded-xl transition-all',
                                                        editCategoryId === cat.id
                                                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                                                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                                                    )}
                                                >
                                                    <span className="text-xl">{cat.icon}</span>
                                                    <span className="text-[10px] truncate w-full text-center">{cat.name}</span>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-800 flex gap-3">
                            <button
                                onClick={() => setEditingReceipt(null)}
                                className="flex-1 px-6 py-3 border border-gray-700 rounded-xl text-gray-300 font-medium hover:bg-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={isSaving || !editAmount || !editCategoryId}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? 'Saving...' : 'Update & Verify'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
