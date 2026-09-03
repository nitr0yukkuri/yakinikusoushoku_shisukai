package main

import (
	"context"
	"crypto/hmac"
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	googleOAuthTokenURL = "https://oauth2.googleapis.com/token"
	googleOAuthStateTTL = 10 * time.Minute
	googleOAuthCodeTTL  = 2 * time.Minute
)

type googleOAuthState struct {
	RedirectURL   string `json:"redirectUrl"`
	CallbackURL   string `json:"callbackUrl"`
	ExpiresAt     int64  `json:"expiresAt"`
	Nonce         string `json:"nonce"`
	CodeChallenge string `json:"codeChallenge"`
}

type googleOAuthExchangeRequest struct {
	Code         string `json:"code"`
	CodeVerifier string `json:"codeVerifier"`
}

type googleOAuthTokenResponse struct {
	IDToken          string `json:"id_token"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

func handleGoogleOAuthStart() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		if rejectRateLimited(w, clientRateLimitKey(r, "oauth-start"), 20, time.Minute) {
			return
		}

		clientID := googleWebClientID()
		if clientID == "" {
			writeJSONError(w, http.StatusInternalServerError, "Google web client ID is not configured")
			return
		}
		if strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET")) == "" {
			writeJSONError(w, http.StatusInternalServerError, "GOOGLE_CLIENT_SECRET is not configured")
			return
		}

		redirectURL := strings.TrimSpace(r.URL.Query().Get("redirect_uri"))
		if !isAllowedGoogleOAuthReturnURL(redirectURL) {
			writeJSONError(w, http.StatusBadRequest, "invalid OAuth redirect URI")
			return
		}
		if strings.TrimSpace(r.URL.Query().Get("code_challenge_method")) != "S256" {
			writeJSONError(w, http.StatusBadRequest, "S256 PKCE is required")
			return
		}
		codeChallenge := strings.TrimSpace(r.URL.Query().Get("code_challenge"))
		if !isValidPKCEValue(codeChallenge) {
			writeJSONError(w, http.StatusBadRequest, "valid PKCE code challenge is required")
			return
		}

		callbackURL := googleOAuthCallbackURL(r)
		nonce, err := newGoogleOAuthNonce()
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to create OAuth state")
			return
		}

		state, err := signGoogleOAuthValue(googleOAuthState{
			RedirectURL:   redirectURL,
			CallbackURL:   callbackURL,
			ExpiresAt:     time.Now().Add(googleOAuthStateTTL).Unix(),
			Nonce:         nonce,
			CodeChallenge: codeChallenge,
		})
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to create OAuth state")
			return
		}

		params := url.Values{}
		params.Set("client_id", clientID)
		params.Set("redirect_uri", callbackURL)
		params.Set("response_type", "code")
		params.Set("scope", "openid email profile")
		params.Set("state", state)
		params.Set("nonce", nonce)
		params.Set("prompt", "select_account")

		http.Redirect(w, r, "https://accounts.google.com/o/oauth2/v2/auth?"+params.Encode(), http.StatusFound)
	}
}

func googleOAuthCallbackURL(r *http.Request) string {
	if configured := strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_REDIRECT_URI")); configured != "" {
		return strings.TrimRight(configured, "/")
	}

	protocol := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Proto"), ",")[0])
	if protocol == "" {
		protocol = "http"
		if r.TLS != nil {
			protocol = "https"
		}
	}
	return fmt.Sprintf("%s://%s/auth/google/callback", protocol, r.Host)
}

func googleWebClientID() string {
	for _, key := range []string{"GOOGLE_CLIENT_ID", "EXPO_PUBLIC_GOOGLE_CLIENT_ID"} {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func isAllowedGoogleOAuthReturnURL(raw string) bool {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.User != nil || parsed.Host == "" && parsed.Scheme != "matsunya" {
		return false
	}

	switch strings.ToLower(parsed.Scheme) {
	case "exp":
		if strings.EqualFold(getEnv("ENV", "development"), "production") {
			return false
		}
		return isAllowedExpoGoHost(parsed.Hostname()) && parsed.Path == "/--/oauth" && parsed.RawQuery == ""
	case "matsunya":
		return (parsed.Host == "oauth" && parsed.Path == "") ||
			(parsed.Host == "" && parsed.Path == "/oauth")
	default:
		return false
	}
}

func isAllowedExpoGoHost(host string) bool {
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

func handleGoogleOAuthCallback(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		if rejectRateLimited(w, clientRateLimitKey(r, "oauth-callback"), 30, time.Minute) {
			return
		}

		var state googleOAuthState
		stateValue := strings.TrimSpace(r.URL.Query().Get("state"))
		if err := decodeGoogleOAuthValue(stateValue, &state); err != nil ||
			state.ExpiresAt <= time.Now().Unix() || !isAllowedGoogleOAuthReturnURL(state.RedirectURL) ||
			!isValidPKCEValue(state.CodeChallenge) {
			http.Error(w, "invalid or expired OAuth state", http.StatusBadRequest)
			return
		}

		if providerError := strings.TrimSpace(r.URL.Query().Get("error")); providerError != "" {
			redirectGoogleOAuthResult(w, r, state.RedirectURL, url.Values{
				"error": []string{"google_auth_cancelled"},
			})
			return
		}

		code := strings.TrimSpace(r.URL.Query().Get("code"))
		if code == "" {
			redirectGoogleOAuthResult(w, r, state.RedirectURL, url.Values{
				"error": []string{"google_authorization_code_missing"},
			})
			return
		}

		clientID := googleWebClientID()
		clientSecret := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET"))
		if clientID == "" || clientSecret == "" {
			redirectGoogleOAuthResult(w, r, state.RedirectURL, url.Values{
				"error": []string{"google_oauth_server_not_configured"},
			})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		tokenResponse, err := exchangeGoogleAuthorizationCode(ctx, code, clientID, clientSecret, state.CallbackURL)
		if err != nil {
			log.Printf("google OAuth code exchange error: %v", err)
			redirectGoogleOAuthResult(w, r, state.RedirectURL, url.Values{
				"error": []string{"google_code_exchange_failed"},
			})
			return
		}

		payload, err := validateGoogleIDToken(ctx, tokenResponse.IDToken, []string{clientID})
		if err != nil {
			log.Printf("google OAuth ID token validation error: %v", err)
			redirectGoogleOAuthResult(w, r, state.RedirectURL, url.Values{
				"error": []string{"google_id_token_invalid"},
			})
			return
		}
		if claimString(payload.Claims, "nonce") != state.Nonce {
			log.Printf("google OAuth nonce mismatch")
			redirectGoogleOAuthResult(w, r, state.RedirectURL, url.Values{
				"error": []string{"google_nonce_invalid"},
			})
			return
		}

		user, err := upsertAuthUser(ctx, pool, payload)
		if err != nil {
			log.Printf("google OAuth user upsert error: %v", err)
			redirectGoogleOAuthResult(w, r, state.RedirectURL, url.Values{
				"error": []string{"google_user_save_failed"},
			})
			return
		}

		exchangeCode, err := issueGoogleOAuthCode(ctx, pool, user.ID, state.CodeChallenge)
		if err != nil {
			log.Printf("google OAuth exchange code creation error: %v", err)
			redirectGoogleOAuthResult(w, r, state.RedirectURL, url.Values{
				"error": []string{"oauth_code_creation_failed"},
			})
			return
		}

		redirectGoogleOAuthResult(w, r, state.RedirectURL, url.Values{
			"code": []string{exchangeCode},
		})
	}
}

func exchangeGoogleAuthorizationCode(ctx context.Context, code, clientID, clientSecret, callbackURL string) (googleOAuthTokenResponse, error) {
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("redirect_uri", callbackURL)
	form.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleOAuthTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return googleOAuthTokenResponse{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return googleOAuthTokenResponse{}, err
	}
	defer resp.Body.Close()

	var tokenResponse googleOAuthTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
		return googleOAuthTokenResponse{}, err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		if tokenResponse.ErrorDescription != "" {
			return googleOAuthTokenResponse{}, fmt.Errorf("%s: %s", tokenResponse.Error, tokenResponse.ErrorDescription)
		}
		return googleOAuthTokenResponse{}, fmt.Errorf("Google token endpoint returned %s", resp.Status)
	}
	if strings.TrimSpace(tokenResponse.IDToken) == "" {
		return googleOAuthTokenResponse{}, fmt.Errorf("Google token endpoint did not return an ID token")
	}
	return tokenResponse, nil
}

func redirectGoogleOAuthResult(w http.ResponseWriter, r *http.Request, redirectURL string, values url.Values) {
	target, err := url.Parse(redirectURL)
	if err != nil {
		http.Error(w, "invalid OAuth redirect URI", http.StatusBadRequest)
		return
	}
	query := target.Query()
	for key, list := range values {
		if len(list) == 0 {
			continue
		}
		query.Set(key, list[0])
	}
	target.RawQuery = query.Encode()
	http.Redirect(w, r, target.String(), http.StatusFound)
}

func handleGoogleOAuthExchange(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		if rejectRateLimited(w, clientRateLimitKey(r, "oauth-exchange"), 30, time.Minute) {
			return
		}

		var req googleOAuthExchangeRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024)).Decode(&req); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid json body")
			return
		}
		code := strings.TrimSpace(req.Code)
		if code == "" {
			writeJSONError(w, http.StatusBadRequest, "code is required")
			return
		}
		codeVerifier := strings.TrimSpace(req.CodeVerifier)
		if !isValidPKCEValue(codeVerifier) {
			writeJSONError(w, http.StatusBadRequest, "valid PKCE code verifier is required")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		userNo, err := consumeGoogleOAuthCode(ctx, pool, code, codeVerifier)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, http.StatusUnauthorized, "invalid or expired OAuth code")
			return
		}
		if err != nil {
			log.Printf("google OAuth exchange code consume error: %v", err)
			writeJSONError(w, http.StatusInternalServerError, "failed to exchange OAuth code")
			return
		}

		user, err := selectAuthUser(ctx, pool, userNo)
		if err != nil {
			log.Printf("google OAuth exchange user read error: %v", err)
			writeJSONError(w, http.StatusInternalServerError, "failed to read user")
			return
		}
		jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
		if jwtSecret == "" {
			writeJSONError(w, http.StatusInternalServerError, "JWT_SECRET is not configured")
			return
		}
		token, err := signAppToken(user, jwtSecret)
		if err != nil {
			log.Printf("google OAuth exchange token signing error: %v", err)
			writeJSONError(w, http.StatusInternalServerError, "failed to sign token")
			return
		}

		writeJSON(w, http.StatusOK, googleAuthResponse{Token: token, User: user})
	}
}

func ensureGoogleOAuthSchema(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS google_oauth_codes (
			code_hash TEXT PRIMARY KEY,
			auth_user_id BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
			code_challenge TEXT,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);
		ALTER TABLE google_oauth_codes ADD COLUMN IF NOT EXISTS code_challenge TEXT;
		CREATE INDEX IF NOT EXISTS idx_google_oauth_codes_expires_at
			ON google_oauth_codes (expires_at);
	`)
	return err
}

