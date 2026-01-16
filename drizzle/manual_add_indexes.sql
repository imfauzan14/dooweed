-- Migration: Add indexes to existing tables
-- Run this manually if drizzle-kit push fails

-- Add indexes for receipts table
CREATE INDEX IF NOT EXISTS idx_receipts_filename ON receipts (file_name);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts (user_id);

-- Add indexes for transactions table  
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);

-- Add indexes for budgets table
CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON budgets (user_id, category_id);

-- Verify indexes were created
SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%';
