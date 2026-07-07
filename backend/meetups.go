package main

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type meetup struct {
	ID               int64          `json:"id"`
	OwnerUserID      string         `json:"ownerUserId"`
	ScheduledAt      time.Time      `json:"scheduledAt"`
	PlaceName        string         `json:"placeName"`
	GooglePlaceID    string         `json:"googlePlaceId,omitempty"`
	Latitude         float64        `json:"latitude"`
	Longitude        float64        `json:"longitude"`
	Status           string         `json:"status"`
	InviteCode       string         `json:"inviteCode"`
	MembershipStatus string         `json:"membershipStatus"`
	Members          []meetupMember `json:"members,omitempty"`
	CreatedAt        time.Time      `json:"createdAt"`
}

type meetupMember struct {
	UserID       string `json:"userId"`
	Name         string `json:"name"`
	ProfileImage string `json:"profileImage"`
	Role         string `json:"role"`
	Status       string `json:"status"`
}

type createMeetupRequest struct {
	ScheduledAt   string   `json:"scheduledAt"`
	PlaceName     string   `json:"placeName"`
	GooglePlaceID string   `json:"googlePlaceId"`
	Latitude      float64  `json:"latitude"`
	Longitude     float64  `json:"longitude"`
	FriendUserIDs []string `json:"friendUserIds"`
}

type updateMeetupRequest struct {
	ScheduledAt   string  `json:"scheduledAt"`
	PlaceName     string  `json:"placeName"`
	GooglePlaceID *string `json:"googlePlaceId"`
	Latitude      float64 `json:"latitude"`
	Longitude     float64 `json:"longitude"`
	Status        string  `json:"status"`
}

type joinMeetupRequest struct {
	InviteCode string `json:"inviteCode"`
}

type updateMeetupMemberRequest struct {
	Action string `json:"action"`
	UserID string `json:"userId"`
}

