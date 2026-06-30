package main

import (
	"testing"
	"time"
)

func TestWSTicketIsSingleUse(t *testing.T) {
	store := newWSTicketStore()
	value, err := store.issue(wsTicket{UserNo: 1, UserID: "user1", MeetupID: 9, ExpiresAt: time.Now().Add(time.Minute)})
	if err != nil {
		t.Fatal(err)
	}
	ticket, ok := store.consume(value)
	if !ok || ticket.UserID != "user1" || ticket.MeetupID != 9 {
		t.Fatalf("valid ticket was not consumed correctly: %+v, %v", ticket, ok)
	}
	if _, ok := store.consume(value); ok {
		t.Fatal("ticket could be consumed twice")
	}
}

func TestExpiredWSTicketIsRejected(t *testing.T) {
	store := newWSTicketStore()
	value, err := store.issue(wsTicket{ExpiresAt: time.Now().Add(-time.Second)})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := store.consume(value); ok {
		t.Fatal("expired ticket was accepted")
	}
}

func TestOriginAllowedForLocalDevelopmentOriginsInProduction(t *testing.T) {
	t.Setenv("ENV", "production")
	t.Setenv("ALLOWED_ORIGINS", "")

	for _, origin := range []string{
		"http://localhost:8081",
		"http://127.0.0.1:8081",
		"https://spicy-states-film.loca.lt",
	} {
		if !originAllowed(origin) {
			t.Fatalf("originAllowed(%q) = false, want true", origin)
		}
	}
}
