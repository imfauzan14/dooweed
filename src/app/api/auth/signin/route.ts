import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth';

/**
 * POST /api/auth/signin
 * Authenticate user and create session
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // Validation
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        // Find user by email
        const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (user.length === 0) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await verifyPassword(password, user[0].password);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Create session
        const sessionId = await createSession(user[0].id);

        // Return user data (without password)
        const response = NextResponse.json({
            success: true,
            user: {
                id: user[0].id,
                email: user[0].email,
                name: user[0].name,
                defaultCurrency: user[0].defaultCurrency,
                createdAt: user[0].createdAt,
            },
        });

        setSessionCookie(response, sessionId);

        return response;
    } catch (error) {
        console.error('[Auth] Signin error:', error);
        return NextResponse.json(
            { error: 'Failed to sign in' },
            { status: 500 }
        );
    }
}
