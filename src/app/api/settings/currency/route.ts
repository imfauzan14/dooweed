import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { currencyPreferences } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// GET /api/settings/currency - Get user's currency preferences
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        // Try to fetch user's preferences
        const prefs = await db
            .select()
            .from(currencyPreferences)
            .where(eq(currencyPreferences.userId, user.id))
            .get();

        // If no preferences exist, return defaults
        if (!prefs) {
            return NextResponse.json({
                success: true,
                data: {
                    fallbackOrder: ['api', 'llm', 'custom'],
                    enabledMethods: ['api', 'llm', 'custom'],
                    customRates: {
                        USD: { IDR: 16850 },
                        EUR: { IDR: 18150 },
                        GBP: { IDR: 21350 },
                        SGD: { IDR: 12470 },
                        JPY: { IDR: 107 },
                        CNY: { IDR: 2325 },
                    },
                },
            });
        }

        // Parse JSON strings
        return NextResponse.json({
            success: true,
            data: {
                fallbackOrder: JSON.parse(prefs.fallbackOrder),
                enabledMethods: JSON.parse(prefs.enabledMethods),
                customRates: prefs.customRates ? JSON.parse(prefs.customRates) : {},
            },
        });
    } catch (error: any) {
        console.error('[Currency Settings API] GET error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch currency preferences' },
            { status: 500 }
        );
    }
}

// POST /api/settings/currency - Save user's currency preferences
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();

        const { fallbackOrder, enabledMethods, customRates } = body;

        // Validation
        if (!Array.isArray(fallbackOrder) || fallbackOrder.length === 0) {
            return NextResponse.json(
                { success: false, error: 'fallbackOrder must be a non-empty array' },
                { status: 400 }
            );
        }

        if (!Array.isArray(enabledMethods) || enabledMethods.length === 0) {
            return NextResponse.json(
                { success: false, error: 'At least one fallback method must be enabled' },
                { status: 400 }
            );
        }

        // Ensure API is always in enabled methods (required)
        if (!enabledMethods.includes('api')) {
            return NextResponse.json(
                { success: false, error: 'API method cannot be disabled' },
                { status: 400 }
            );
        }

        // Validate custom rates if provided
        if (customRates && typeof customRates !== 'object') {
            return NextResponse.json(
                { success: false, error: 'customRates must be an object' },
                { status: 400 }
            );
        }

        // Check if preferences already exist
        const existing = await db
            .select()
            .from(currencyPreferences)
            .where(eq(currencyPreferences.userId, user.id))
            .get();

        const now = new Date();

        if (existing) {
            // Update existing preferences
            await db
                .update(currencyPreferences)
                .set({
                    fallbackOrder: JSON.stringify(fallbackOrder),
                    enabledMethods: JSON.stringify(enabledMethods),
                    customRates: customRates ? JSON.stringify(customRates) : null,
                    updatedAt: now,
                })
                .where(eq(currencyPreferences.userId, user.id));
        } else {
            // Create new preferences
            await db.insert(currencyPreferences).values({
                id: nanoid(),
                userId: user.id,
                fallbackOrder: JSON.stringify(fallbackOrder),
                enabledMethods: JSON.stringify(enabledMethods),
                customRates: customRates ? JSON.stringify(customRates) : null,
                updatedAt: now,
                createdAt: now,
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Currency preferences saved successfully',
        });
    } catch (error: any) {
        console.error('[Currency Settings API] POST error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to save currency preferences' },
            { status: 500 }
        );
    }
}
