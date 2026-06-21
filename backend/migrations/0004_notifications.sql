CREATE TABLE IF NOT EXISTS user_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('friend_request_received', 'friend_request_accepted')),
    actor_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    friend_request_id BIGINT NOT NULL REFERENCES friend_requests (id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, type, friend_request_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
    ON user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
    ON user_notifications (user_id, created_at DESC) WHERE read_at IS NULL;
