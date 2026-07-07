package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"google.golang.org/api/idtoken"
)

var upgrader = websocket.Upgrader{CheckOrigin: checkWebSocketOrigin}

// ★追加：到着したユーザーを管理するためのインメモリマップとロック
var (
	arrivedUsersMap = make(map[int64]map[string]bool)
	arrivedMu       sync.Mutex
)

type googleAuthRequest struct {
	IDToken string `json:"idToken"`
}

type authUser struct {
	ID            int64  `json:"id"`
	GoogleSub     string `json:"googleSub"`
	UserID        string `json:"userId"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	PictureURL    string `json:"pictureUrl"`
	ProfileImage  string `json:"profileImage"`
	Bio           string `json:"bio"`
	EmailVerified bool   `json:"emailVerified"`
}

type googleAuthResponse struct {
	Token string   `json:"token"`
	User  authUser `json:"user"`
}

type profileRequest struct {
	UserID       string `json:"userId"`
	UserName     string `json:"userName"`
	ProfileImage string `json:"profileImage"`
	Bio          string `json:"bio"`
}

const maxProfileImageDataURLLength = 6990571

type publicProfile struct {
	UserID       string `json:"userId"`
	Name         string `json:"name"`
	ProfileImage string `json:"profileImage"`
}

type appTokenClaims struct {
	Sub       string  `json:"sub"`
	GoogleSub string  `json:"google_sub"`
	Email     string  `json:"email"`
	Name      string  `json:"name"`
	Iat       float64 `json:"iat"`
	Exp       float64 `json:"exp"`
}

// ====== WebSocket Hub の実装 ======
type wsClient struct {
	hub      *wsHub
	conn     *websocket.Conn
	room     string
	userID   string
	userName string
	send     chan []byte
}

type wsHub struct {
	rooms      map[string]map[*wsClient]bool
	arrivals   map[string]map[string]time.Time
	locations  map[string]map[string][]byte
	broadcast  chan broadcastMessage
	register   chan *wsClient
	unregister chan *wsClient
	mu         sync.Mutex
}

type broadcastMessage struct {
	room string
	data []byte
}

type arrivalTimeMessage struct {
	Type             string `json:"type"`
	UserID           string `json:"userId"`
	Minutes          int64  `json:"minutes,omitempty"`
	RemainingSeconds int64  `json:"remainingSeconds,omitempty"`
	ArrivalAt        int64  `json:"arrivalAt,omitempty"`
	Timestamp        int64  `json:"timestamp,omitempty"`
}

type locationUpdateMessage struct {
	Type           string  `json:"type"`
	UserID         string  `json:"userId"`
	UserName       string  `json:"userName"`
	ProfileVersion string  `json:"profileVersion,omitempty"`
	Lat            float64 `json:"lat"`
	Lng            float64 `json:"lng"`
	Timestamp      int64   `json:"timestamp"`
}

func newWsHub() *wsHub {
	return &wsHub{
		rooms:      make(map[string]map[*wsClient]bool),
		arrivals:   make(map[string]map[string]time.Time),
		locations:  make(map[string]map[string][]byte),
		broadcast:  make(chan broadcastMessage),
		register:   make(chan *wsClient),
		unregister: make(chan *wsClient),
	}
}

func (h *wsHub) run() {
	for {
		select {
		case client := <-h.register:
			var snapshots [][]byte
			h.mu.Lock()
			if h.rooms[client.room] == nil {
				h.rooms[client.room] = make(map[*wsClient]bool)
			}
			h.rooms[client.room][client] = true
			for userID, arrivalAt := range h.arrivals[client.room] {
				snapshots = append(snapshots, buildArrivalUpdate(userID, arrivalAt, time.Now()))
			}
			for _, location := range h.locations[client.room] {
				snapshots = append(snapshots, append([]byte(nil), location...))
			}
			h.mu.Unlock()
			for _, snapshot := range snapshots {
				select {
				case client.send <- snapshot:
				default:
					clientToUnregister := client
					go func() {
						h.unregister <- clientToUnregister
					}()
				}
			}
		case client := <-h.unregister:
			h.mu.Lock()
			if roomClients, ok := h.rooms[client.room]; ok {
				if _, ok := roomClients[client]; ok {
					delete(roomClients, client)
					close(client.send)
					if len(roomClients) == 0 {
						delete(h.rooms, client.room)
						delete(h.locations, client.room)
					}
				}
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.Lock()
			if roomClients, ok := h.rooms[message.room]; ok {
				for client := range roomClients {
					select {
					case client.send <- message.data:
					default:
						close(client.send)
						delete(roomClients, client)
					}
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *wsHub) setLocation(room, userID string, body []byte) {
	h.mu.Lock()
	if h.locations[room] == nil {
		h.locations[room] = make(map[string][]byte)
	}
	h.locations[room][userID] = append([]byte(nil), body...)
	h.mu.Unlock()

	h.broadcast <- broadcastMessage{room: room, data: body}
}

func (h *wsHub) runArrivalTicker() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for now := range ticker.C {
		var updates []broadcastMessage

		h.mu.Lock()
		for room, arrivals := range h.arrivals {
			for userID, arrivalAt := range arrivals {
				updates = append(updates, broadcastMessage{
					room: room,
					data: buildArrivalUpdate(userID, arrivalAt, now),
				})
				if !arrivalAt.After(now) {
					delete(arrivals, userID)
				}
			}
			if len(arrivals) == 0 {
				delete(h.arrivals, room)
			}
		}
		h.mu.Unlock()

		for _, update := range updates {
			h.broadcast <- update
		}
	}
}

func (h *wsHub) setArrival(room string, message arrivalTimeMessage) {
	now := time.Now()
	arrivalAt, ok := nextArrivalTime(message, now)
	if !ok || strings.TrimSpace(message.UserID) == "" {
		return
	}

	userID := strings.TrimSpace(message.UserID)
	h.mu.Lock()
	if h.arrivals[room] == nil {
		h.arrivals[room] = make(map[string]time.Time)
	}
	h.arrivals[room][userID] = arrivalAt
	h.mu.Unlock()

	h.broadcast <- broadcastMessage{
		room: room,
		data: buildArrivalUpdate(userID, arrivalAt, now),
	}
}

func (h *wsHub) clearArrival(room string, message arrivalTimeMessage) {
	userID := strings.TrimSpace(message.UserID)
	if userID == "" {
		return
	}

	h.mu.Lock()
	if arrivals := h.arrivals[room]; arrivals != nil {
		delete(arrivals, userID)
		if len(arrivals) == 0 {
			delete(h.arrivals, room)
		}
	}
	h.mu.Unlock()

	h.broadcast <- broadcastMessage{
		room: room,
		data: buildArrivalUpdate(userID, time.Now(), time.Now()),
	}
}

func nextArrivalTime(message arrivalTimeMessage, now time.Time) (time.Time, bool) {
	switch {
	case message.ArrivalAt > 0:
		return time.UnixMilli(message.ArrivalAt), true
	case message.RemainingSeconds > 0:
		return now.Add(time.Duration(message.RemainingSeconds) * time.Second), true
	case message.Minutes > 0:
		return now.Add(time.Duration(message.Minutes) * time.Minute), true
	default:
		return time.Time{}, false
	}
}

func buildArrivalUpdate(userID string, arrivalAt time.Time, now time.Time) []byte {
	remainingSeconds := int64(math.Ceil(arrivalAt.Sub(now).Seconds()))
	if remainingSeconds < 0 {
		remainingSeconds = 0
	}

	body, err := json.Marshal(arrivalTimeMessage{
		Type:             "ARRIVAL_TIME_UPDATE",
		UserID:           userID,
		ArrivalAt:        arrivalAt.UnixMilli(),
		RemainingSeconds: remainingSeconds,
		Timestamp:        now.UnixMilli(),
	})
	if err != nil {
		return []byte(`{"type":"ARRIVAL_TIME_UPDATE","remainingSeconds":0}`)
	}
	return body
}

func (c *wsClient) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(4096)
	_ = c.conn.SetReadDeadline(time.Now().Add(70 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(70 * time.Second))
	})
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var envelope struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(message, &envelope); err != nil {
			continue
		}
		switch envelope.Type {
		case "LOCATION_UPDATE":
			var location locationUpdateMessage
			if err := json.Unmarshal(message, &location); err != nil ||
				math.IsNaN(location.Lat) || math.IsNaN(location.Lng) ||
				location.Lat < -90 || location.Lat > 90 || location.Lng < -180 || location.Lng > 180 {
				continue
			}
			location.UserID = c.userID
			location.UserName = c.userName
			location.Timestamp = time.Now().UnixMilli()
			body, err := json.Marshal(location)
			if err == nil {
				c.hub.setLocation(c.room, location.UserID, body)
			}
		case "ARRIVAL_TIME_SET", "ARRIVAL_TIME_CLEAR":
			var arrival arrivalTimeMessage
			if err := json.Unmarshal(message, &arrival); err != nil {
				continue
			}
			arrival.UserID = c.userID
			if envelope.Type == "ARRIVAL_TIME_SET" {
				c.hub.setArrival(c.room, arrival)
			} else {
				c.hub.clearArrival(c.room, arrival)
			}
		}
	}
}

func (c *wsClient) writePump() {
	defer c.conn.Close()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				return
			}
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ====== WebSocket Hub の実装ここまで ======

func main() {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	ctx := context.Background()
	dburl := os.Getenv("DATABASE_URL")
	if dburl == "" {
		log.Fatal("DATABASE_URL is required")
	}

	pool, err := pgxpool.New(ctx, dburl)
	if err != nil {
		log.Fatalf("failed to connect db: %v", err)
	}
	defer pool.Close()

	ctxPing, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(ctxPing); err != nil {
		log.Fatalf("db ping failed: %v", err)
	}
	ctxSchema, cancelSchema := context.WithTimeout(ctx, 30*time.Second)
	defer cancelSchema()
	if err := ensureAuthProfileSchema(ctxSchema, pool); err != nil {
		log.Fatalf("auth profile schema failed: %v", err)
	}
	if err := ensureFriendSchema(ctxSchema, pool); err != nil {
		log.Fatalf("friend schema failed: %v", err)
	}
	if err := ensureMeetupSchema(ctxSchema, pool); err != nil {
		log.Fatalf("meetup schema failed: %v", err)
	}
	if err := ensureNotificationSchema(ctxSchema, pool); err != nil {
		log.Fatalf("notification schema failed: %v", err)
	}

	// Hubの起動
	hub := newWsHub()
	wsTickets := newWSTicketStore()
	go hub.run()
	go hub.runArrivalTicker()

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte("ok"))
	})

	http.HandleFunc("/auth/google", withCORS(handleGoogleAuth(pool)))
	http.HandleFunc("/auth/profile", withCORS(handleAuthProfile(pool)))
	http.HandleFunc("/profiles", withCORS(handlePublicProfile(pool)))
	http.HandleFunc("/friends", withCORS(handleFriends(pool)))
	http.HandleFunc("/friends/search", withCORS(handleFriendSearch(pool)))
	http.HandleFunc("/friends/requests", withCORS(handleFriendRequests(pool)))
	http.HandleFunc("/friends/qr", withCORS(handleFriendQR(pool)))
	http.HandleFunc("/notifications", withCORS(handleNotifications(pool)))
	http.HandleFunc("/meetups", withCORS(handleMeetups(pool)))
	http.HandleFunc("/meetups/", withCORS(handleMeetupResource(pool)))
	http.HandleFunc("/spots/", withCORS(handleSpots(pool)))
	http.HandleFunc("/ws/tickets", withCORS(handleWSTickets(pool, wsTickets)))

	// ★追加：到着記録用エンドポイント
	http.HandleFunc("/meetups/arrive", withCORS(handleMeetupArrive()))
	// ★追加：到着状況取得用エンドポイント
	http.HandleFunc("/meetups/arrive_status", withCORS(handleMeetupArriveStatus()))

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ticket, ok := wsTickets.consume(strings.TrimSpace(r.URL.Query().Get("ticket")))
		if !ok {
			writeJSONError(w, http.StatusUnauthorized, "valid WebSocket ticket is required")
			return
		}
		ctxAccess, cancelAccess := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancelAccess()
		if err := requireAcceptedMeetupMember(ctxAccess, pool, ticket.UserNo, ticket.MeetupID); err != nil {
			writeJSONError(w, http.StatusForbidden, "meetup access denied")
			return
		}
		room := fmt.Sprintf("meetup:%d", ticket.MeetupID)

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("upgrade error: %v", err)
			return
		}

		client := &wsClient{
			hub: hub, conn: conn, room: room,
			userID: ticket.UserID, userName: ticket.UserName,
			send: make(chan []byte, 256),
		}
		client.hub.register <- client

		go client.writePump()
		go client.readPump()
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := fmt.Sprintf(":%s", port)
	log.Printf("listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if !originAllowed(origin) {
			writeJSONError(w, http.StatusForbidden, "origin is not allowed")
			return
		}
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

// ★追加：到着ボタンを押したときに呼ばれる関数
func handleMeetupArrive() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			MeetupID int64  `json:"meetupId"`
			UserID   string `json:"userId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, http.StatusBadRequest, "bad request")
			return
		}

		arrivedMu.Lock()
		if arrivedUsersMap[req.MeetupID] == nil {
			arrivedUsersMap[req.MeetupID] = make(map[string]bool)
		}
		arrivedUsersMap[req.MeetupID][req.UserID] = true
		arrivedMu.Unlock()

		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