func ensureMeetupSchema(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
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
			route_polyline TEXT,
			arrival_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			PRIMARY KEY (meetup_id, user_id)
		);
		ALTER TABLE meetup_arrival_estimates ADD COLUMN IF NOT EXISTS route_polyline TEXT;
	`)
	return err
}

func handleMeetups(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/meetups" {
			writeJSONError(w, http.StatusNotFound, "not found")
			return
		}
		userNo, ok := authenticatedUserNo(w, r)
		if !ok {
			return
		}
		switch r.Method {
		case http.MethodGet:
			listMeetups(w, r, pool, userNo)
		case http.MethodPost:
			createMeetup(w, r, pool, userNo)
		default:
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	}
}

func handleMeetupResource(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userNo, ok := authenticatedUserNo(w, r)
		if !ok {
			return
		}
		parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/meetups/"), "/"), "/")
		if len(parts) == 1 && parts[0] == "join" {
			if r.Method != http.MethodPost {
				writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
				return
			}
			joinMeetup(w, r, pool, userNo)
			return
		}

		meetupID, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil || meetupID <= 0 {
			writeJSONError(w, http.StatusNotFound, "meetup not found")
			return
		}
		if len(parts) == 1 {
			switch r.Method {
			case http.MethodGet:
				getMeetup(w, r, pool, userNo, meetupID)
			case http.MethodPut:
				updateMeetup(w, r, pool, userNo, meetupID)
			case http.MethodDelete:
				cancelMeetup(w, r, pool, userNo, meetupID)
			default:
				writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
			return
		}
		if len(parts) == 2 && parts[1] == "members" {
			if r.Method != http.MethodPut {
				writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
				return
			}
			updateMeetupMember(w, r, pool, userNo, meetupID)
			return
		}
		if len(parts) == 2 && parts[1] == "eta" {
			switch r.Method {
			case http.MethodGet:
				listMeetupETAs(w, r, pool, userNo, meetupID)
			case http.MethodPost:
				calculateMeetupETA(w, r, pool, userNo, meetupID)
			default:
				writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
			return
		}
		writeJSONError(w, http.StatusNotFound, "not found")
	}
}

func listMeetups(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo int64) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	rows, err := pool.Query(ctx, `
		SELECT m.id, owner.user_id, m.scheduled_at, m.place_name,
			COALESCE(m.google_place_id, ''), m.latitude,
			m.longitude, m.status, m.invite_code, mm.status, m.created_at
		FROM meetup_members mm
		JOIN meetups m ON m.id = mm.meetup_id
		JOIN auth_users owner ON owner.id = m.owner_id
		WHERE mm.user_id = $1
		ORDER BY m.scheduled_at DESC, m.id DESC
	`, userNo)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read meetups")
		return
	}
	defer rows.Close()
	meetups := make([]meetup, 0)
	for rows.Next() {
		var item meetup
		if err := scanMeetup(rows, &item); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to read meetups")
			return
		}
		meetups = append(meetups, item)
	}
	if err := rows.Err(); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read meetups")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"meetups": meetups})
}

func createMeetup(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo int64) {
	var req createMeetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	if err := resolveMeetupSpot(ctx, req.GooglePlaceID, &req.PlaceName, &req.Latitude, &req.Longitude); err != nil {
		writeJSONError(w, http.StatusBadGateway, "failed to resolve spot")
		return
	}
	scheduledAt, err := validateMeetupInput(req.ScheduledAt, req.PlaceName, req.Latitude, req.Longitude)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	inviteCode, err := newInviteCode()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create meetup")
		return
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create meetup")
		return
	}
	defer tx.Rollback(ctx)

	var meetupID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO meetups (owner_id, scheduled_at, place_name, google_place_id, latitude, longitude, invite_code)
		VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7)
		RETURNING id
	`, userNo, scheduledAt, strings.TrimSpace(req.PlaceName), strings.TrimSpace(req.GooglePlaceID), req.Latitude, req.Longitude, inviteCode).Scan(&meetupID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create meetup")
		return
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO meetup_members (meetup_id, user_id, role, status, invited_by)
		VALUES ($1, $2, 'owner', 'accepted', $2)
	`, meetupID, userNo); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create meetup")
		return
	}

	seen := make(map[string]bool)
	for _, rawUserID := range req.FriendUserIDs {
		friendUserID := strings.TrimSpace(rawUserID)
		if friendUserID == "" || seen[friendUserID] {
			continue
		}
		seen[friendUserID] = true
		var invitedUserNo int64
		err := tx.QueryRow(ctx, `
			INSERT INTO meetup_members (meetup_id, user_id, role, status, invited_by)
			SELECT $1, target.id, 'member', 'invited', $2
			FROM auth_users target
			JOIN friendships f ON f.user_low_id = LEAST($2, target.id)
				AND f.user_high_id = GREATEST($2, target.id)
			WHERE target.user_id = $3
			ON CONFLICT (meetup_id, user_id) DO NOTHING
			RETURNING user_id
		`, meetupID, userNo, friendUserID).Scan(&invitedUserNo)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, http.StatusBadRequest, "invited user must be your friend: "+friendUserID)
			return
		}
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to invite friend")
			return
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO user_notifications (user_id, type, actor_id, meetup_id)
			VALUES ($1, 'meetup_invitation_received', $2, $3)
			ON CONFLICT (user_id, type, meetup_id) WHERE meetup_id IS NOT NULL DO NOTHING
		`, invitedUserNo, userNo, meetupID); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to create meetup invitation notification")
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create meetup")
		return
	}
	item, err := selectMeetup(r.Context(), pool, userNo, meetupID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "meetup was created but could not be read")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"meetup": item})
}

