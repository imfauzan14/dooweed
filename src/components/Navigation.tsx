'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Receipt,
    Camera,
    PiggyBank,
    FileBarChart,
    Settings,
    Repeat,
} from 'lucide-react';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/transactions', label: 'Transactions', icon: Receipt },
    { href: '/receipts', label: 'Scan', icon: Camera },
    { href: '/budgets', label: 'Budgets', icon: PiggyBank },
    { href: '/recurring', label: 'Recurring', icon: Repeat },
    { href: '/reports', label: 'Reports', icon: FileBarChart },
    { href: '/settings', label: 'Settings', icon: Settings },
];

// Mobile bottom nav shows only essential items
const mobileNavItems = [
    { href: '/', label: 'Home', icon: LayoutDashboard },
    { href: '/transactions', label: 'History', icon: Receipt },
    { href: '/receipts', label: 'Scan', icon: Camera },
    { href: '/budgets', label: 'Budget', icon: PiggyBank },
    { href: '/settings', label: 'More', icon: Settings },
];

export function Navigation() {
    const pathname = usePathname();

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-64 bg-gray-900/50 border-r border-gray-800 backdrop-blur-xl">
                <div className="p-6">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
                        Dooweed
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Expense Tracker</p>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                                    isActive
                                        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                                )}
                            >
                                <Icon className={cn('w-5 h-5', isActive && 'text-blue-400')} />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 m-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
                    <p className="text-sm text-gray-300">Free Tier</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Unlimited transactions • Client-side OCR • No API costs
                    </p>
                </div>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800 z-50 safe-area-bottom">
                <div className="flex justify-between px-2 py-1">
                    {mobileNavItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-[48px]',
                                    isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[10px]">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}

// Page header component
export function PageHeader({
    title,
    subtitle,
    action,
}: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
                {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
        </div>
    );
}

// Stats card component
interface StatCardProps {
    label: string;
    value: string;
    change?: string;
    changeType?: 'positive' | 'negative' | 'neutral';
    icon?: React.ReactNode;
}

export function StatCard({ label, value, change, changeType = 'neutral', icon }: StatCardProps) {
    return (
        <div className="p-4 sm:p-6 bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-400">{label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1 break-words">{value}</p>
                    {change && (
                        <p
                            className={cn(
                                'text-sm mt-2',
                                changeType === 'positive' && 'text-green-400',
                                changeType === 'negative' && 'text-red-400',
                                changeType === 'neutral' && 'text-gray-500'
                            )}
                        >
                            {change}
                        </p>
                    )}
                </div>
                {icon && (
                    <div className="p-3 rounded-xl bg-gray-700/30">{icon}</div>
                )}
            </div>
        </div>
    );
}

// Empty state component
export function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-gray-800/50 text-gray-500 mb-4">{icon}</div>
            <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
            <p className="text-sm text-gray-500 max-w-sm">{description}</p>
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}
