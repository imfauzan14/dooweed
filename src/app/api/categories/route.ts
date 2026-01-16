import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { seedCategories } from '@/lib/seed';
import { requireAuth } from '@/lib/auth';

// GET /api/categories - List all categories
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        const result = await db
            .select()
            .from(categories)
            .where(eq(categories.userId, user.id));

        // If no categories exist, seed default ones
        if (result.length === 0) {
            const toInsert = seedCategories.map((cat) => ({
                ...cat,
                id: uuid(),
                userId: user.id,
            }));

            await db.insert(categories).values(toInsert);

            return NextResponse.json({ data: toInsert, seeded: true });
        }

        return NextResponse.json({ data: result });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error fetching categories:', error);
        return NextResponse.json(
            { error: 'Failed to fetch categories' },
            { status: 500 }
        );
    }
}

// POST /api/categories - Create a new category
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const { name, type, icon, color } = body;

        if (!name || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: name, type' },
                { status: 400 }
            );
        }

        if (type !== 'income' && type !== 'expense') {
            return NextResponse.json(
                { error: 'Type must be either "income" or "expense"' },
                { status: 400 }
            );
        }

        const id = uuid();
        const newCategory = {
            id,
            userId: user.id,
            name,
            type: type as 'income' | 'expense',
            icon: icon || '📁',
            color: color || '#6B7280',
        };

        await db.insert(categories).values(newCategory);

        return NextResponse.json({ data: newCategory }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error creating category:', error);
        return NextResponse.json(
            { error: 'Failed to create category' },
            { status: 500 }
        );
    }
}

// PUT /api/categories - Update a category
export async function PUT(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const { id, name, icon, color } = body;

        if (!id) {
            return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }

        const existing = await db
            .select()
            .from(categories)
            .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        const updateValues: Partial<typeof categories.$inferInsert> = {};
        if (name) updateValues.name = name;
        if (icon) updateValues.icon = icon;
        if (color) updateValues.color = color;

        await db.update(categories).set(updateValues).where(eq(categories.id, id));

        const updated = await db
            .select()
            .from(categories)
            .where(eq(categories.id, id))
            .limit(1);

        return NextResponse.json({ data: updated[0] });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error updating category:', error);
        return NextResponse.json(
            { error: 'Failed to update category' },
            { status: 500 }
        );
    }
}

// DELETE /api/categories - Delete a category
export async function DELETE(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }

        const existing = await db
            .select()
            .from(categories)
            .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        await db.delete(categories).where(eq(categories.id, id));

        return NextResponse.json({ message: 'Category deleted successfully' });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('Error deleting category:', error);
        return NextResponse.json(
            { error: 'Failed to delete category' },
            { status: 500 }
        );
    }
}
