'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Upload, X, Check, AlertCircle, Loader2, Image as ImageIcon,
    ChevronLeft, ChevronRight, Save, Trash2, ArrowDownRight, ArrowUpRight,
    Zap, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractReceiptData, compressImage, type OCRResult } from '@/lib/ocr';
import { CURRENCIES } from '@/lib/currency';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';

interface EnhancedOCRResult {
    enhancementUsed?: boolean;
    processingTime?: number;
}

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
    isAutomated?: boolean;
    fileName?: string;
    isDuplicateWarning?: boolean;
}

interface ReceiptScannerProps {
    onScanComplete?: (results: ScanResult[]) => void;
    onCreateTransaction?: (result: ScanResult) => void;
    onSkip?: (result: ScanResult) => void;
    onBatchComplete?: () => void;
    categories?: Category[];
    existingReceipts?: any[];
}

interface UploadProgress {
    filename: string;
    status: 'waiting' | 'processing' | 'complete' | 'error';
    progress: number; // 0-100
    currentStep?: string;
}

export function ReceiptScanner({ onScanComplete, onCreateTransaction, onSkip, onBatchComplete, categories = [], existingReceipts = [] }: ReceiptScannerProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [results, setResults] = useState<ScanResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [useEnhancement, setUseEnhancement] = useState(true); // DeepSeek enhancement toggle
    const [isAutoMode, setIsAutoMode] = useState(false); // New Auto Mode toggle
    const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Track processed file signatures (name + size) to prevent duplicates in current session
    const [processedSignatures, setProcessedSignatures] = useState<Set<string>>(new Set());

    const completedResults = results.filter(r => r.status === 'completed');

    const processFiles = useCallback(async (files: File[]) => {
        if (files.length === 0) return;

        // Filter duplicates
        const uniqueFiles: File[] = [];
        const ignoredFiles: string[] = [];

        for (const file of files) {
            // Check 1: Session-based duplicate (exact file object or name+size in current batch)
            const signature = `${file.name}-${file.size}`;

            // Check 2: Database-based duplicate (filename match against existing receipts)
            // Note: matching by filename is what the user requested ("filename that are already inside the data")
            const isDbDuplicate = existingReceipts.some(r => r.fileName === file.name);

            if (processedSignatures.has(signature) || isDbDuplicate) {
                ignoredFiles.push(file.name);
            } else {
                uniqueFiles.push(file);
                setProcessedSignatures(prev => new Set(prev).add(signature));
            }
        }

        if (ignoredFiles.length > 0) {
            alert(`Skipped ${ignoredFiles.length} duplicate file(s) (already exists):\n${ignoredFiles.join('\n')}`);
        }

        // If all files were duplicates, cleanup and return
        if (uniqueFiles.length === 0) {
            setIsProcessing(false);
            setUploadProgress([]);
            return;
        }

        setIsProcessing(true);
        // If not in auto mode, prepare for review. In auto mode, we stay on the screen.
        if (!isAutoMode) {
            setIsReviewMode(false);
        }

        const newResults: ScanResult[] = [];
        const startIndex = results.length;

        // Initialize progress tracking
        const initialProgress: UploadProgress[] = uniqueFiles.map((file) => ({
            filename: file.name,
            status: 'waiting' as const,
            progress: 0,
        }));
        setUploadProgress(initialProgress);

        const processingResults: ScanResult[] = uniqueFiles.map(() => ({
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

        for (let i = 0; i < uniqueFiles.length; i++) {
            const file = uniqueFiles[i];

            const index = startIndex + i;

            // Update to processing
            setUploadProgress(prev => {
                const updated = [...prev];
                updated[i] = { ...updated[i], status: 'processing', progress: 10 };
                return updated;
            });

            try {
                // Compress image - 30% progress
                const compressedImage = await compressImage(file);
                setUploadProgress(prev => {
                    const updated = [...prev];
                    updated[i] = { ...updated[i], progress: 30, currentStep: 'Compressed' };
                    return updated;
                });

                // Step 1: Always run Tesseract client-side - 50% progress
                const tesseractResult = await extractReceiptData(compressedImage);
                setUploadProgress(prev => {
                    const updated = [...prev];
                    updated[i] = { ...updated[i], progress: 50, currentStep: 'OCR complete' };
                    return updated;
                });

                // Step 2: If enhancement enabled, send raw text to DeepSeek API
                let ocrResult: OCRResult & EnhancedOCRResult = tesseractResult;

                if (useEnhancement && tesseractResult.rawText) {
                    try {
                        const response = await fetch('/api/ocr-enhanced', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rawText: tesseractResult.rawText }),
                        });

                        if (response.ok) {
                            const { data } = await response.json();
                            // Merge DeepSeek results with Tesseract fallback
                            ocrResult = {
                                rawText: tesseractResult.rawText,
                                merchant: data.merchant || tesseractResult.merchant,
                                date: data.date || tesseractResult.date,
                                amount: data.amount ?? tesseractResult.amount,
                                currency: data.currency || tesseractResult.currency,
                                transactionType: data.transactionType || tesseractResult.transactionType,
                                confidence: data.confidence ?? tesseractResult.confidence,
                                items: data.items || tesseractResult.items,
                                enhancementUsed: true,
                            };
                            console.log('[ReceiptScanner] ✅ DeepSeek enhancement used');
                            setUploadProgress(prev => {
                                const updated = [...prev];
                                updated[i] = { ...updated[i], progress: 80, currentStep: 'AI enhanced' };
                                return updated;
                            });
                        } else {
                            throw new Error('API returned error');
                        }
                    } catch (error) {
                        console.warn('[ReceiptScanner] DeepSeek failed, using Tesseract:', error);
                        ocrResult = { ...tesseractResult, enhancementUsed: false };
                    }
                }

                const merchantName = ocrResult.merchant || '';
                const finalMerchantName = merchantName;

                const completedResult: ScanResult = {
                    ...ocrResult,
                    imageBase64: compressedImage,
                    status: 'completed',
                    editedType: ocrResult.transactionType || 'expense',
                    editedAmount: ocrResult.amount ? Math.abs(ocrResult.amount) : undefined,
                    editedDate: (ocrResult.date && /^\d{4}-\d{2}-\d{2}$/.test(ocrResult.date)) ? ocrResult.date : format(new Date(), 'yyyy-MM-dd'),
                    editedMerchant: finalMerchantName,
                    isAutomated: isAutoMode,
                    fileName: file.name,
                };

                setResults(prev => {
                    const updated = [...prev];
                    updated[index] = completedResult;
                    return updated;
                });

                newResults.push(completedResult);

                // In Auto Mode, save immediately
                if (isAutoMode) {
                    await onCreateTransaction?.(completedResult); // Await to ensure seq
                }

                // Mark as complete
                setUploadProgress(prev => {
                    const updated = [...prev];
                    updated[i] = { ...updated[i], status: 'complete', progress: 100 };
                    return updated;
                });
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

                // Mark as error
                setUploadProgress(prev => {
                    const updated = [...prev];
                    updated[i] = { ...updated[i], status: 'error', progress: 0 };
                    return updated;
                });
            }
        }

        setIsProcessing(false);

        // Clear progress after 3 seconds
        setTimeout(() => {
            setUploadProgress([]);
        }, 3000);

        // Batch complete notification
        if (isAutoMode) {
            onBatchComplete?.(); // Auto mode: refresh immediately after saving
            setResults([]);
        } else if (newResults.length > 0) {
            // Manual mode: open review modal
            // onBatchComplete will be called after user finishes reviewing (in handleSaveAndNext/handleSkip)
            setIsReviewMode(true);
            setCurrentIndex(0);
        }
    }, [results.length, useEnhancement, isAutoMode, onCreateTransaction, onBatchComplete, processedSignatures]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(Array.from(e.dataTransfer.files));
    }, [processFiles]);

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Validate file sizes (max 10MB per file)
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                alert(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`);
                if (fileInputRef.current) fileInputRef.current.value = ''; // Clear input even if one file fails
                return;
            }
        }

        setIsProcessing(true);
        processFiles(files);
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

        await onCreateTransaction?.(result); // Wait for save to complete

        // Advance to next receipt if available
        // Note: completedResults is derived from results state.
        // We're iterating through them.
        if (currentIndex < completedResults.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            // Last item - wait a bit for database to settle before refreshing
            setIsReviewMode(false);
            setResults([]);
            setTimeout(() => {
                onBatchComplete?.();
            }, 100); // Small delay to ensure DB writes complete
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
            setTimeout(() => {
                onBatchComplete?.();
            }, 100); // Small delay to ensure DB writes complete
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
        onBatchComplete?.();
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
                    className={cn(
                        'relative border-2 border-dashed rounded-2xl p-6 md:p-8 text-center transition-all bg-gray-800/30',
                        isDragging
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                    )}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    <div className="flex flex-col items-center gap-3 md:gap-4 pointer-events-none">
                        <div className={cn('p-3 md:p-4 rounded-full transition-colors', isDragging ? 'bg-blue-500/20' : 'bg-gray-700/50')}>
                            <Upload className={cn('w-6 h-6 md:w-8 md:h-8', isDragging ? 'text-blue-400' : 'text-gray-400')} />
                        </div>
                        <div>
                            <h3 className="text-base md:text-lg font-bold text-white">
                                Drop receipts here
                            </h3>
                            <p className="text-xs md:text-sm text-gray-400 mt-1">
                                Supports JPG, PNG, WebP (max 10MB)
                            </p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-6 relative z-10 w-full max-w-2xl mx-auto">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 w-full md:w-auto"
                        >
                            Browse Files
                        </button>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            {/* Mode Toggle */}
                            <div className="flex bg-gray-800/50 p-1 rounded-xl border border-gray-700/50 backdrop-blur-sm">
                                <button
                                    onClick={() => setIsAutoMode(false)}
                                    className={cn(
                                        "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                                        !isAutoMode
                                            ? "bg-gray-700 text-white shadow-md"
                                            : "text-gray-400 hover:text-white"
                                    )}
                                >
                                    <Eye className="w-4 h-4" />
                                    Manual Review
                                </button>
                                <button
                                    onClick={() => setIsAutoMode(true)}
                                    className={cn(
                                        "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                                        isAutoMode
                                            ? "bg-green-500 text-white shadow-md shadow-green-500/20"
                                            : "text-gray-400 hover:text-white"
                                    )}
                                >
                                    <Zap className="w-4 h-4" />
                                    Auto Pilot
                                </button>
                            </div>

                            {/* Enhancement Toggle */}
                            <button
                                onClick={() => setUseEnhancement(!useEnhancement)}
                                className={cn(
                                    "px-4 py-2 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2",
                                    useEnhancement
                                        ? "bg-purple-500/10 border-purple-500 text-purple-400"
                                        : "bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600"
                                )}
                            >
                                <span>✨ AI Enhanced</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Processing */}
            {isProcessing && (
                <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <span className="text-gray-400">
                        {isAutoMode ? "Processing & Saving..." : "Processing receipts..."}
                    </span>
                </div>
            )}

            {/* Upload Progress Indicator */}
            {uploadProgress.length > 0 && (
                <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl max-w-sm z-50 animate-in slide-in-from-bottom-4">
                    <h3 className="font-bold text-sm mb-3 text-white">
                        {isAutoMode ? "Auto-Processing" : "Processing"} {uploadProgress.length} receipt{uploadProgress.length > 1 ? 's' : ''}
                    </h3>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {uploadProgress.map((item, idx) => (
                            <div key={idx} className="space-y-1">
                                <div className="flex items-center gap-2 text-xs">
                                    {item.status === 'complete' && <Check className="w-3 h-3 text-green-400 flex-shrink-0" />}
                                    {item.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-blue-400 flex-shrink-0" />}
                                    {item.status === 'error' && <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                                    {item.status === 'waiting' && <div className="w-3 h-3 rounded-full bg-gray-600 flex-shrink-0" />}
                                    <span className="truncate text-gray-300 flex-1">{item.filename}</span>
                                    {item.currentStep && <span className="text-gray-500 text-[10px]">{item.currentStep}</span>}
                                </div>
                                {item.status === 'processing' && (
                                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                            style={{ width: `${item.progress}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {/* Review Mode Modal - Portaled to avoid stacking context issues */}
            {isReviewMode && currentResult && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    Review Receipt
                                    {completedResults.length > 1 && (
                                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-normal">
                                            {currentIndex + 1}/{completedResults.length}
                                        </span>
                                    )}
                                </h3>

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
                                    <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">Amount</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={currentResult.currency || 'IDR'}
                                            onChange={(e) => updateResult(results.indexOf(currentResult), { currency: e.target.value })}
                                            className="px-3 py-2.5 sm:py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-sm sm:text-base text-white outline-none focus:border-blue-500"
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
                                            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500 text-base sm:text-lg font-bold"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">Date</label>
                                    <input
                                        type="date"
                                        value={currentResult.editedDate || ''}
                                        onChange={(e) => updateResult(results.indexOf(currentResult), { editedDate: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-sm sm:text-base text-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">Merchant</label>
                                    <input
                                        type="text"
                                        value={currentResult.editedMerchant || ''}
                                        onChange={(e) => updateResult(results.indexOf(currentResult), { editedMerchant: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-sm sm:text-base text-white outline-none focus:border-blue-500"
                                        placeholder="Merchant name"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">Category (Optional)</label>
                                    <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                                        {/* Uncategorized option */}
                                        <button
                                            type="button"
                                            onClick={() => updateResult(results.indexOf(currentResult), { editedCategoryId: undefined })}
                                            className={cn(
                                                'flex flex-col items-center gap-1 p-2 rounded-xl transition-all',
                                                !currentResult.editedCategoryId
                                                    ? 'bg-gray-600 text-white shadow-lg'
                                                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                                            )}
                                        >
                                            <span className="text-lg">∅</span>
                                            <span className="text-[10px] font-medium">None</span>
                                        </button>
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
                                                <span className="text-[10px] line-clamp-2 w-full text-center">{cat.name}</span>
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
                                    Later
                                </button>
                                <button
                                    onClick={handleSaveAndNext}
                                    disabled={!currentResult.editedAmount}
                                    className={cn(
                                        'flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition-all',
                                        currentResult.editedAmount
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]'
                                            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                                    )}
                                >
                                    <Check className="w-5 h-5" />
                                    {currentIndex < completedResults.length - 1 ? 'Save & Next' : 'Save & Finish'}
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
