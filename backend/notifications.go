package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type notification struct {
	ID                     int64         `json:"id"`
	Type                   string        `json:"type"`
	Actor                  friendProfile `json:"actor"`
	FriendRequestID        *int64        `json:"friendRequestId,omitempty"`
	RequestStatus          string        `json:"friendRequestStatus,omitempty"`
	MeetupID               *int64        `json:"meetupId,omitempty"`
	MeetupPlaceName        string        `json:"meetupPlaceName,omitempty"`
	MeetupScheduledAt      *time.Time    `json:"meetupScheduledAt,omitempty"`
	MeetupInvitationStatus string        `json:"meetupInvitationStatus,omitempty"`
	Read                   bool          `json:"read"`
	CreatedAt              time.Time     `json:"createdAt"`
}

type updateNotificationsRequest struct {
	NotificationID int64 `json:"notificationId"`
	All            bool  `json:"all"`
}

func ensureNotificationSchema(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS user_notifications (
			id BIGSERIAL PRIMARY KEY,
			user_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
			type TEXT NOT NULL CHECK (type IN ('friend_request_received', 'friend_request_accepted', 'meetup_invitation_received')),
			actor_id BIGINT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
			friend_request_id BIGINT REFERENCES friend_requests (id) ON DELETE CASCADE,
			meetup_id BIGINT REFERENCES meetups (id) ON DELETE CASCADE,
			read_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE (user_id, type, friend_request_id)
		);
		ALTER TABLE user_notifications
			DROP CONSTRAINT IF EXISTS user_notifications_type_check;
		ALTER TABLE user_notifications
			ADD CONSTRAINT user_notifications_type_check
			CHECK (type IN ('friend_request_received', 'friend_request_accepted', 'meetup_invitation_received'));
		ALTER TABLE user_notifications
			ALTER COLUMN friend_request_id DROP NOT NULL;
		ALTER TABLE user_notifications
			ADD COLUMN IF NOT EXISTS meetup_id BIGINT REFERENCES meetups (id) ON DELETE CASCADE;
		CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
			ON user_notifications (user_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
			ON user_notifications (user_id, created_at DESC) WHERE read_at IS NULL;
		CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_meetup_invitation
			ON user_notifications (user_id, type, meetup_id)
			WHERE meetup_id IS NOT NULL;

		INSERT INTO user_notifications (user_id, type, actor_id, friend_request_id, created_at)
		SELECT addressee_id, 'friend_request_received', requester_id, id, created_at
		FROM friend_requests
		WHERE status = 'pending'
		ON CONFLICT (user_id, type, friend_request_id) DO NOTHING;

		INSERT INTO user_notifications (user_id, type, actor_id, friend_request_id, created_at)
		SELECT requester_id, 'friend_request_accepted', addressee_id, id,
			COALESCE(responded_at, updated_at)
		FROM friend_requests
		WHERE status = 'accepted'
		ON CONFLICT (user_id, type, friend_request_id) DO NOTHING;

		INSERT INTO user_notifications (user_id, type, actor_id, meetup_id, created_at)
		SELECT mm.user_id, 'meetup_invitation_received', m.owner_id, m.id, mm.created_at
		FROM meetup_members mm
		JOIN meetups m ON m.id = mm.meetup_id
		WHERE mm.role = 'member' AND mm.status = 'invited'
		ON CONFLICT (user_id, type, meetup_id) WHERE meetup_id IS NOT NULL DO NOTHING;
	`)
	return err
}

func handleNotifications(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userNo, ok := authenticatedUserNo(w, r)
		if !ok {
			return
		}
		switch r.Method {
		case http.MethodGet:
			listNotifications(w, r, pool, userNo)
		case http.MethodPut:
			markNotificationsRead(w, r, pool, userNo)
		default:
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	}
}

func listNotifications(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo int64) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	rows, err := pool.Query(ctx, `
		SELECT n.id, n.type, u.user_id, COALESCE(u.name, ''),
			COALESCE(NULLIF(u.profile_image, ''), NULLIF(u.picture_url, ''), ''),
			n.friend_request_id, COALESCE(fr.status, ''),
			n.meetup_id, COALESCE(m.place_name, ''), m.scheduled_at,
			COALESCE(mm.status, ''), n.read_at IS NOT NULL, n.created_at
		FROM user_notifications n
		JOIN auth_users u ON u.id = n.actor_id
		LEFT JOIN friend_requests fr ON fr.id = n.friend_request_id
		LEFT JOIN meetups m ON m.id = n.meetup_id
		LEFT JOIN meetup_members mm ON mm.meetup_id = n.meetup_id AND mm.user_id = n.user_id
		WHERE n.user_id = $1
		ORDER BY n.created_at DESC, n.id DESC
		LIMIT 100
	`, userNo)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read notifications")
		return
	}
	defer rows.Close()
	items := make([]notification, 0)
	for rows.Next() {
		var item notification
		if err := rows.Scan(
			&item.ID, &item.Type, &item.Actor.UserID, &item.Actor.Name,
			&item.Actor.ProfileImage, &item.FriendRequestID, &item.RequestStatus,
			&item.MeetupID, &item.MeetupPlaceName, &item.MeetupScheduledAt, &item.MeetupInvitationStatus,
			&item.Read, &item.CreatedAt,
		); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to read notifications")
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read notifications")
		return
	}
	unreadCount := 0
	for _, item := range items {
		if !item.Read {
			unreadCount++
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"notifications": items, "unreadCount": unreadCount})
}

func markNotificationsRead(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo int64) {
	var req updateNotificationsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if !req.All && req.NotificationID <= 0 {
		writeJSONError(w, http.StatusBadRequest, "notificationId or all is required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if req.All {
		_, err := pool.Exec(ctx, `
			UPDATE user_notifications SET read_at = now()
			WHERE user_id = $1 AND read_at IS NULL
		`, userNo)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to update notifications")
			return
		}
	} else {
		result, err := pool.Exec(ctx, `
			UPDATE user_notifications SET read_at = now()
			WHERE id = $1 AND user_id = $2
		`, req.NotificationID, userNo)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to update notification")
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, http.StatusNotFound, "notification not found")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
