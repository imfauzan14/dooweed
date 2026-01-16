import { sql } from 'drizzle-orm';
import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core';

// Users table (for future multi-user support)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  name: text('name'),
  defaultCurrency: text('default_currency').default('IDR'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Categories table
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  icon: text('icon'),
  color: text('color'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Receipts table (stores base64 images)
export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  imageBase64: text('image_base64').notNull(),
  ocrRawText: text('ocr_raw_text'),
  ocrMerchant: text('ocr_merchant'),
  ocrDate: text('ocr_date'),
  ocrAmount: real('ocr_amount'),
  ocrCurrency: text('ocr_currency'),
  ocrConfidence: real('ocr_confidence'),
  verified: integer('verified', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Recurring transactions table
export const recurringTransactions = sqliteTable('recurring_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').default('IDR'),
  categoryId: text('category_id').references(() => categories.id),
  description: text('description'),
  frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly', 'yearly'] }).notNull(),
  nextDate: text('next_date'),
  endDate: text('end_date'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Transactions table
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').default('IDR'),
  amountInBase: real('amount_in_base'),
  categoryId: text('category_id').references(() => categories.id),
  description: text('description'),
  date: text('date').notNull(),
  receiptId: text('receipt_id').references(() => receipts.id, { onDelete: 'cascade' }),
  recurringId: text('recurring_id').references(() => recurringTransactions.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Budgets table
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  categoryId: text('category_id').references(() => categories.id), // null = universal budget
  amount: real('amount').notNull(),
  currency: text('currency').default('IDR'),
  period: text('period', { enum: ['weekly', 'monthly', 'yearly'] }).notNull(),
  startDate: text('start_date'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Exchange rate cache table
export const exchangeRates = sqliteTable('exchange_rates', {
  id: text('id').primaryKey(),
  baseCurrency: text('base_currency').notNull(),
  targetCurrency: text('target_currency').notNull(),
  rate: real('rate').notNull(),
  date: text('date').notNull(),
  fetchedAt: text('fetched_at').default(sql`CURRENT_TIMESTAMP`),
});

// Type exports for use in application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
