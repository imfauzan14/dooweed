import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { receipts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || 'default-user';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const result = await db
            .select({
                imageBase64: receipts.imageBase64,
            })
            .from(receipts)
            .where(and(eq(receipts.id, id), eq(receipts.userId, DEFAULT_USER_ID)))
            .limit(1);

        if (result.length === 0) {
            return new NextResponse('Not found', { status: 404 });
        }

        const imageBase64 = result[0].imageBase64;

        // Extract content type and data
        // Format: data:image/jpeg;base64,...
        const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
            return new NextResponse('Invalid image data', { status: 500 });
        }

        const contentType = matches[1];
        const data = Buffer.from(matches[2], 'base64');

        return new NextResponse(data, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Error serving receipt image:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
