-- Links an existing Hunter Scheduler account to the verified Microsoft identity
-- used for sign-in. Account profile data remains in users.
BEGIN;
CREATE TABLE IF NOT EXISTS microsoft_identities (
    subject TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    emplid INT NOT NULL UNIQUE REFERENCES users(emplid) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT ON microsoft_identities TO hunter_web;
GRANT SELECT ON sections TO hunter_web;
COMMIT;