// ★追加：全員到着したかどうかを確認するための関数
func handleMeetupArriveStatus() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		meetupIDStr := r.URL.Query().Get("meetupId")
		meetupID, _ := strconv.ParseInt(meetupIDStr, 10, 64)

		arrivedMu.Lock()
		users := arrivedUsersMap[meetupID]
		arrivedList := make([]string, 0)
		for uid, arrived := range users {
			if arrived {
				arrivedList = append(arrivedList, uid)
			}
		}
		arrivedMu.Unlock()

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"arrivedUsers": arrivedList,
		})
	}
}

func handleGoogleAuth(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		var req googleAuthRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid json body")
			return
		}
		if req.IDToken == "" {
			writeJSONError(w, http.StatusBadRequest, "idToken is required")
			return
		}

		clientIDs := googleClientIDs()
		if len(clientIDs) == 0 {
			writeJSONError(w, http.StatusInternalServerError, "Google client ID is not configured")
			return
		}

		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			writeJSONError(w, http.StatusInternalServerError, "JWT_SECRET is not configured")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		payload, err := validateGoogleIDToken(ctx, req.IDToken, clientIDs)
		if err != nil {
			log.Printf("google id token validation error: %v", err)
			writeJSONError(w, http.StatusUnauthorized, "invalid google id token")
			return
		}

		user, err := upsertAuthUser(ctx, pool, payload)
		if err != nil {
			log.Printf("auth user upsert error: %v", err)
			writeJSONError(w, http.StatusInternalServerError, "failed to save user")
			return
		}

		token, err := signAppToken(user, jwtSecret)
		if err != nil {
			log.Printf("app token signing error: %v", err)
			writeJSONError(w, http.StatusInternalServerError, "failed to sign token")
			return
		}

		writeJSON(w, http.StatusOK, googleAuthResponse{Token: token, User: user})
	}
}

