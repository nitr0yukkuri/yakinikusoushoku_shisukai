package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const wsTicketLifetime = 60 * time.Second

type wsTicket struct {
	UserNo    int64
	UserID    string
	UserName  string
	MeetupID  int64
	ExpiresAt time.Time
}

type wsTicketStore struct {
	mu      sync.Mutex
	tickets map[string]wsTicket
}

type createWSTicketRequest struct {
	MeetupID int64 `json:"meetupId"`
}

func newWSTicketStore() *wsTicketStore {
	return &wsTicketStore{tickets: make(map[string]wsTicket)}
}

func (s *wsTicketStore) issue(ticket wsTicket) (string, error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	value := base64.RawURLEncoding.EncodeToString(random)
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	for key, existing := range s.tickets {
		if !existing.ExpiresAt.After(now) {
			delete(s.tickets, key)
		}
	}
	s.tickets[value] = ticket
	return value, nil
}

func (s *wsTicketStore) consume(value string) (wsTicket, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ticket, ok := s.tickets[value]
	delete(s.tickets, value)
	if !ok || !ticket.ExpiresAt.After(time.Now()) {
		return wsTicket{}, false
	}
	return ticket, true
}

func handleWSTickets(pool *pgxpool.Pool, store *wsTicketStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		userNo, ok := authenticatedUserNo(w, r)
		if !ok {
			return
		}
		var req createWSTicketRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.MeetupID <= 0 {
			writeJSONError(w, http.StatusBadRequest, "valid meetupId is required")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if err := requireAcceptedMeetupMember(ctx, pool, userNo, req.MeetupID); err != nil {
			writeJSONError(w, http.StatusForbidden, "meetup access denied")
			return
		}
		var userID, userName string
		err := pool.QueryRow(ctx, `
			SELECT COALESCE(user_id, ''), COALESCE(name, '')
			FROM auth_users WHERE id = $1
		`, userNo).Scan(&userID, &userName)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, http.StatusNotFound, "user not found")
			return
		}
		if err != nil || userID == "" {
			writeJSONError(w, http.StatusConflict, "profile setup is required")
			return
		}
		expiresAt := time.Now().Add(wsTicketLifetime)
		value, err := store.issue(wsTicket{
			UserNo: userNo, UserID: userID, UserName: userName,
			MeetupID: req.MeetupID, ExpiresAt: expiresAt,
		})
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to create WebSocket ticket")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"ticket":    value,
			"room":      "meetup:" + strconv.FormatInt(req.MeetupID, 10),
			"expiresAt": expiresAt,
		})
	}
}

func checkWebSocketOrigin(r *http.Request) bool {
	return originAllowed(strings.TrimSpace(r.Header.Get("Origin")))
}

func originAllowed(origin string) bool {
	if origin == "" {
		return true
	}
	if isLocalDevelopmentOrigin(origin) {
		return true
	}
	if strings.ToLower(strings.TrimSpace(getEnv("ENV", "development"))) != "production" {
		return true
	}
	for _, allowed := range strings.Split(getEnv("ALLOWED_ORIGINS", ""), ",") {
		allowed = strings.TrimSpace(allowed)
		if allowed == "*" || allowed == origin {
			return true
		}
	}
	return false
}

func isLocalDevelopmentOrigin(origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	if parsed.Scheme == "exp" {
		return isLocalDevelopmentHost(host)
	}
	return host == "localhost" ||
		host == "127.0.0.1" ||
		host == "::1" ||
		strings.HasSuffix(host, ".loca.lt")
}

func isLocalDevelopmentHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}
	if host == "u.expo.dev" || host == "exp.host" || strings.HasSuffix(host, ".exp.direct") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && (ip.IsLoopback() || ip.IsPrivate())
}

func getEnv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
