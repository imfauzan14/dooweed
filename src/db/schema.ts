import { sql } from 'drizzle-orm';
import { text, integer, real, sqliteTable, index } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // bcrypt hashed
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
  fileName: text('file_name'),
  verified: integer('verified', { mode: 'boolean' }).default(false),
  isAutomated: integer('is_automated', { mode: 'boolean' }).default(false), // Auto-pilot flag
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  fileNameIdx: index('idx_receipts_filename').on(table.fileName),
  userIdx: index('idx_receipts_user').on(table.userId),
}));

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
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  description: text('description'),
  date: text('date').notNull(),
  receiptId: text('receipt_id').references(() => receipts.id, { onDelete: 'cascade' }),
  recurringId: text('recurring_id').references(() => recurringTransactions.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userDateIdx: index('idx_transactions_user_date').on(table.userId, table.date),
  categoryIdx: index('idx_transactions_category').on(table.categoryId),
  dateIdx: index('idx_transactions_date').on(table.date),
}));

// Budgets table
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'cascade' }), // null = universal budget
  amount: real('amount').notNull(),
  currency: text('currency').default('IDR'),
  period: text('period', { enum: ['weekly', 'monthly', 'yearly'] }).notNull(),
  startDate: text('start_date'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userCategoryIdx: index('idx_budgets_user_category').on(table.userId, table.categoryId),
}));

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

// Settings table for app-level configuration
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(), // JSON string for complex values
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

// Sessions table for authentication
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const currencyPreferences = sqliteTable('currency_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  fallbackOrder: text('fallback_order').notNull(), // JSON: ["api", "llm", "custom"]
  enabledMethods: text('enabled_methods').notNull(), // JSON: ["api", "llm", "custom"]
  customRates: text('custom_rates'), // JSON: {USD: {IDR: 16850}, ...}
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});


export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type CurrencyPreference = typeof currencyPreferences.$inferSelect;
export type NewCurrencyPreference = typeof currencyPreferences.$inferInsert;
export type ExchangeRateCache = typeof exchangeRates.$inferSelect;
export type NewExchangeRateCache = typeof exchangeRates.$inferInsert;
