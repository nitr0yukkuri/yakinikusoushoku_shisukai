-- Friend data is tied to authenticated application users.
-- The legacy friend/request tables reference the separate prototype user table.
CREATE TABLE IF NOT EXISTS friendships (
    user_low_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    user_high_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_low_id, user_high_id),
    CONSTRAINT friendships_ordered_users CHECK (user_low_id < user_high_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_high_user
    ON friendships (user_high_id);

CREATE TABLE IF NOT EXISTS friend_requests (
    id BIGSERIAL PRIMARY KEY,
    requester_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    addressee_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT friend_requests_no_self CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_pending_pair
    ON friend_requests (
        LEAST(requester_id, addressee_id),
        GREATEST(requester_id, addressee_id)
    )
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_pending
    ON friend_requests (requester_id, created_at DESC)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee_pending
    ON friend_requests (addressee_id, created_at DESC)
    WHERE status = 'pending';
