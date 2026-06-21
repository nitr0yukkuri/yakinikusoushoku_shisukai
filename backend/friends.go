package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const friendProfileColumns = `
	u.user_id,
	COALESCE(u.name, ''),
	COALESCE(NULLIF(u.profile_image, ''), NULLIF(u.picture_url, ''), '')
`

type friendProfile struct {
	UserID       string `json:"userId"`
	Name         string `json:"name"`
	ProfileImage string `json:"profileImage"`
}

type friendSearchResult struct {
	Profile      friendProfile `json:"profile"`
	Relationship string        `json:"relationship"`
}

type friendRequestProfile struct {
	ID        int64         `json:"id"`
	User      friendProfile `json:"user"`
	CreatedAt time.Time     `json:"createdAt"`
}

type createFriendRequest struct {
	UserID string `json:"userId"`
}

type updateFriendRequest struct {
	RequestID int64  `json:"requestId"`
	Action    string `json:"action"`
}

func ensureFriendSchema(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
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
	`)
	return err
}

func handleFriends(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userNo, ok := authenticatedUserNo(w, r)
		if !ok {
			return
		}

		switch r.Method {
		case http.MethodGet:
			listFriends(w, r, pool, userNo)
		case http.MethodDelete:
			deleteFriend(w, r, pool, userNo)
		default:
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	}
}

func listFriends(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo int64) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := pool.Query(ctx, `
		SELECT `+friendProfileColumns+`
		FROM friendships f
		JOIN auth_users u ON u.id = CASE
			WHEN f.user_low_id = $1 THEN f.user_high_id
			ELSE f.user_low_id
		END
		WHERE f.user_low_id = $1 OR f.user_high_id = $1
		ORDER BY LOWER(COALESCE(u.name, '')), LOWER(u.user_id)
	`, userNo)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read friends")
		return
	}
	defer rows.Close()

	friends := make([]friendProfile, 0)
	for rows.Next() {
		var friend friendProfile
		if err := rows.Scan(&friend.UserID, &friend.Name, &friend.ProfileImage); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to read friends")
			return
		}
		friends = append(friends, friend)
	}
	if err := rows.Err(); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read friends")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"friends": friends})
}

func deleteFriend(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo int64) {
	targetUserID := strings.TrimSpace(r.URL.Query().Get("userId"))
	if targetUserID == "" || !isUserID(targetUserID) {
		writeJSONError(w, http.StatusBadRequest, "valid userId is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	command, err := pool.Exec(ctx, `
		DELETE FROM friendships f
		USING auth_users target
		WHERE target.user_id = $1
			AND (
				(f.user_low_id = $2 AND f.user_high_id = target.id)
				OR (f.user_high_id = $2 AND f.user_low_id = target.id)
			)
	`, targetUserID, userNo)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to delete friend")
		return
	}
	if command.RowsAffected() == 0 {
		writeJSONError(w, http.StatusNotFound, "friend not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func handleFriendSearch(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		userNo, ok := authenticatedUserNo(w, r)
		if !ok {
			return
		}

		userID := strings.TrimSpace(r.URL.Query().Get("userId"))
		if userID == "" || !isUserID(userID) {
			writeJSONError(w, http.StatusBadRequest, "valid userId is required")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		var result friendSearchResult
		err := pool.QueryRow(ctx, `
			SELECT `+friendProfileColumns+`,
				CASE
					WHEN u.id = $2 THEN 'self'
					WHEN EXISTS (
						SELECT 1 FROM friendships f
						WHERE (f.user_low_id = LEAST($2, u.id)
							AND f.user_high_id = GREATEST($2, u.id))
					) THEN 'friends'
					WHEN EXISTS (
						SELECT 1 FROM friend_requests fr
						WHERE fr.requester_id = $2 AND fr.addressee_id = u.id
							AND fr.status = 'pending'
					) THEN 'outgoing_pending'
					WHEN EXISTS (
						SELECT 1 FROM friend_requests fr
						WHERE fr.requester_id = u.id AND fr.addressee_id = $2
							AND fr.status = 'pending'
					) THEN 'incoming_pending'
					ELSE 'none'
				END
			FROM auth_users u
			WHERE u.user_id = $1
		`, userID, userNo).Scan(
			&result.Profile.UserID,
			&result.Profile.Name,
			&result.Profile.ProfileImage,
			&result.Relationship,
		)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, http.StatusNotFound, "user not found")
			return
		}
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to search user")
			return
		}

		writeJSON(w, http.StatusOK, result)
	}
}

func handleFriendRequests(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userNo, ok := authenticatedUserNo(w, r)
		if !ok {
			return
		}

		switch r.Method {
		case http.MethodGet:
			listFriendRequests(w, r, pool, userNo)
		case http.MethodPost:
			createFriendRequestHandler(w, r, pool, userNo)
		case http.MethodPut:
			updateFriendRequestHandler(w, r, pool, userNo)
		default:
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	}
}

func listFriendRequests(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo int64) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	incoming, err := queryFriendRequests(ctx, pool, userNo, true)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read friend requests")
		return
	}
	outgoing, err := queryFriendRequests(ctx, pool, userNo, false)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read friend requests")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"incoming": incoming,
		"outgoing": outgoing,
	})
}

func queryFriendRequests(ctx context.Context, pool *pgxpool.Pool, userNo int64, incoming bool) ([]friendRequestProfile, error) {
	ownerColumn := "fr.requester_id"
	profileColumn := "fr.addressee_id"
	if incoming {
		ownerColumn = "fr.addressee_id"
		profileColumn = "fr.requester_id"
	}

	rows, err := pool.Query(ctx, `
		SELECT fr.id, `+friendProfileColumns+`, fr.created_at
		FROM friend_requests fr
		JOIN auth_users u ON u.id = `+profileColumn+`
		WHERE `+ownerColumn+` = $1 AND fr.status = 'pending'
		ORDER BY fr.created_at DESC, fr.id DESC
	`, userNo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	requests := make([]friendRequestProfile, 0)
	for rows.Next() {
		var request friendRequestProfile
		if err := rows.Scan(
			&request.ID,
			&request.User.UserID,
			&request.User.Name,
			&request.User.ProfileImage,
			&request.CreatedAt,
		); err != nil {
			return nil, err
		}
		requests = append(requests, request)
	}
	return requests, rows.Err()
}

func createFriendRequestHandler(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo int64) {
	var req createFriendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	req.UserID = strings.TrimSpace(req.UserID)
	if req.UserID == "" || !isUserID(req.UserID) {
		writeJSONError(w, http.StatusBadRequest, "valid userId is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	tx, err := pool.Begin(ctx)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create friend request")
		return
	}
	defer tx.Rollback(ctx)

	var targetID int64
	err = tx.QueryRow(ctx, `SELECT id FROM auth_users WHERE user_id = $1`, req.UserID).Scan(&targetID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSONError(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create friend request")
		return
	}
	if targetID == userNo {
		writeJSONError(w, http.StatusBadRequest, "cannot send a friend request to yourself")
		return
	}

	low, high := canonicalFriendPair(userNo, targetID)
	lockKey := fmt.Sprintf("%d:%d", low, high)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, lockKey); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create friend request")
		return
	}

	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM friendships
			WHERE user_low_id = $1 AND user_high_id = $2
		)
	`, low, high).Scan(&exists); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create friend request")
		return
	}
	if exists {
		writeJSONError(w, http.StatusConflict, "already friends")
		return
	}

	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM friend_requests
			WHERE LEAST(requester_id, addressee_id) = $1
				AND GREATEST(requester_id, addressee_id) = $2
				AND status = 'pending'
		)
	`, low, high).Scan(&exists); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create friend request")
		return
	}
	if exists {
		writeJSONError(w, http.StatusConflict, "friend request already pending")
		return
	}

	var requestID int64
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO friend_requests (requester_id, addressee_id)
		VALUES ($1, $2)
		RETURNING id, created_at
	`, userNo, targetID).Scan(&requestID, &createdAt)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create friend request")
		return
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO user_notifications (user_id, type, actor_id, friend_request_id, created_at)
		VALUES ($1, 'friend_request_received', $2, $3, $4)
		ON CONFLICT (user_id, type, friend_request_id) DO NOTHING
	`, targetID, userNo, requestID, createdAt); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create friend request notification")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create friend request")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"request": map[string]any{
			"id":        requestID,
			"userId":    req.UserID,
			"status":    "pending",
			"createdAt": createdAt,
		},
	})
}

func updateFriendRequestHandler(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo int64) {
	var req updateFriendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	if req.RequestID <= 0 {
		writeJSONError(w, http.StatusBadRequest, "valid requestId is required")
		return
	}
	if req.Action != "accept" && req.Action != "reject" && req.Action != "cancel" {
		writeJSONError(w, http.StatusBadRequest, "action must be accept, reject, or cancel")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	tx, err := pool.Begin(ctx)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to update friend request")
		return
	}
	defer tx.Rollback(ctx)

	var requesterID, addresseeID int64
	var status string
	err = tx.QueryRow(ctx, `
		SELECT requester_id, addressee_id, status
		FROM friend_requests
		WHERE id = $1
		FOR UPDATE
	`, req.RequestID).Scan(&requesterID, &addresseeID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSONError(w, http.StatusNotFound, "friend request not found")
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to update friend request")
		return
	}
	if status != "pending" {
		writeJSONError(w, http.StatusConflict, "friend request is no longer pending")
		return
	}
	if req.Action == "cancel" && requesterID != userNo {
		writeJSONError(w, http.StatusForbidden, "only the requester can cancel this request")
		return
	}
	if req.Action != "cancel" && addresseeID != userNo {
		writeJSONError(w, http.StatusForbidden, "only the recipient can respond to this request")
		return
	}

	nextStatus := map[string]string{
		"accept": "accepted",
		"reject": "rejected",
		"cancel": "cancelled",
	}[req.Action]
	if req.Action == "accept" {
		low, high := canonicalFriendPair(requesterID, addresseeID)
		if _, err := tx.Exec(ctx, `
			INSERT INTO friendships (user_low_id, user_high_id)
			VALUES ($1, $2)
			ON CONFLICT (user_low_id, user_high_id) DO NOTHING
		`, low, high); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to accept friend request")
			return
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO user_notifications (user_id, type, actor_id, friend_request_id)
			VALUES ($1, 'friend_request_accepted', $2, $3)
			ON CONFLICT (user_id, type, friend_request_id) DO NOTHING
		`, requesterID, addresseeID, req.RequestID); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to create friend acceptance notification")
			return
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE friend_requests
		SET status = $1, updated_at = now(), responded_at = now()
		WHERE id = $2
	`, nextStatus, req.RequestID); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to update friend request")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to update friend request")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"request": map[string]any{
			"id":     req.RequestID,
			"status": nextStatus,
		},
	})
}

func handleFriendQR(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		userNo, ok := authenticatedUserNo(w, r)
		if !ok {
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		var userID string
		err := pool.QueryRow(ctx, `
			SELECT COALESCE(user_id, '') FROM auth_users WHERE id = $1
		`, userNo).Scan(&userID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, http.StatusNotFound, "user not found")
			return
		}
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to create QR data")
			return
		}
		if userID == "" {
			writeJSONError(w, http.StatusConflict, "profile setup is required")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{
			"userId": userID,
			"value":  friendQRValue(userID),
		})
	}
}

func authenticatedUserNo(w http.ResponseWriter, r *http.Request) (int64, bool) {
	claims, err := claimsFromAuthorization(r)
	if err != nil {
		writeJSONError(w, http.StatusUnauthorized, err.Error())
		return 0, false
	}
	userNo, err := strconv.ParseInt(claims.Sub, 10, 64)
	if err != nil || userNo <= 0 {
		writeJSONError(w, http.StatusUnauthorized, "invalid token subject")
		return 0, false
	}
	return userNo, true
}

func canonicalFriendPair(first, second int64) (int64, int64) {
	if first < second {
		return first, second
	}
	return second, first
}

func friendQRValue(userID string) string {
	return "matsunya://friends/add?userId=" + url.QueryEscape(userID)
}
