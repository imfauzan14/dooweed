import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

import { db } from '@/db';
import { receipts } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

// GET /api/receipts - List all receipts
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const verifiedOnly = searchParams.get('verified') === 'true';
        const limit = parseInt(searchParams.get('limit') || '50');

        const conditions = [eq(receipts.userId, user.id)];
        if (verifiedOnly) {
            conditions.push(eq(receipts.verified, true));
        }

        const result = await db
            .select({
                id: receipts.id,
                ocrMerchant: receipts.ocrMerchant,
                ocrDate: receipts.ocrDate,
                ocrAmount: receipts.ocrAmount,
                ocrCurrency: receipts.ocrCurrency,
                ocrConfidence: receipts.ocrConfidence,
                fileName: receipts.fileName,
                verified: receipts.verified,
                isAutomated: receipts.isAutomated, // Auto-pilot flag
                createdAt: receipts.createdAt,
                // Don't include base64 in list for performance
            })
            .from(receipts)
            .where(and(...conditions))
            .orderBy(desc(receipts.createdAt))
            .limit(limit);

        return NextResponse.json({ data: result });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error fetching receipts:', error);
        return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 });
    }
}

// POST /api/receipts - Upload a new receipt
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const {
            imageBase64,
            ocrRawText,
            ocrMerchant,
            ocrDate,
            ocrAmount,
            ocrCurrency,
            ocrConfidence,
            fileName,
            verified,
            isAutomated,
        } = body;

        if (!imageBase64) {
            return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
        }

        const id = uuid();
        const newReceipt = {
            id,
            userId: user.id,
            imageBase64,
            ocrRawText: ocrRawText || null,
            ocrMerchant: ocrMerchant || null,
            ocrDate: ocrDate || null,
            ocrAmount: ocrAmount ? parseFloat(ocrAmount) : null,
            ocrCurrency: ocrCurrency || null,
            ocrConfidence: ocrConfidence ? parseFloat(ocrConfidence) : null,
            fileName: fileName || null,
            verified: verified || false,
            isAutomated: isAutomated || false,
        };

        await db.insert(receipts).values(newReceipt);

        // Return without base64 for smaller response
        const { imageBase64: _, ...responseData } = newReceipt;
        return NextResponse.json({ data: { ...responseData, id } }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error uploading receipt:', error);
        return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 });
    }
}

// POST /api/receipts/batch - Upload multiple receipts
export async function PATCH(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const { receipts: receiptData } = body;

        if (!Array.isArray(receiptData) || receiptData.length === 0) {
            return NextResponse.json({ error: 'Receipts array is required' }, { status: 400 });
        }

        const insertedIds: string[] = [];

        for (const receipt of receiptData) {
            const id = uuid();
            await db.insert(receipts).values({
                id,
                userId: user.id,
                imageBase64: receipt.imageBase64,
                ocrRawText: receipt.ocrRawText || null,
                ocrMerchant: receipt.ocrMerchant || null,
                ocrDate: receipt.ocrDate || null,
                ocrAmount: receipt.ocrAmount ? parseFloat(receipt.ocrAmount) : null,
                ocrCurrency: receipt.ocrCurrency || null,
                ocrConfidence: receipt.ocrConfidence ? parseFloat(receipt.ocrConfidence) : null,
                verified: receipt.verified || false,
                isAutomated: receipt.isAutomated || false,
            });
            insertedIds.push(id);
        }

        return NextResponse.json({
            data: { insertedCount: insertedIds.length, ids: insertedIds },
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error batch uploading receipts:', error);
        return NextResponse.json({ error: 'Failed to batch upload receipts' }, { status: 500 });
    }
}
