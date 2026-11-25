-- Add internal credits and lightweight per-IP authentication throttling.
-- Apply only to the sevenaiusers-test D1 database after reviewing this migration.
ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
ON credit_transactions(user_id, created_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_window
ON auth_rate_limits(window_started_at);
