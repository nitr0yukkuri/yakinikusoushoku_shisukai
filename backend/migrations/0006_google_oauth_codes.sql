CREATE TABLE IF NOT EXISTS google_oauth_codes (
    code_hash TEXT PRIMARY KEY,
    auth_user_id BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    code_challenge TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE google_oauth_codes
    ADD COLUMN IF NOT EXISTS code_challenge TEXT;

CREATE INDEX IF NOT EXISTS idx_google_oauth_codes_expires_at
    ON google_oauth_codes (expires_at);
