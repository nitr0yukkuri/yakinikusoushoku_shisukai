-- Enable PostGIS extension and create application tables.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS places (
    id SERIAL PRIMARY KEY,
    name TEXT,
    geom geometry(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST (geom);

CREATE TABLE IF NOT EXISTS "user" (
    user_no BIGSERIAL PRIMARY KEY,
    uname TEXT NOT NULL,
    profile_image TEXT
);

COMMENT ON TABLE "user" IS 'ユーザー表: ユーザー情報';
COMMENT ON COLUMN "user".user_no IS 'ユーザー番号';
COMMENT ON COLUMN "user".uname IS 'ユーザーネーム';
COMMENT ON COLUMN "user".profile_image IS 'プロフィール画像。パスを保存';

CREATE TABLE IF NOT EXISTS friend (
    user_no BIGINT NOT NULL REFERENCES "user" (user_no) ON DELETE CASCADE,
    friend_no BIGINT NOT NULL REFERENCES "user" (user_no) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_no, friend_no),
    CONSTRAINT friend_no_self_reference CHECK (user_no <> friend_no)
);

COMMENT ON TABLE friend IS 'フレンド表';
COMMENT ON COLUMN friend.user_no IS 'ユーザー番号';
COMMENT ON COLUMN friend.friend_no IS 'フレンド番号。ユーザー表のユーザー番号を参照';

CREATE INDEX IF NOT EXISTS idx_friend_friend_no ON friend (friend_no);

CREATE TABLE IF NOT EXISTS plan (
    plan_no BIGSERIAL PRIMARY KEY,
    time TIMESTAMPTZ,
    place TEXT
);

COMMENT ON TABLE plan IS '予定表';
COMMENT ON COLUMN plan.plan_no IS '予定番号';
COMMENT ON COLUMN plan.time IS '時間';
COMMENT ON COLUMN plan.place IS '住所';

CREATE INDEX IF NOT EXISTS idx_plan_time ON plan (time);

CREATE TABLE IF NOT EXISTS notification (
    notif_no BIGSERIAL PRIMARY KEY,
    user_no BIGINT REFERENCES "user" (user_no) ON DELETE CASCADE,
    notif_time TIMESTAMPTZ,
    notif_method TEXT
);

COMMENT ON TABLE notification IS '通知表';
COMMENT ON COLUMN notification.notif_no IS '通知番号';
COMMENT ON COLUMN notification.user_no IS 'ユーザー番号';
COMMENT ON COLUMN notification.notif_time IS '通知時刻';
COMMENT ON COLUMN notification.notif_method IS '通知種類';

CREATE INDEX IF NOT EXISTS idx_notification_user_no ON notification (user_no);
CREATE INDEX IF NOT EXISTS idx_notification_notif_time ON notification (notif_time);

CREATE TABLE IF NOT EXISTS request (
    req_no BIGSERIAL PRIMARY KEY,
    req_user BIGINT REFERENCES "user" (user_no) ON DELETE SET NULL,
    req_target BIGINT REFERENCES "user" (user_no) ON DELETE SET NULL,
    status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE request IS '申請表';
COMMENT ON COLUMN request.req_no IS '申請番号';
COMMENT ON COLUMN request.req_user IS '申請者';
COMMENT ON COLUMN request.req_target IS '申請対象';
COMMENT ON COLUMN request.status IS 'ステータス';
COMMENT ON COLUMN request.created_at IS '作成日時';
COMMENT ON COLUMN request.updated_at IS '更新日時';

CREATE INDEX IF NOT EXISTS idx_request_req_user ON request (req_user);
CREATE INDEX IF NOT EXISTS idx_request_req_target ON request (req_target);
CREATE INDEX IF NOT EXISTS idx_request_status ON request (status);

CREATE TABLE IF NOT EXISTS auth_users (
    id BIGSERIAL PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT,
    name TEXT,
    picture_url TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE auth_users IS 'Googleログイン済みユーザー';
COMMENT ON COLUMN auth_users.google_sub IS 'Google ID tokenのsub。一意で変更されないGoogleユーザーID';
COMMENT ON COLUMN auth_users.email IS 'Googleアカウントのメールアドレス';
COMMENT ON COLUMN auth_users.name IS 'Googleアカウント表示名';
COMMENT ON COLUMN auth_users.picture_url IS 'Googleプロフィール画像URL';
COMMENT ON COLUMN auth_users.email_verified IS 'Googleでメール確認済みか';

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users (email);

ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS bio TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_user_id ON auth_users (user_id) WHERE user_id IS NOT NULL;
