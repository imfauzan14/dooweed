'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AccountPage() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to change password');
            }

            setSuccess('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearData = async () => {
        if (!confirm('Are you sure you want to clear ALL your data? This action cannot be undone. Your account will remain active.')) {
            return;
        }

        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/clear-data', {
                method: 'DELETE',
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to clear data');
            }

            // Show success and redirect
            window.location.href = '/';
        } catch (err: any) {
            setError(err.message);
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!confirm('Are you sure you want to DELETE your account? This will permanently delete all your data and cannot be undone.')) {
            return;
        }

        if (!confirm('This is your FINAL warning. Your account and ALL data will be permanently deleted. Continue?')) {
            return;
        }

        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/account', {
                method: 'DELETE',
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to delete account');
            }

            // Account deleted, sign out
            await signOut();
        } catch (err: any) {
            setError(err.message);
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
            <p className="text-gray-400 mb-8">Manage your account and data</p>

            {/* User Info */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
                <div className="space-y-2 text-gray-300">
                    <p><span className="text-gray-500">Email:</span> {user?.email}</p>
                    <p><span className="text-gray-500">Name:</span> {user?.name || 'Not set'}</p>
                    <p><span className="text-gray-500">Currency:</span> {user?.defaultCurrency}</p>
                </div>
            </div>

            {/* Change Password */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Change Password</h2>

                {error && (
                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-green-400 text-sm">{success}</p>
                    </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
                            Current Password
                        </label>
                        <input
                            id="currentPassword"
                            type="password"
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                            New Password
                        </label>
                        <input
                            id="newPassword"
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                            Confirm New Password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                        {loading ? 'Changing...' : 'Change Password'}
                    </button>
                </form>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-red-400 mb-4">Danger Zone</h2>

                <div className="space-y-4">
                    <div className="flex items-start justify-between pb-4 border-b border-red-900/30">
                        <div className="flex-1">
                            <h3 className="font-medium text-white mb-1">Clear All Data</h3>
                            <p className="text-sm text-gray-400">
                                Delete all transactions, receipts, budgets, and categories. Your account will remain active.
                            </p>
                        </div>
                        <button
                            onClick={handleClearData}
                            disabled={loading}
                            className="ml-4 px-4 py-2 bg-red-900/50 text-red-300 rounded-lg hover:bg-red-900/70 transition disabled:opacity-50 whitespace-nowrap"
                        >
                            Clear Data
                        </button>
                    </div>

                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="font-medium text-white mb-1">Delete Account</h3>
                            <p className="text-sm text-gray-400">
                                Permanently delete your account and all associated data. This action cannot be undone.
                            </p>
                        </div>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={loading}
                            className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 whitespace-nowrap"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
