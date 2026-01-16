'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

interface CategoriesContextType {
    categories: Category[];
    isLoading: boolean;
    error: string | null;
    refreshCategories: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(false); // Default false, only true when fetching
    const [error, setError] = useState<string | null>(null);
    // Track if we've done the initial fetch to avoid re-fetching on every soft navigation if provider remounts (it shouldn't if placed high enough)
    const [isInitialized, setIsInitialized] = useState(false);

    const fetchCategories = useCallback(async (force = false) => {
        if (!user) return;
        if (!force && isInitialized && categories.length > 0) return;

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) {
                if (response.status === 401) return; // Auth handled elsewhere
                throw new Error('Failed to fetch categories');
            }
            const data = await response.json();
            setCategories(data.data || []);
            setIsInitialized(true);
        } catch (err: unknown) {
            console.error('Error in CategoriesContext:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [user, isInitialized, categories.length]);

    // Initial fetch when user becomes available
    useEffect(() => {
        if (user && !isInitialized) {
            fetchCategories();
        }
    }, [user, isInitialized, fetchCategories]);

    const refreshCategories = async () => {
        await fetchCategories(true);
    };

    return (
        <CategoriesContext.Provider value={{ categories, isLoading, error, refreshCategories }}>
            {children}
        </CategoriesContext.Provider>
    );
}

export function useCategories() {
    const context = useContext(CategoriesContext);
    if (context === undefined) {
        throw new Error('useCategories must be used within a CategoriesProvider');
    }
    return context;
}
