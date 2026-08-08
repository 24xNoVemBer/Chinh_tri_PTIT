CREATE TABLE IF NOT EXISTS auth_login_limits (
  scope_key TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL CHECK (attempt_count > 0),
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_login_limits_updated
  ON auth_login_limits(updated_at);
