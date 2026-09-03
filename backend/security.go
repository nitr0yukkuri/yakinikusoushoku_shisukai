package main

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	maxJSONBodyBytes       = 8 << 20
	maxMeetupInvitees      = 100
	maxMeetupPlaceNameSize = 200
	maxProfileBioSize      = 100
)

type rateLimitEntry struct {
	started time.Time
	count   int
}

type requestRateLimiter struct {
	mu      sync.Mutex
	entries map[string]rateLimitEntry
}

func newRequestRateLimiter() *requestRateLimiter {
	return &requestRateLimiter{entries: make(map[string]rateLimitEntry)}
}

func (l *requestRateLimiter) allow(key string, limit int, window time.Duration) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.entries) > 10000 {
		for entryKey, entry := range l.entries {
			if now.Sub(entry.started) >= window {
				delete(l.entries, entryKey)
			}
		}
	}

	entry, ok := l.entries[key]
	if !ok || now.Sub(entry.started) >= window {
		l.entries[key] = rateLimitEntry{started: now, count: 1}
		return true
	}
	if entry.count >= limit {
		return false
	}
	entry.count++
	l.entries[key] = entry
	return true
}

var apiRateLimiter = newRequestRateLimiter()

func rejectRateLimited(w http.ResponseWriter, key string, limit int, window time.Duration) bool {
	if apiRateLimiter.allow(key, limit, window) {
		return false
	}
	w.Header().Set("Retry-After", strconv.FormatInt(int64(window/time.Second), 10))
	writeJSONError(w, http.StatusTooManyRequests, "too many requests")
	return true
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	if value := strings.TrimSpace(r.RemoteAddr); value != "" {
		return value
	}
	return "unknown"
}

func clientRateLimitKey(r *http.Request, scope string) string {
	return "ip:" + clientIP(r) + ":" + scope
}

func userRateLimitKey(userNo int64, scope string) string {
	return "user:" + strconv.FormatInt(userNo, 10) + ":" + scope
}
