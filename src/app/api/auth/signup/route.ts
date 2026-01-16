import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword, verifyPassword, createSession, setSessionCookie } from '@/lib/auth';

/**
 * POST /api/auth/signup
 * Create a new user account
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, name } = body;

        // Validation
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existing.length > 0) {
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const userId = uuidv4();
        await db.insert(users).values({
            id: userId,
            email,
            password: hashedPassword,
            name: name || null,
        });

        // Create session
        const sessionId = await createSession(userId);

        // Get user data (without password)
        const user = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            defaultCurrency: users.defaultCurrency,
            createdAt: users.createdAt,
        }).from(users).where(eq(users.id, userId)).limit(1);

        // Set session cookie
        const response = NextResponse.json({
            success: true,
            user: user[0],
        }, { status: 201 });

        setSessionCookie(response, sessionId);

        return response;
    } catch (error) {
        console.error('[Auth] Signup error:', error);
        return NextResponse.json(
            { error: 'Failed to create account' },
            { status: 500 }
        );
    }
}
