// Seed data for categories (pre-populated for convenience)

import { v4 as uuid } from 'uuid';

export const DEFAULT_USER_ID = 'default-user';

export const seedCategories = [
    // Expense categories
    { id: uuid(), name: 'Food & Dining', type: 'expense', icon: '🍔', color: '#FF6B6B' },
    { id: uuid(), name: 'Transportation', type: 'expense', icon: '🚗', color: '#4ECDC4' },
    { id: uuid(), name: 'Shopping', type: 'expense', icon: '🛍️', color: '#9B59B6' },
    { id: uuid(), name: 'Entertainment', type: 'expense', icon: '🎬', color: '#F39C12' },
    { id: uuid(), name: 'Utilities', type: 'expense', icon: '💡', color: '#3498DB' },
    { id: uuid(), name: 'Healthcare', type: 'expense', icon: '🏥', color: '#E74C3C' },
    { id: uuid(), name: 'Education', type: 'expense', icon: '📚', color: '#1ABC9C' },
    { id: uuid(), name: 'Groceries', type: 'expense', icon: '🛒', color: '#27AE60' },
    { id: uuid(), name: 'Rent & Housing', type: 'expense', icon: '🏠', color: '#8E44AD' },
    { id: uuid(), name: 'Insurance', type: 'expense', icon: '🛡️', color: '#2C3E50' },
    { id: uuid(), name: 'Personal Care', type: 'expense', icon: '💇', color: '#E91E63' },
    { id: uuid(), name: 'Subscriptions', type: 'expense', icon: '📱', color: '#00BCD4' },
    { id: uuid(), name: 'Travel', type: 'expense', icon: '✈️', color: '#FF9800' },
    { id: uuid(), name: 'Gifts & Donations', type: 'expense', icon: '🎁', color: '#9C27B0' },
    { id: uuid(), name: 'Other Expense', type: 'expense', icon: '📦', color: '#607D8B' },

    // Income categories
    { id: uuid(), name: 'Salary', type: 'income', icon: '💰', color: '#4CAF50' },
    { id: uuid(), name: 'Freelance', type: 'income', icon: '💻', color: '#2196F3' },
    { id: uuid(), name: 'Investments', type: 'income', icon: '📈', color: '#673AB7' },
    { id: uuid(), name: 'Rental Income', type: 'income', icon: '🏢', color: '#795548' },
    { id: uuid(), name: 'Side Business', type: 'income', icon: '🏪', color: '#009688' },
    { id: uuid(), name: 'Gifts Received', type: 'income', icon: '🎊', color: '#FF5722' },
    { id: uuid(), name: 'Refunds', type: 'income', icon: '↩️', color: '#03A9F4' },
    { id: uuid(), name: 'Other Income', type: 'income', icon: '💵', color: '#8BC34A' },
] as const;

export type SeedCategory = typeof seedCategories[number];