func getMeetup(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo, meetupID int64) {
	item, err := selectMeetup(r.Context(), pool, userNo, meetupID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSONError(w, http.StatusNotFound, "meetup not found")
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read meetup")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"meetup": item})
}

func selectMeetup(parent context.Context, pool *pgxpool.Pool, userNo, meetupID int64) (meetup, error) {
	ctx, cancel := context.WithTimeout(parent, 5*time.Second)
	defer cancel()
	var item meetup
	err := pool.QueryRow(ctx, `
		SELECT m.id, owner.user_id, m.scheduled_at, m.place_name,
			COALESCE(m.google_place_id, ''), m.latitude,
			m.longitude, m.status, m.invite_code, mm.status, m.created_at
		FROM meetups m
		JOIN auth_users owner ON owner.id = m.owner_id
		JOIN meetup_members mm ON mm.meetup_id = m.id AND mm.user_id = $1
		WHERE m.id = $2
	`, userNo, meetupID).Scan(
		&item.ID, &item.OwnerUserID, &item.ScheduledAt, &item.PlaceName,
		&item.GooglePlaceID, &item.Latitude, &item.Longitude, &item.Status, &item.InviteCode,
		&item.MembershipStatus, &item.CreatedAt,
	)
	if err != nil {
		return meetup{}, err
	}
	rows, err := pool.Query(ctx, `
		SELECT u.user_id, COALESCE(u.name, ''),
			COALESCE(NULLIF(u.profile_image, ''), NULLIF(u.picture_url, ''), ''),
			mm.role, mm.status
		FROM meetup_members mm
		JOIN auth_users u ON u.id = mm.user_id
		WHERE mm.meetup_id = $1
		ORDER BY CASE WHEN mm.role = 'owner' THEN 0 ELSE 1 END, LOWER(u.name)
	`, meetupID)
	if err != nil {
		return meetup{}, err
	}
	defer rows.Close()
	item.Members = make([]meetupMember, 0)
	for rows.Next() {
		var member meetupMember
		if err := rows.Scan(&member.UserID, &member.Name, &member.ProfileImage, &member.Role, &member.Status); err != nil {
			return meetup{}, err
		}
		item.Members = append(item.Members, member)
	}
	return item, rows.Err()
}

func updateMeetup(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo, meetupID int64) {
	var req updateMeetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	if req.GooglePlaceID != nil {
		if err := resolveMeetupSpot(ctx, *req.GooglePlaceID, &req.PlaceName, &req.Latitude, &req.Longitude); err != nil {
			writeJSONError(w, http.StatusBadGateway, "failed to resolve spot")
			return
		}
	}
	scheduledAt, err := validateMeetupInput(req.ScheduledAt, req.PlaceName, req.Latitude, req.Longitude)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "scheduled"
	}
	if status != "scheduled" && status != "active" && status != "completed" {
		writeJSONError(w, http.StatusBadRequest, "invalid meetup status")
		return
	}
	command, err := pool.Exec(ctx, `
		UPDATE meetups
		SET scheduled_at = $1, place_name = $2,
			google_place_id = CASE WHEN $3 THEN NULLIF($4, '') ELSE google_place_id END,
			latitude = $5, longitude = $6, status = $7, updated_at = now()
		WHERE id = $8 AND owner_id = $9 AND status <> 'cancelled'
	`, scheduledAt, strings.TrimSpace(req.PlaceName), req.GooglePlaceID != nil,
		optionalTrimmedString(req.GooglePlaceID), req.Latitude, req.Longitude, status, meetupID, userNo)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to update meetup")
		return
	}
	if command.RowsAffected() == 0 {
		writeJSONError(w, http.StatusNotFound, "meetup not found or not owned by you")
		return
	}
	item, err := selectMeetup(r.Context(), pool, userNo, meetupID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "meetup was updated but could not be read")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"meetup": item})
}

