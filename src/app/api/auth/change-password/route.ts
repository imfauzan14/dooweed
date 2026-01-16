import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, and, not } from 'drizzle-orm';
import { requireAuth, verifyPassword, hashPassword } from '@/lib/auth';

/**
 * POST /api/auth/change-password
 * Update user password and invalidate all sessions except current one
 */
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const { currentPassword, newPassword } = body;

        // Validation
        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: 'Current and new password are required' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: 'New password must be at least 6 characters' },
                { status: 400 }
            );
        }

        // Get user with password
        const userWithPassword = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
        if (userWithPassword.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify current password
        const isValid = await verifyPassword(currentPassword, userWithPassword[0].password);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Current password is incorrect' },
                { status: 401 }
            );
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update password
        await db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, user.id));

        // Invalidate all other sessions (keep current session)
        const currentSessionId = request.cookies.get('dooweed_session')?.value;
        if (currentSessionId) {
            // Delete all sessions EXCEPT the current one
            await db.delete(sessions)
                .where(and(
                    eq(sessions.userId, user.id),
                    not(eq(sessions.id, currentSessionId))
                ));
        }

        return NextResponse.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('[Auth] Change password error:', error);
        return NextResponse.json(
            { error: 'Failed to change password' },
            { status: 500 }
        );
    }
}
