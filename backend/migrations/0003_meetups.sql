CREATE TABLE IF NOT EXISTS meetups (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    place_name TEXT NOT NULL,
    google_place_id TEXT,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
    invite_code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetups_owner_scheduled
    ON meetups (owner_id, scheduled_at DESC);

ALTER TABLE meetups ADD COLUMN IF NOT EXISTS google_place_id TEXT;

CREATE INDEX IF NOT EXISTS idx_meetups_google_place_id
    ON meetups (google_place_id) WHERE google_place_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS meetup_members (
    meetup_id BIGINT NOT NULL REFERENCES meetups (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    status TEXT NOT NULL DEFAULT 'invited'
        CHECK (status IN ('invited', 'accepted', 'declined')),
    invited_by BIGINT REFERENCES auth_users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (meetup_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meetup_members_user_status
    ON meetup_members (user_id, status, meetup_id);

CREATE TABLE IF NOT EXISTS meetup_arrival_estimates (
    meetup_id BIGINT NOT NULL REFERENCES meetups (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    travel_mode TEXT NOT NULL,
    duration_seconds BIGINT NOT NULL CHECK (duration_seconds >= 0),
    distance_meters BIGINT NOT NULL CHECK (distance_meters >= 0),
    buffer_minutes INTEGER NOT NULL DEFAULT 5 CHECK (buffer_minutes BETWEEN 0 AND 30),
    arrival_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (meetup_id, user_id)
);
