// Versioned schema for the self-hosted application's private SQLite database.
export const migrations = [{version: 1, sql: `
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE profiles (id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, workspace TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE saved_lists (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, company_ids TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX lists_owner ON saved_lists(owner_id);
CREATE TABLE campaigns (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, purpose TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, company_ids TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX campaigns_owner ON campaigns(owner_id);
CREATE TABLE bot_settings (owner_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE, settings TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE suppressions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, email TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX suppressions_owner_email ON suppressions(owner_id,email);
`}];
