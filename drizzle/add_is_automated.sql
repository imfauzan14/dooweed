-- Add isAutomated column to receipts table
ALTER TABLE receipts ADD COLUMN is_automated INTEGER DEFAULT 0;

-- Verify column was added
PRAGMA table_info(receipts);
