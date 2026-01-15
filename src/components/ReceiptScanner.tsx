'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Upload, X, Check, AlertCircle, Loader2, Image as ImageIcon,
    ChevronLeft, ChevronRight, Save, Trash2, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractReceiptData, compressImage, type OCRResult } from '@/lib/ocr';
import { CURRENCIES } from '@/lib/currency';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

interface ScanResult extends OCRResult {
    imageBase64: string;
    status: 'processing' | 'completed' | 'error';
    error?: string;
    editedType?: 'income' | 'expense';
    editedAmount?: number;
    editedDate?: string;
    editedMerchant?: string;
    editedCategoryId?: string;
}

interface ReceiptScannerProps {
    onScanComplete?: (results: ScanResult[]) => void;
    onCreateTransaction?: (result: ScanResult) => void;
    onSkip?: (result: ScanResult) => void;
    categories?: Category[];
}

export function ReceiptScanner({ onScanComplete, onCreateTransaction, onSkip, categories = [] }: ReceiptScannerProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [results, setResults] = useState<ScanResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const completedResults = results.filter(r => r.status === 'completed');

    const processFiles = useCallback(async (files: File[]) => {
        if (files.length === 0) return;

        setIsProcessing(true);
        setIsReviewMode(false);
        const newResults: ScanResult[] = [];
        const startIndex = results.length;

        const processingResults: ScanResult[] = files.map(() => ({
            imageBase64: '',
            rawText: '',
            merchant: null,
            date: null,
            amount: null,
            currency: null,
            confidence: 0,
            items: [],
            transactionType: null,
            status: 'processing' as const,
        }));

        setResults(prev => [...prev, ...processingResults]);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            const index = startIndex + i;

            try {
                const imageBase64 = await compressImage(file);
                const ocrResult = await extractReceiptData(imageBase64);

                const completedResult: ScanResult = {
                    ...ocrResult,
                    imageBase64,
                    status: 'completed',
                    editedType: ocrResult.transactionType || 'expense',
                    editedAmount: ocrResult.amount || undefined,
                    editedDate: ocrResult.date || format(new Date(), 'yyyy-MM-dd'),
                    editedMerchant: ocrResult.merchant || '',
                };

                setResults(prev => {
                    const updated = [...prev];
                    updated[index] = completedResult;
                    return updated;
                });

                newResults.push(completedResult);
            } catch (error) {
                setResults(prev => {
                    const updated = [...prev];
                    updated[index] = {
                        ...processingResults[i],
                        status: 'error',
                        error: error instanceof Error ? error.message : 'OCR failed',
                    };
                    return updated;
                });
            }
        }

        setIsProcessing(false);

        if (newResults.length > 0) {
            setIsReviewMode(true);
            setCurrentIndex(0);
        }
    }, [results.length]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(Array.from(e.dataTransfer.files));
    }, [processFiles]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        processFiles(e.target.files ? Array.from(e.target.files) : []);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [processFiles]);

    const updateResult = (index: number, updates: Partial<ScanResult>) => {
        setResults(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...updates };
            return updated;
        });
    };

    const removeResult = (index: number) => {
        setResults(prev => prev.filter((_, i) => i !== index));
        if (currentIndex >= results.length - 1) {
            setCurrentIndex(Math.max(0, currentIndex - 1));
        }
    };

    const handleSaveAndNext = async () => {
        const result = completedResults[currentIndex];
        if (!result || !result.editedAmount) return;

        onCreateTransaction?.(result);

        if (currentIndex < completedResults.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setIsReviewMode(false);
            setResults([]);
        }
    };

    const handleSkip = () => {
        const result = completedResults[currentIndex];
        if (result) {
            onSkip?.(result);
        }

        if (currentIndex < completedResults.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setIsReviewMode(false);
            setResults([]);
        }
    };

    const handleSaveAll = async () => {
        for (const result of completedResults) {
            if (result.editedAmount) {
                onCreateTransaction?.(result);
            }
        }
        setIsReviewMode(false);
        setResults([]);
    };

    const currentResult = completedResults[currentIndex];
    const filteredCategories = categories.filter(c => c.type === currentResult?.editedType);

    return (
        <div className="space-y-6">
            {/* Drop Zone */}
            {!isReviewMode && (
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                        'relative border-2 border-dashed rounded-2xl p-6 md:p-8 text-center cursor-pointer transition-all',
                        isDragging
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                    )}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <div className="flex flex-col items-center gap-3 md:gap-4">
                        <div className={cn('p-3 md:p-4 rounded-full transition-colors', isDragging ? 'bg-blue-500/20' : 'bg-gray-700/50')}>
                            <Upload className={cn('w-6 h-6 md:w-8 md:h-8', isDragging ? 'text-blue-400' : 'text-gray-400')} />
                        </div>
                        <div>
                            <p className="text-base md:text-lg font-medium text-white">
                                {isDragging ? 'Drop receipts here' : 'Upload receipt images'}
                            </p>
                            <p className="text-xs md:text-sm text-gray-500 mt-1">
                                Drag & drop or tap to select • Batch upload supported
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Processing */}
            {isProcessing && (
                <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <span className="text-gray-400">Processing receipts...</span>
                </div>
            )}


            {/* Review Mode Modal - Portaled to avoid stacking context issues */}
            {isReviewMode && currentResult && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <div>
                                <h3 className="text-lg font-bold text-white">Review Receipt</h3>
                                <p className="text-xs text-gray-400">
                                    {currentIndex + 1} of {completedResults.length} scanned
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {completedResults.length > 1 && (
                                    <div className="flex gap-1 mr-2 bg-gray-800 rounded-lg p-1">
                                        <button
                                            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                                            disabled={currentIndex === 0}
                                            className="p-1.5 rounded-md disabled:opacity-30 hover:bg-gray-700 text-gray-400 transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setCurrentIndex(Math.min(completedResults.length - 1, currentIndex + 1))}
                                            disabled={currentIndex >= completedResults.length - 1}
                                            className="p-1.5 rounded-md disabled:opacity-30 hover:bg-gray-700 text-gray-400 transition-colors"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={() => { setIsReviewMode(false); setResults([]); }}
                                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Image Preview */}
                            <div className="aspect-[3/4] bg-black rounded-xl overflow-hidden relative group border border-gray-800">
                                {currentResult.imageBase64 ? (
                                    <img
                                        src={currentResult.imageBase64}
                                        alt="Receipt"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-700">
                                        <ImageIcon className="w-12 h-12" />
                                    </div>
                                )}
                                {/* Confidence Badge Overlay */}
                                <div className="absolute top-2 right-2">
                                    <span className={cn(
                                        'px-2 py-1 rounded-lg text-xs font-bold shadow-lg backdrop-blur-md',
                                        currentResult.confidence > 0.7 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                            currentResult.confidence > 0.4 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    )}>
                                        {Math.round(currentResult.confidence * 100)}% Conf.
                                    </span>
                                </div>
                            </div>

                            {/* Form */}
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => updateResult(results.indexOf(currentResult), { editedType: 'expense', editedCategoryId: undefined })}
                                        className={cn(
                                            'py-2 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all',
                                            currentResult.editedType === 'expense'
                                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                                                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                                        )}
                                    >
                                        <ArrowDownRight className="w-4 h-4" />
                                        Expense
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateResult(results.indexOf(currentResult), { editedType: 'income', editedCategoryId: undefined })}
                                        className={cn(
                                            'py-2 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all',
                                            currentResult.editedType === 'income'
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
                                            value={currentResult.currency || 'IDR'}
                                            onChange={(e) => updateResult(results.indexOf(currentResult), { currency: e.target.value })}
                                            className="px-3 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                                        >
                                            {Object.keys(CURRENCIES).map((code) => (
                                                <option key={code} value={code}>{code}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={currentResult.editedAmount || ''}
                                            onChange={(e) => updateResult(results.indexOf(currentResult), { editedAmount: parseFloat(e.target.value) || undefined })}
                                            className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500 text-lg font-bold"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-400 mb-1 block">Date</label>
                                    <input
                                        type="date"
                                        value={currentResult.editedDate || ''}
                                        onChange={(e) => updateResult(results.indexOf(currentResult), { editedDate: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-400 mb-1 block">Merchant</label>
                                    <input
                                        type="text"
                                        value={currentResult.editedMerchant || ''}
                                        onChange={(e) => updateResult(results.indexOf(currentResult), { editedMerchant: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                                        placeholder="Merchant name"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-400 mb-1 block">Category</label>
                                    <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                                        {filteredCategories.map((cat) => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => updateResult(results.indexOf(currentResult), { editedCategoryId: cat.id })}
                                                className={cn(
                                                    'flex flex-col items-center gap-1 p-2 rounded-xl transition-all',
                                                    currentResult.editedCategoryId === cat.id
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

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-gray-800 bg-gray-900/95 backdrop-blur safe-area-bottom">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => removeResult(results.indexOf(currentResult))}
                                    className="p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                                    title="Delete Receipt"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleSkip}
                                    className="px-6 py-3 border border-gray-700 rounded-xl text-gray-300 font-medium hover:bg-gray-800 transition-colors"
                                >
                                    Skip
                                </button>
                                <button
                                    onClick={handleSaveAndNext}
                                    disabled={!currentResult.editedAmount || !currentResult.editedCategoryId}
                                    className={cn(
                                        'flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition-all',
                                        currentResult.editedAmount && currentResult.editedCategoryId
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]'
                                            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                                    )}
                                >
                                    <Check className="w-5 h-5" />
                                    {currentIndex < completedResults.length - 1 ? 'Save & Next' : 'Finish Review'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
