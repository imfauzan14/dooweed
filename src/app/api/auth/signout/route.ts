import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, deleteSession, clearSessionCookie } from '@/lib/auth';

/**
 * POST /api/auth/signout
 * Destroy session and sign out user
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const sessionId = request.cookies.get('dooweed_session')?.value;
        if (sessionId) {
            await deleteSession(sessionId);
        }

        const response = NextResponse.json({ success: true });
        clearSessionCookie(response);

        return response;
    } catch (error) {
        console.error('[Auth] Signout error:', error);
        return NextResponse.json(
            { error: 'Failed to sign out' },
            { status: 500 }
        );
    }
}
