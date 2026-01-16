import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { receipts, transactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request);
        const { id } = await params;

        const result = await db
            .select()
            .from(receipts)
            .where(and(eq(receipts.id, id), eq(receipts.userId, user.id)))
            .limit(1);

        if (result.length === 0) {
            return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
        }

        return NextResponse.json({ data: result[0] });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error fetching receipt:', error);
        return NextResponse.json({ error: 'Failed to fetch receipt' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request);
        const { id } = await params;
        const body = await request.json();
        const { ocrMerchant, ocrDate, ocrAmount, ocrCurrency, verified, isAutomated } = body;

        const existing = await db
            .select()
            .from(receipts)
            .where(and(eq(receipts.id, id), eq(receipts.userId, user.id)))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
        }

        const updateValues: Partial<typeof receipts.$inferInsert> = {};
        if (ocrMerchant !== undefined) updateValues.ocrMerchant = ocrMerchant;
        if (ocrDate !== undefined) updateValues.ocrDate = ocrDate;
        if (ocrAmount !== undefined) updateValues.ocrAmount = parseFloat(ocrAmount);
        if (ocrCurrency !== undefined) updateValues.ocrCurrency = ocrCurrency;
        if (verified !== undefined) updateValues.verified = verified;
        if (isAutomated !== undefined) updateValues.isAutomated = isAutomated;

        await db.update(receipts).set(updateValues).where(eq(receipts.id, id));

        // Return without base64
        const updated = await db
            .select({
                id: receipts.id,
                ocrMerchant: receipts.ocrMerchant,
                ocrDate: receipts.ocrDate,
                ocrAmount: receipts.ocrAmount,
                ocrCurrency: receipts.ocrCurrency,
                ocrConfidence: receipts.ocrConfidence,
                verified: receipts.verified,
            })
            .from(receipts)
            .where(eq(receipts.id, id))
            .limit(1);

        return NextResponse.json({ data: updated[0] });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error updating receipt:', error);
        return NextResponse.json({ error: 'Failed to update receipt' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request);
        const { id } = await params;

        const existing = await db
            .select()
            .from(receipts)
            .where(and(eq(receipts.id, id), eq(receipts.userId, user.id)))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
        }

        // Delete associated transactions
        await db
            .delete(transactions)
            .where(eq(transactions.receiptId, id));

        await db.delete(receipts).where(eq(receipts.id, id));

        return NextResponse.json({ message: 'Receipt deleted successfully' });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error deleting receipt:', error);
        return NextResponse.json({ error: 'Failed to delete receipt' }, { status: 500 });
    }
}