func googleClientIDs() []string {
	keys := []string{
		"GOOGLE_CLIENT_ID",
		"EXPO_PUBLIC_GOOGLE_CLIENT_ID",
		"GOOGLE_IOS_CLIENT_ID",
		"EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
		"GOOGLE_ANDROID_CLIENT_ID",
		"EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
	}
	seen := make(map[string]bool, len(keys))
	clientIDs := make([]string, 0, len(keys))
	for _, key := range keys {
		clientID := strings.TrimSpace(os.Getenv(key))
		if clientID == "" || seen[clientID] {
			continue
		}
		seen[clientID] = true
		clientIDs = append(clientIDs, clientID)
	}
	return clientIDs
}

func validateGoogleIDToken(ctx context.Context, token string, clientIDs []string) (*idtoken.Payload, error) {
	var errs []string
	for _, clientID := range clientIDs {
		payload, err := idtoken.Validate(ctx, token, clientID)
		if err == nil {
			return payload, nil
		}
		errs = append(errs, err.Error())
	}
	return nil, fmt.Errorf("no configured Google client ID matched token audience: %s", strings.Join(errs, "; "))
}

func upsertAuthUser(ctx context.Context, pool *pgxpool.Pool, payload *idtoken.Payload) (authUser, error) {
	email := claimString(payload.Claims, "email")
	name := claimString(payload.Claims, "name")
	pictureURL := claimString(payload.Claims, "picture")
	emailVerified := claimBool(payload.Claims, "email_verified")

	var user authUser
	err := pool.QueryRow(ctx, `
		INSERT INTO auth_users (google_sub, email, name, picture_url, email_verified)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (google_sub) DO UPDATE SET
			email = EXCLUDED.email,
			picture_url = EXCLUDED.picture_url,
			email_verified = EXCLUDED.email_verified,
			updated_at = now()
		RETURNING id, google_sub, COALESCE(user_id, ''), COALESCE(email, ''),
			COALESCE(name, ''), COALESCE(picture_url, ''), COALESCE(profile_image, ''),
			COALESCE(bio, ''), email_verified
	`, payload.Subject, email, name, pictureURL, emailVerified).Scan(
		&user.ID,
		&user.GoogleSub,
		&user.UserID,
		&user.Email,
		&user.Name,
		&user.PictureURL,
		&user.ProfileImage,
		&user.Bio,
		&user.EmailVerified,
	)
	return user, err
}

