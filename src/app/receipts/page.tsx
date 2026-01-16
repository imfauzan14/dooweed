'use client';

import { useState, useEffect } from 'react';
import { Camera, Receipt, X, Trash2, Check, ArrowUpRight, ArrowDownRight, ArrowUpDown, Zap, CheckSquare, Square } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/Navigation';
import { ReceiptScanner } from '@/components/ReceiptScanner';
import { ReceiptEditModal } from '@/components/ReceiptEditModal';
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
    isAutomated?: boolean;
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

    // Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);


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
        if (!confirm(`Delete ${selectedIds.size} receipts?`)) return;

        setIsDeleting(true);
        try {
            // Delete sequentially to ensure cascades work (or use Promise.all)
            await Promise.all(
                Array.from(selectedIds).map(id =>
                    fetch(`/api/receipts/${id}`, { method: 'DELETE' })
                )
            );
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            fetchData();
        } catch (error) {
            console.error('Failed to delete receipts:', error);
        } finally {
            setIsDeleting(false);
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

    const openEditReceipt = (receipt: SavedReceipt) => {
        setEditingReceipt(receipt);
    };



    if (isLoading && savedReceipts.length === 0) {
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
                    {isSelectionMode ? (
                        <>
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={isDeleting}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm"
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
                                className="p-1.5 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsSelectionMode(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors text-sm"
                        >
                            <CheckSquare className="w-4 h-4" />
                            Select
                        </button>
                    )}
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
                        onClick={() => isSelectionMode ? toggleSelection(receipt.id) : openEditReceipt(receipt)}
                        className={cn(
                            "relative z-10 grid gap-3 items-center p-3 rounded-xl transition-all group hover:shadow-lg border border-gray-800/50 cursor-pointer",
                            isSelectionMode
                                ? "grid-cols-[auto_auto_1fr_auto]"
                                : "grid-cols-[auto_1fr_auto]",
                            selectedIds.has(receipt.id) ? "bg-blue-500/10 border-blue-500/30" : "bg-gray-900/40 hover:bg-gray-800/50"
                        )}
                    >
                        {isSelectionMode && (
                            <div className="text-gray-400 mr-1">
                                {selectedIds.has(receipt.id) ? (
                                    <CheckSquare className="w-5 h-5 text-blue-500" />
                                ) : (
                                    <Square className="w-5 h-5" />
                                )}
                            </div>
                        )}
                        {/* Thumbnail */}
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-900 rounded-lg overflow-hidden border border-gray-700 relative">
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
                        <div className="min-w-0 overflow-hidden">
                            <p className="font-medium text-sm sm:text-base text-white truncate w-full">
                                {receipt.ocrMerchant || 'Unknown Merchant'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500 mt-1">
                                <span className="whitespace-nowrap flex-shrink-0">{receipt.ocrDate ? format(new Date(receipt.ocrDate), 'MMM d, yyyy') : 'No date'}</span>
                                {(() => {
                                    // Legacy check for older data
                                    const isAuto = receipt.ocrMerchant?.includes('[AUTOMATED]');
                                    if (isAuto) {
                                        return (
                                            <span className="flex-shrink-0 flex items-center gap-0.5 text-blue-400 text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                <Zap className="w-3 h-3" /> Auto
                                            </span>
                                        );
                                    }
                                    return receipt.verified ? (
                                        <span className="flex-shrink-0 flex items-center gap-0.5 text-green-400 text-[10px] bg-green-500/10 px-1.5 py-0.5 rounded">
                                            <Check className="w-3 h-3" /> <span className="hidden sm:inline">Verified</span><span className="sm:hidden">Verif</span>
                                        </span>
                                    ) : (
                                        <span className="flex-shrink-0 text-yellow-500 text-[10px] bg-yellow-500/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                                            Needs Review
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex flex-col items-end gap-1 sm:gap-2 self-start pt-1">
                            <span className="font-bold text-white text-sm sm:text-base whitespace-nowrap">
                                {receipt.ocrCurrency} {receipt.ocrAmount?.toLocaleString()}
                            </span>
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
                <ReceiptEditModal
                    isOpen={!!editingReceipt}
                    onClose={() => setEditingReceipt(null)}
                    receiptId={editingReceipt.id}
                    onSuccess={fetchData}
                />
            )}
        </div>
    );
}
