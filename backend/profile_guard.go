package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func withProfileSetupRequired(pool *pgxpool.Pool, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userNo, ok := authenticatedUserNo(w, r)
		if !ok {
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		var userID string
		err := pool.QueryRow(ctx, `
			SELECT COALESCE(NULLIF(BTRIM(user_id), ''), '')
			FROM auth_users
			WHERE id = $1
		`, userNo).Scan(&userID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, http.StatusUnauthorized, "user not found")
			return
		}
		if err != nil {
			log.Printf("profile setup check error: %v", err)
			writeJSONError(w, http.StatusInternalServerError, "failed to read profile")
			return
		}
		if strings.TrimSpace(userID) == "" {
			writeJSONError(w, http.StatusConflict, "profile setup is required")
			return
		}

		next(w, r)
	}
}
