'use client';

import { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CURRENCIES } from '@/lib/currency';

interface ReceiptViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    receiptId: string;
    onEdit: () => void;
}

export function ReceiptViewModal({
    isOpen,
    onClose,
    receiptId,
    onEdit,
}: ReceiptViewModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        if (isOpen && receiptId) {
            loadData();
        }
    }, [isOpen, receiptId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/receipts/${receiptId}`);
            const json = await res.json();

            if (json.data) {
                const r = json.data;
                setData(r);
                setImageUrl(`/api/receipts/${r.id}/image`);
            }
        } catch (error) {
            console.error('Failed to load receipt:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Receipt Details</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                onClose();
                                onEdit();
                            }}
                            className="p-2 text-blue-400 hover:text-white hover:bg-blue-500/20 rounded-lg transition-colors"
                        >
                            <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Image */}
                    <div className="aspect-[3/4] bg-black rounded-xl overflow-hidden relative group border border-gray-800">
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

                    {/* Details */}
                    {data && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-800/50 rounded-xl">
                                    <span className="text-xs text-gray-400 block mb-1">Amount</span>
                                    <span className="text-lg font-bold text-white">
                                        {data.ocrCurrency} {data.ocrAmount?.toLocaleString()}
                                    </span>
                                </div>
                                <div className="p-3 bg-gray-800/50 rounded-xl">
                                    <span className="text-xs text-gray-400 block mb-1">Date</span>
                                    <span className="text-lg font-medium text-white">
                                        {data.ocrDate}
                                    </span>
                                </div>
                            </div>

                            <div className="p-3 bg-gray-800/50 rounded-xl">
                                <span className="text-xs text-gray-400 block mb-1">Merchant</span>
                                <span className="text-lg font-medium text-white">
                                    {(data.ocrMerchant || 'Unknown Merchant')}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
                                {data.verified && (
                                    <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs">
                                        Verified
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
