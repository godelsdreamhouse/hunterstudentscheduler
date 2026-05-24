-- Stores Express login session data in Postgres/Supabase.
-- The backend uses connect-pg-simple with "session" table.
CREATE TABLE IF NOT EXISTS "session" (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

-- Speeds up cleanup/lookups for expired sessions.
CREATE INDEX IF NOT EXISTS idx_session_expire ON "session"(expire);
