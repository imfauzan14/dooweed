import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, clearSessionCookie } from '@/lib/auth';

/**
 * DELETE /api/auth/account
 * Delete user account and all associated data
 * Cascades to delete: sessions, transactions, receipts, budgets, categories, recurring
 */
export async function DELETE(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        // Delete user (cascade will delete all related data)
        await db.delete(users).where(eq(users.id, user.id));

        // Delete all user sessions
        await db.delete(sessions).where(eq(sessions.userId, user.id));

        // Clear session cookie
        const response = NextResponse.json({
            success: true,
            message: 'Account deleted successfully',
        });

        clearSessionCookie(response);

        return response;
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('[Auth] Delete account error:', error);
        return NextResponse.json(
            { error: 'Failed to delete account' },
            { status: 500 }
        );
    }
}
