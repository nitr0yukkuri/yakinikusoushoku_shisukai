package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestGoogleOAuthValueRoundTripAndTamperDetection(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	original := googleOAuthState{
		RedirectURL:   "exp://10.0.0.2:8081/--/oauth",
		CallbackURL:   "https://example.com/auth/google/callback",
		ExpiresAt:     time.Now().Add(time.Minute).Unix(),
		Nonce:         "nonce",
		CodeChallenge: strings.Repeat("a", 43),
	}
	value, err := signGoogleOAuthValue(original)
	if err != nil {
		t.Fatalf("signGoogleOAuthValue() error = %v", err)
	}

	var decoded googleOAuthState
	if err := decodeGoogleOAuthValue(value, &decoded); err != nil {
		t.Fatalf("decodeGoogleOAuthValue() error = %v", err)
	}
	if decoded != original {
		t.Fatalf("decoded state = %#v, want %#v", decoded, original)
	}

	tampered := "x" + value[1:]
	if tampered == value {
		tampered = "y" + value[1:]
	}
	if err := decodeGoogleOAuthValue(tampered, &decoded); err == nil {
		t.Fatal("decodeGoogleOAuthValue() accepted a tampered value")
	}
}

func TestGoogleOAuthStateRequiresNonce(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	value, err := signGoogleOAuthValue(googleOAuthState{
		RedirectURL:   "exp://10.0.0.2:8081/--/oauth",
		CallbackURL:   "https://example.com/auth/google/callback",
		ExpiresAt:     time.Now().Add(time.Minute).Unix(),
		Nonce:         "nonce",
		CodeChallenge: strings.Repeat("a", 43),
	})
	if err != nil {
		t.Fatalf("signGoogleOAuthValue() error = %v", err)
	}
	var state googleOAuthState
	if err := decodeGoogleOAuthValue(value, &state); err != nil {
		t.Fatalf("decodeGoogleOAuthValue() error = %v", err)
	}
	if state.Nonce == "" {
		t.Fatal("OAuth state nonce is empty")
	}
}

func TestIsAllowedGoogleOAuthReturnURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want bool
	}{
		{name: "expo private ip", url: "exp://192.168.1.20:8081/--/oauth", want: true},
		{name: "expo localhost", url: "exp://localhost:8081/--/oauth", want: true},
		{name: "expo tunnel", url: "exp://u.expo.dev/--/oauth", want: true},
		{name: "custom app scheme", url: "matsunya://oauth", want: true},
		{name: "expo wrong path", url: "exp://192.168.1.20:8081/--/other", want: false},
		{name: "expo query string", url: "exp://192.168.1.20:8081/--/oauth?code=unexpected", want: false},
		{name: "public expo host", url: "exp://example.com:8081/--/oauth", want: false},
		{name: "https redirect", url: "https://example.com/oauth", want: false},
		{name: "javascript redirect", url: "javascript:alert(1)", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isAllowedGoogleOAuthReturnURL(tt.url); got != tt.want {
				t.Fatalf("isAllowedGoogleOAuthReturnURL(%q) = %v, want %v", tt.url, got, tt.want)
			}
		})
	}
}

func TestProductionRejectsExpoGoReturnURL(t *testing.T) {
	t.Setenv("ENV", "production")
	if isAllowedGoogleOAuthReturnURL("exp://192.168.1.20:8081/--/oauth") {
		t.Fatal("production accepted an Expo Go return URL")
	}
	if !isAllowedGoogleOAuthReturnURL("matsunya://oauth") {
		t.Fatal("production rejected the native app return URL")
	}
}

func TestGoogleOAuthStartRedirectsToGoogle(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("GOOGLE_CLIENT_ID", "web-client-id.apps.googleusercontent.com")
	t.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("GOOGLE_OAUTH_REDIRECT_URI", "https://matsunya-backend.onrender.com/auth/google/callback")

	challenge := strings.Repeat("a", 43)
	req := httptest.NewRequest(http.MethodGet, "/auth/google/start?redirect_uri="+url.QueryEscape("exp://192.168.1.20:8081/--/oauth")+"&code_challenge="+challenge+"&code_challenge_method=S256", nil)
	res := httptest.NewRecorder()
	handleGoogleOAuthStart()(res, req)

	if res.Code != http.StatusFound {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusFound)
	}
	location, err := url.Parse(res.Header().Get("Location"))
	if err != nil {
		t.Fatalf("parse Location: %v", err)
	}
	if location.Host != "accounts.google.com" || location.Path != "/o/oauth2/v2/auth" {
		t.Fatalf("Location = %q, want Google OAuth endpoint", location.String())
	}
	query := location.Query()
	for _, key := range []string{"client_id", "redirect_uri", "response_type", "scope", "state", "nonce"} {
		if strings.TrimSpace(query.Get(key)) == "" {
			t.Fatalf("Google OAuth parameter %q is empty", key)
		}
	}
	if query.Get("redirect_uri") != "https://matsunya-backend.onrender.com/auth/google/callback" {
		t.Fatalf("redirect_uri = %q", query.Get("redirect_uri"))
	}
	if query.Get("code_challenge") != "" {
		t.Fatal("provider request unexpectedly included the app handoff challenge")
	}
}

func TestHashGoogleOAuthCodeIsDeterministicAndOpaque(t *testing.T) {
	first := hashGoogleOAuthCode("test-oauth-code")
	second := hashGoogleOAuthCode("test-oauth-code")
	if first != second {
		t.Fatalf("hashGoogleOAuthCode() is not deterministic")
	}
	if first == "test-oauth-code" || first == "" {
		t.Fatalf("hashGoogleOAuthCode() = %q, want a non-empty hash", first)
	}
}

func TestPKCEValueValidationAndHash(t *testing.T) {
	verifier := strings.Repeat("a", 64)
	if !isValidPKCEValue(verifier) {
		t.Fatal("valid PKCE value was rejected")
	}
	if isValidPKCEValue("too-short") {
		t.Fatal("short PKCE value was accepted")
	}
	if isValidPKCEValue(strings.Repeat("a", 129)) {
		t.Fatal("long PKCE value was accepted")
	}
	if hashPKCEValue(verifier) == hashPKCEValue(strings.Repeat("b", 64)) {
		t.Fatal("different PKCE values produced the same hash")
	}
}
