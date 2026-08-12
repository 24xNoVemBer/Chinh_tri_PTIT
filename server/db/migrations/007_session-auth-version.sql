ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 1
  CHECK (auth_version > 0);

UPDATE sessions
SET auth_version = users.auth_version
FROM users
WHERE users.id = sessions.user_id;
