CREATE TABLE IF NOT EXISTS meetup_arrivals (
    meetup_id BIGINT NOT NULL REFERENCES meetups (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    arrived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (meetup_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meetup_arrivals_meetup
    ON meetup_arrivals (meetup_id, arrived_at);
