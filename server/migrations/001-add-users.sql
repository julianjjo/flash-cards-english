-- Migration 001: Add Users Table and User Management
-- This migration adds user authentication and per-user flashcard isolation
-- Compatible with D1 database (SQLite syntax)

-- Create cards table if it doesn't exist (includes all columns)
CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    en TEXT NOT NULL,
    es TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    nextReview TEXT,
    audio_url TEXT,
    tips TEXT,
    easeFactor REAL DEFAULT 2.5,
    repetitions INTEGER DEFAULT 0,
    lastInterval INTEGER DEFAULT 0,
    user_id INTEGER
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for efficient queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- All columns are now included in the CREATE TABLE statement above
-- No need for ALTER TABLE statements since the table is created with all columns

-- Create index for card user isolation queries
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);

-- Insert admin user using environment variables
-- This will be populated by the migration script with actual admin credentials
-- Placeholder values here - actual values come from environment
INSERT OR IGNORE INTO users (id, email, password_hash, role, created_at, updated_at) 
VALUES (1, 'ADMIN_EMAIL_PLACEHOLDER', 'ADMIN_PASSWORD_HASH_PLACEHOLDER', 'admin', datetime('now'), datetime('now'));

-- Assign all existing cards to admin user (id = 1)
-- This preserves existing data while enabling user isolation
UPDATE cards 
SET user_id = 1 
WHERE user_id IS NULL;

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Verification queries (commented for reference)
-- SELECT COUNT(*) as user_count FROM users;
-- SELECT COUNT(*) as cards_with_users FROM cards WHERE user_id IS NOT NULL;
-- SELECT u.email, COUNT(c.id) as card_count 
-- FROM users u LEFT JOIN cards c ON u.id = c.user_id 
-- GROUP BY u.id, u.email;