func ensureAuthProfileSchema(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
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
		CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users (email);
		ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS user_id TEXT;
		ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS profile_image TEXT;
		ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS bio TEXT;
		CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_user_id ON auth_users (user_id) WHERE user_id IS NOT NULL;
	`)
	return err
}

func handleAuthProfile(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodPost && r.Method != http.MethodPut {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		claims, err := claimsFromAuthorization(r)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, err.Error())
			return
		}

		userNo, err := strconv.ParseInt(claims.Sub, 10, 64)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, "invalid token subject")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		if r.Method == http.MethodGet {
			user, err := selectAuthUser(ctx, pool, userNo)
			if err != nil {
				log.Printf("auth profile read error: %v", err)
				writeJSONError(w, http.StatusInternalServerError, "failed to read profile")
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"user": user})
			return
		}

		var req profileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid json body")
			return
		}

		req.UserID = strings.TrimSpace(req.UserID)
		req.UserName = strings.TrimSpace(req.UserName)
		req.ProfileImage = strings.TrimSpace(req.ProfileImage)
		req.Bio = strings.TrimSpace(req.Bio)
		if req.UserID == "" || req.UserName == "" {
			writeJSONError(w, http.StatusBadRequest, "userId and userName are required")
			return
		}
		if !isUserID(req.UserID) {
			writeJSONError(w, http.StatusBadRequest, "userId must be alphanumeric")
			return
		}
		if len(req.ProfileImage) > maxProfileImageDataURLLength {
			writeJSONError(w, http.StatusRequestEntityTooLarge, "profile image is too large")
			return
		}

		var user authUser
		err = pool.QueryRow(ctx, `
			UPDATE auth_users
			SET user_id = $1,
				name = $2,
				profile_image = NULLIF($3, ''),
				bio = NULLIF($4, ''),
				updated_at = now()
			WHERE id = $5
			RETURNING id, google_sub, COALESCE(user_id, ''), COALESCE(email, ''),
				COALESCE(name, ''), COALESCE(picture_url, ''), COALESCE(profile_image, ''),
				COALESCE(bio, ''), email_verified
		`, req.UserID, req.UserName, req.ProfileImage, req.Bio, userNo).Scan(
			&user.ID,
			&user.GoogleSub,
			&user.UserID,
			&user.Email,
			&user.Name,
			&user.PictureURL,
			&user.ProfileImage,
			&user.Bio,
			&user.EmailVerified,
		)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				writeJSONError(w, http.StatusConflict, "userId is already in use")
				return
			}
			log.Printf("auth profile update error: %v", err)
			writeJSONError(w, http.StatusInternalServerError, "failed to save profile")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"user": user})
	}
}

func selectAuthUser(ctx context.Context, pool *pgxpool.Pool, userNo int64) (authUser, error) {
	var user authUser
	err := pool.QueryRow(ctx, `
		SELECT id, google_sub, COALESCE(user_id, ''), COALESCE(email, ''),
			COALESCE(name, ''), COALESCE(picture_url, ''), COALESCE(profile_image, ''),
			COALESCE(bio, ''), email_verified
		FROM auth_users
		WHERE id = $1
	`, userNo).Scan(
		&user.ID,
		&user.GoogleSub,
		&user.UserID,
		&user.Email,
		&user.Name,
		&user.PictureURL,
		&user.ProfileImage,
		&user.Bio,
		&user.EmailVerified,
	)
	return user, err
}

func handlePublicProfile(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		userID := strings.TrimSpace(r.URL.Query().Get("userId"))
		if userID == "" || !isUserID(userID) {
			writeJSONError(w, http.StatusBadRequest, "valid userId is required")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		var profile publicProfile
		err := pool.QueryRow(ctx, `
			SELECT user_id, COALESCE(name, ''), COALESCE(profile_image, '')
			FROM auth_users
			WHERE user_id = $1
		`, userID).Scan(&profile.UserID, &profile.Name, &profile.ProfileImage)
		if err != nil {
			writeJSONError(w, http.StatusNotFound, "profile not found")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"profile": profile})
	}
}

func claimsFromAuthorization(r *http.Request) (appTokenClaims, error) {
	auth := r.Header.Get("Authorization")
	token, ok := strings.CutPrefix(auth, "Bearer ")
	if !ok || strings.TrimSpace(token) == "" {
		return appTokenClaims{}, fmt.Errorf("authorization token is required")
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return appTokenClaims{}, fmt.Errorf("JWT_SECRET is not configured")
	}
	return validateAppToken(strings.TrimSpace(token), secret)
}

func signAppToken(user authUser, secret string) (string, error) {
	now := time.Now()
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	claims := map[string]any{
		"sub":        strconv.FormatInt(user.ID, 10),
		"google_sub": user.GoogleSub,
		"email":      user.Email,
		"name":       user.Name,
		"iat":        now.Unix(),
		"exp":        now.Add(24 * time.Hour).Unix(),
	}

	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	unsigned := base64.RawURLEncoding.EncodeToString(headerJSON) + "." + base64.RawURLEncoding.EncodeToString(claimsJSON)
	mac := hmac.New(sha256.New, []byte(secret))
	if _, err := mac.Write([]byte(unsigned)); err != nil {
		return "", err
	}
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return unsigned + "." + signature, nil
}

func validateAppToken(token string, secret string) (appTokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return appTokenClaims{}, fmt.Errorf("invalid token")
	}

	unsigned := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	if _, err := mac.Write([]byte(unsigned)); err != nil {
		return appTokenClaims{}, err
	}
	expected := mac.Sum(nil)
	actual, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(actual, expected) {
		return appTokenClaims{}, fmt.Errorf("invalid token")
	}

	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return appTokenClaims{}, fmt.Errorf("invalid token")
	}
	var claims appTokenClaims
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return appTokenClaims{}, fmt.Errorf("invalid token")
	}
	if claims.Exp <= float64(time.Now().Unix()) {
		return appTokenClaims{}, fmt.Errorf("token expired")
	}
	return claims, nil
}

func isUserID(value string) bool {
	for _, r := range value {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '_' {
			return false
		}
	}
	return true
}

func claimString(claims map[string]any, key string) string {
	value, ok := claims[key].(string)
	if !ok {
		return ""
	}
	return value
}

func claimBool(claims map[string]any, key string) bool {
	value, ok := claims[key].(bool)
	return ok && value
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("json response error: %v", err)
	}
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": localizeErrorMessage(status, message)})
}
