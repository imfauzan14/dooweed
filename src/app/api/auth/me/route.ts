import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getSessionUser(request);

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Return user data (without password)
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                defaultCurrency: user.defaultCurrency,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error('[Auth] Get user error:', error);
        return NextResponse.json(
            { error: 'Failed to get user' },
            { status: 500 }
        );
    }
}
