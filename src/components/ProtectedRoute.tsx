'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const publicPaths = ['/login', '/signup'];

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            const isPublicPath = publicPaths.includes(pathname);

            if (!user && !isPublicPath) {
                // Not authenticated and trying to access protected page
                router.push('/login');
            } else if (user && isPublicPath) {
                // Already authenticated and trying to access auth pages
                router.push('/');
            }
        }
    }, [user, loading, pathname, router]);

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-500 border-r-transparent"></div>
                    <p className="mt-4 text-gray-400 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render protected content until user is authenticated
    const isPublicPath = publicPaths.includes(pathname);
    if (!isPublicPath && !user) {
        return null; // Router will redirect
    }

    return <>{children}</>;
}
