'use client';

import { usePathname } from 'next/navigation';
import { Navigation } from './Navigation';

const authPaths = ['/login', '/signup'];

export function AuthLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuthPage = authPaths.includes(pathname);

    if (isAuthPage) {
        // Auth pages - no navigation, full screen
        return <>{children}</>;
    }

    // App pages - with navigation
    return (
        <div className="flex min-h-screen">
            <Navigation />
            <main className="flex-1 lg:ml-0 overflow-auto pb-20 lg:pb-0">
                <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-6xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