func cancelMeetup(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo, meetupID int64) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	command, err := pool.Exec(ctx, `
		UPDATE meetups SET status = 'cancelled', updated_at = now()
		WHERE id = $1 AND owner_id = $2 AND status <> 'cancelled'
	`, meetupID, userNo)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to cancel meetup")
		return
	}
	if command.RowsAffected() == 0 {
		command, err = pool.Exec(ctx, `
			UPDATE meetup_members mm
			SET status = 'declined', updated_at = now()
			FROM meetups m
			WHERE mm.meetup_id = $1 AND mm.user_id = $2 AND mm.role = 'member'
				AND mm.status <> 'declined' AND m.id = mm.meetup_id
				AND m.status <> 'cancelled'
		`, meetupID, userNo)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to leave meetup")
			return
		}
		if command.RowsAffected() == 0 {
			writeJSONError(w, http.StatusNotFound, "meetup not found")
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func joinMeetup(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo int64) {
	var req joinMeetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	req.InviteCode = strings.ToUpper(strings.TrimSpace(req.InviteCode))
	if req.InviteCode == "" {
		writeJSONError(w, http.StatusBadRequest, "inviteCode is required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	var meetupID int64
	err := pool.QueryRow(ctx, `
		INSERT INTO meetup_members (meetup_id, user_id, role, status)
		SELECT m.id, $1, 'member', 'accepted'
		FROM meetups m
		WHERE m.invite_code = $2 AND m.status IN ('scheduled', 'active')
		ON CONFLICT (meetup_id, user_id) DO UPDATE
		SET status = 'accepted', updated_at = now()
		RETURNING meetup_id
	`, userNo, req.InviteCode).Scan(&meetupID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSONError(w, http.StatusNotFound, "valid meetup invitation not found")
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to join meetup")
		return
	}
	item, err := selectMeetup(r.Context(), pool, userNo, meetupID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "meetup was joined but could not be read")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"meetup": item})
}

func updateMeetupMember(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo, meetupID int64) {
	var req updateMeetupMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	switch req.Action {
	case "accept", "decline":
		status := map[string]string{"accept": "accepted", "decline": "declined"}[req.Action]
		result, err := pool.Exec(ctx, `
			UPDATE meetup_members SET status = $1, updated_at = now()
			WHERE meetup_id = $2 AND user_id = $3 AND role = 'member'
		`, status, meetupID, userNo)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to update invitation")
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, http.StatusNotFound, "invitation not found")
			return
		}
	case "remove":
		targetUserID := strings.TrimSpace(req.UserID)
		result, err := pool.Exec(ctx, `
			DELETE FROM meetup_members mm
			USING meetups m, auth_users target
			WHERE mm.meetup_id = $1 AND m.id = mm.meetup_id AND m.owner_id = $2
				AND target.user_id = $3 AND mm.user_id = target.id AND mm.role = 'member'
		`, meetupID, userNo, targetUserID)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to remove member")
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, http.StatusNotFound, "member not found or not owned by you")
			return
		}
	default:
		writeJSONError(w, http.StatusBadRequest, "action must be accept, decline, or remove")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func requireAcceptedMeetupMember(ctx context.Context, pool *pgxpool.Pool, userNo, meetupID int64) error {
	var allowed bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM meetup_members mm
			JOIN meetups m ON m.id = mm.meetup_id
			WHERE mm.meetup_id = $1 AND mm.user_id = $2 AND mm.status = 'accepted'
				AND m.status IN ('scheduled', 'active')
		)
	`, meetupID, userNo).Scan(&allowed)
	if err != nil {
		return err
	}
	if !allowed {
		return fmt.Errorf("meetup access denied")
	}
	return nil
}

func validateMeetupInput(scheduledAtText, placeName string, latitude, longitude float64) (time.Time, error) {
	scheduledAt, err := time.Parse(time.RFC3339, strings.TrimSpace(scheduledAtText))
	if err != nil {
		return time.Time{}, fmt.Errorf("scheduledAt must be RFC3339")
	}
	if strings.TrimSpace(placeName) == "" {
		return time.Time{}, fmt.Errorf("placeName is required")
	}
	if math.IsNaN(latitude) || math.IsInf(latitude, 0) || latitude < -90 || latitude > 90 {
		return time.Time{}, fmt.Errorf("valid latitude is required")
	}
	if math.IsNaN(longitude) || math.IsInf(longitude, 0) || longitude < -180 || longitude > 180 {
		return time.Time{}, fmt.Errorf("valid longitude is required")
	}
	return scheduledAt, nil
}

func resolveMeetupSpot(ctx context.Context, googlePlaceID string, placeName *string, latitude, longitude *float64) error {
	googlePlaceID = strings.TrimSpace(googlePlaceID)
	if googlePlaceID == "" {
		return nil
	}
	if len(googlePlaceID) > 512 {
		return fmt.Errorf("google place ID is too long")
	}
	item, err := fetchGooglePlace(ctx, googlePlaceID)
	if err != nil {
		return err
	}
	if item.PlaceID == "" || strings.TrimSpace(item.Name) == "" {
		return fmt.Errorf("spot is missing required fields")
	}
	*placeName = item.Name
	*latitude = item.Latitude
	*longitude = item.Longitude
	return nil
}

func optionalTrimmedString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func newInviteCode() (string, error) {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return strings.TrimRight(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(bytes), "="), nil
}

type meetupRowScanner interface {
	Scan(dest ...any) error
}

func scanMeetup(row meetupRowScanner, item *meetup) error {
	return row.Scan(
		&item.ID, &item.OwnerUserID, &item.ScheduledAt, &item.PlaceName,
		&item.GooglePlaceID, &item.Latitude, &item.Longitude, &item.Status, &item.InviteCode,
		&item.MembershipStatus, &item.CreatedAt,
	)
}