func issueGoogleOAuthCode(ctx context.Context, pool *pgxpool.Pool, userNo int64, codeChallenge string) (string, error) {
	code, err := newGoogleOAuthNonce()
	if err != nil {
		return "", err
	}
	codeHash := hashGoogleOAuthCode(code)
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM google_oauth_codes WHERE expires_at <= now()`); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO google_oauth_codes (code_hash, auth_user_id, code_challenge, expires_at)
		VALUES ($1, $2, $3, $4)
	`, codeHash, userNo, codeChallenge, time.Now().Add(googleOAuthCodeTTL)); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return code, nil
}

func consumeGoogleOAuthCode(ctx context.Context, pool *pgxpool.Pool, code, codeVerifier string) (int64, error) {
	var userNo int64
	err := pool.QueryRow(ctx, `
		DELETE FROM google_oauth_codes
		WHERE code_hash = $1 AND code_challenge = $2 AND expires_at > now()
		RETURNING auth_user_id
	`, hashGoogleOAuthCode(code), hashPKCEValue(codeVerifier)).Scan(&userNo)
	return userNo, err
}

func hashGoogleOAuthCode(code string) string {
	digest := sha256.Sum256([]byte(code))
	return base64.RawURLEncoding.EncodeToString(digest[:])
}

func hashPKCEValue(value string) string {
	digest := sha256.Sum256([]byte(value))
	return base64.RawURLEncoding.EncodeToString(digest[:])
}

func isValidPKCEValue(value string) bool {
	if len(value) < 43 || len(value) > 128 {
		return false
	}
	for _, r := range value {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') &&
			(r < '0' || r > '9') && r != '-' && r != '.' && r != '_' && r != '~' {
			return false
		}
	}
	return true
}

func newGoogleOAuthNonce() (string, error) {
	value := make([]byte, 32)
	if _, err := crand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func signGoogleOAuthValue(value any) (string, error) {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET is not configured")
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(encodedPayload))
	encodedSignature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return encodedPayload + "." + encodedSignature, nil
}

func decodeGoogleOAuthValue(value string, target any) error {
	parts := strings.Split(value, ".")
	if len(parts) != 2 {
		return fmt.Errorf("invalid OAuth value")
	}
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		return fmt.Errorf("JWT_SECRET is not configured")
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(parts[0]))
	actual, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(actual, mac.Sum(nil)) {
		return fmt.Errorf("invalid OAuth signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return fmt.Errorf("invalid OAuth payload")
	}
	return json.Unmarshal(payload, target)
}
