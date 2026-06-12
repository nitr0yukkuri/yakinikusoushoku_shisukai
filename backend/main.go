package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"google.golang.org/api/idtoken"
)

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}

type googleAuthRequest struct {
	IDToken string `json:"idToken"`
}

type authUser struct {
	ID            int64  `json:"id"`
	GoogleSub     string `json:"googleSub"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	PictureURL    string `json:"pictureUrl"`
	EmailVerified bool   `json:"emailVerified"`
}

type googleAuthResponse struct {
	Token string   `json:"token"`
	User  authUser `json:"user"`
}

// ★追加: Bio（自己紹介）を追加しました
type profileRequest struct {
	UserID       string `json:"userId"`
	UserName     string `json:"userName"`
	ProfileImage string `json:"profileImage"`
	Bio          string `json:"bio"`
}

type appTokenClaims struct {
	Sub       string  `json:"sub"`
	GoogleSub string  `json:"google_sub"`
	Email     string  `json:"email"`
	Name      string  `json:"name"`
	Iat       float64 `json:"iat"`
	Exp       float64 `json:"exp"`
}

func main() {
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

	// simple ping
	ctxPing, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(ctxPing); err != nil {
		log.Fatalf("db ping failed: %v", err)
	}
	ctxSchema, cancelSchema := context.WithTimeout(ctx, 10*time.Second)
	defer cancelSchema()
	if err := ensureAuthProfileSchema(ctxSchema, pool); err != nil {
		log.Fatalf("auth profile schema failed: %v", err)
	}

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte("ok"))
	})

	http.HandleFunc("/auth/google", withCORS(handleGoogleAuth(pool)))
	http.HandleFunc("/auth/profile", withCORS(handleAuthProfile(pool)))

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("upgrade error: %v", err)
			return
		}
		defer conn.Close()

		for {
			mt, msg, err := conn.ReadMessage()
			if err != nil {
				log.Printf("read error: %v", err)
				break
			}

			// store message to DB (simple example)
			_, err = pool.Exec(ctx, "INSERT INTO messages (content) VALUES ($1)", string(msg))
			if err != nil {
				log.Printf("db insert error: %v", err)
			}

			// echo back
			if err := conn.WriteMessage(mt, msg); err != nil {
				log.Printf("write error: %v", err)
				break
			}
		}
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
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "POST, PUT, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
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

		clientID := os.Getenv("GOOGLE_CLIENT_ID")
		if clientID == "" {
			clientID = os.Getenv("EXPO_PUBLIC_GOOGLE_CLIENT_ID")
		}
		if clientID == "" {
			writeJSONError(w, http.StatusInternalServerError, "GOOGLE_CLIENT_ID is not configured")
			return
		}

		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			writeJSONError(w, http.StatusInternalServerError, "JWT_SECRET is not configured")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		payload, err := idtoken.Validate(ctx, req.IDToken, clientID)
		if err != nil {
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
			name = EXCLUDED.name,
			picture_url = EXCLUDED.picture_url,
			email_verified = EXCLUDED.email_verified,
			updated_at = now()
		RETURNING id, google_sub, COALESCE(email, ''), COALESCE(name, ''), COALESCE(picture_url, ''), email_verified
	`, payload.Subject, email, name, pictureURL, emailVerified).Scan(
		&user.ID,
		&user.GoogleSub,
		&user.Email,
		&user.Name,
		&user.PictureURL,
		&user.EmailVerified,
	)
	return user, err
}

func ensureAuthProfileSchema(ctx context.Context, pool *pgxpool.Pool) error {
	// ★追加: データベースのauth_usersテーブルに「bio」カラムを自動追加するSQL
	_, err := pool.Exec(ctx, `
		ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS user_id TEXT;
		ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS profile_image TEXT;
		ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS bio TEXT;
		CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_user_id ON auth_users (user_id) WHERE user_id IS NOT NULL;
	`)
	return err
}

func handleAuthProfile(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost && r.Method != http.MethodPut {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		claims, err := claimsFromAuthorization(r)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, err.Error())
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
		req.Bio = strings.TrimSpace(req.Bio) // ★追加

		// ★修正: userIdが空でもエラーにしないように変更
		if req.UserName == "" {
			writeJSONError(w, http.StatusBadRequest, "userName is required")
			return
		}
		if req.UserID != "" && !isUserID(req.UserID) {
			writeJSONError(w, http.StatusBadRequest, "userId must be alphanumeric")
			return
		}

		userNo, err := strconv.ParseInt(claims.Sub, 10, 64)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, "invalid token subject")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		var user authUser
		// ★修正: DBへの保存処理にbioを含めました
		err = pool.QueryRow(ctx, `
			UPDATE auth_users
			SET user_id = NULLIF($1, ''),
				name = $2,
				profile_image = NULLIF($3, ''),
				bio = $4,
				updated_at = now()
			WHERE id = $5
			RETURNING id, google_sub, COALESCE(email, ''), COALESCE(name, ''), COALESCE(picture_url, ''), email_verified
		`, req.UserID, req.UserName, req.ProfileImage, req.Bio, userNo).Scan(
			&user.ID,
			&user.GoogleSub,
			&user.Email,
			&user.Name,
			&user.PictureURL,
			&user.EmailVerified,
		)
		if err != nil {
			log.Printf("auth profile update error: %v", err)
			writeJSONError(w, http.StatusInternalServerError, "failed to save profile")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"user": user})
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
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') {
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
	writeJSON(w, status, map[string]string{"error": message})
}
