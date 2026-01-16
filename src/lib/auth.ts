// Authentication utility functions
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, sessions, type User } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

const SESSION_COOKIE_NAME = 'dooweed_session';
const SESSION_DURATION_DAYS = 30;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string): Promise<string> {
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    await db.insert(sessions).values({
        id: sessionId,
        userId,
        expiresAt: expiresAt, // Use Date object directly
        createdAt: new Date(),
    });

    return sessionId;
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Get user from session cookie
 */
export async function getSessionUser(request: NextRequest): Promise<User | null> {
    const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionId) return null;

    const now = new Date();
    const session = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
        .limit(1);

    if (session.length === 0) return null;

    const user = await db
        .select()
        .from(users)
        .where(eq(users.id, session[0].userId))
        .limit(1);

    return user.length > 0 ? user[0] : null;
}

/**
 * Require authentication - throws 401 if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<User> {
    const user = await getSessionUser(request);
    if (!user) {
        throw new Error('Unauthorized');
    }
    return user;
}

/**
 * Set session cookie
 */
export function setSessionCookie(response: NextResponse, sessionId: string): void {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
    });
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(response: NextResponse): void {
    response.cookies.delete(SESSION_COOKIE_NAME);
}
