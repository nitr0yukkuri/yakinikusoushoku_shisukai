package main

import (
	"strings"
	"testing"
	"time"
)

func TestValidateMeetupInput(t *testing.T) {
	scheduledAt := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	if _, err := validateMeetupInput(scheduledAt, "Tokyo Station", 35.6812, 139.7671); err != nil {
		t.Fatalf("valid meetup input was rejected: %v", err)
	}
	for _, test := range []struct {
		name      string
		when      string
		place     string
		latitude  float64
		longitude float64
	}{
		{name: "invalid time", when: "19:00", place: "Tokyo", latitude: 35, longitude: 139},
		{name: "missing place", when: scheduledAt, place: " ", latitude: 35, longitude: 139},
		{name: "invalid latitude", when: scheduledAt, place: "Tokyo", latitude: 91, longitude: 139},
		{name: "invalid longitude", when: scheduledAt, place: "Tokyo", latitude: 35, longitude: 181},
	} {
		t.Run(test.name, func(t *testing.T) {
			if _, err := validateMeetupInput(test.when, test.place, test.latitude, test.longitude); err == nil {
				t.Fatal("invalid meetup input was accepted")
			}
		})
	}
}

func TestNewInviteCode(t *testing.T) {
	first, err := newInviteCode()
	if err != nil {
		t.Fatal(err)
	}
	second, err := newInviteCode()
	if err != nil {
		t.Fatal(err)
	}
	if len(first) < 10 || strings.Contains(first, "=") {
		t.Fatalf("unexpected invite code format: %q", first)
	}
	if first == second {
		t.Fatal("two generated invite codes unexpectedly matched")
	}
}
