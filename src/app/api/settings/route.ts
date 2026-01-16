import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/settings?key=currencyFallbackRates
 * Retrieve a specific setting by key
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!key) {
            return NextResponse.json(
                { error: 'Missing key parameter' },
                { status: 400 }
            );
        }

        const setting = await db.select()
            .from(settings)
            .where(eq(settings.key, key))
            .limit(1);

        if (setting.length === 0) {
            return NextResponse.json(
                { error: 'Setting not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                key: setting[0].key,
                value: JSON.parse(setting[0].value),
                updatedAt: setting[0].updatedAt,
            }
        });
    } catch (error) {
        console.error('[Settings API] GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch setting' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/settings
 * Update a setting
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { key, value } = body;

        if (!key || value === undefined) {
            return NextResponse.json(
                { error: 'Missing key or value' },
                { status: 400 }
            );
        }

        // Validate currency fallback rates structure if that's what we're updating
        if (key === 'currencyFallbackRates') {
            if (typeof value !== 'object' || value === null) {
                return NextResponse.json(
                    { error: 'Currency fallback rates must be an object' },
                    { status: 400 }
                );
            }
        }

        const existingSetting = await db.select()
            .from(settings)
            .where(eq(settings.key, key))
            .limit(1);

        if (existingSetting.length === 0) {
            // Insert new setting
            await db.insert(settings).values({
                id: `setting-${key}-${Date.now()}`,
                key,
                value: JSON.stringify(value),
            });
        } else {
            // Update existing setting
            await db.update(settings)
                .set({
                    value: JSON.stringify(value),
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(settings.key, key));
        }

        return NextResponse.json({
            success: true,
            data: { key, value }
        });
    } catch (error) {
        console.error('[Settings API] PUT error:', error);
        return NextResponse.json(
            { error: 'Failed to update setting' },
            { status: 500 }
        );
    }
}
