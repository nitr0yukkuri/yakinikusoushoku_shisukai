package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequestGoogleRoute(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s, want POST", r.Method)
		}
		if r.Header.Get("X-Goog-Api-Key") != "test-key" {
			t.Fatal("API key header was not set")
		}
		if r.Header.Get("X-Goog-FieldMask") != "routes.duration,routes.distanceMeters" {
			t.Fatal("field mask header was not set")
		}
		var body routesAPIRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.TravelMode != "DRIVE" || body.RoutingPreference != "TRAFFIC_AWARE" {
			t.Fatalf("unexpected route options: %+v", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"routes":[{"duration":"615s","distanceMeters":4200}]}`))
	}))
	defer server.Close()

	previousURL := googleRoutesURL
	googleRoutesURL = server.URL
	t.Cleanup(func() { googleRoutesURL = previousURL })
	t.Setenv("GOOGLE_MAPS_API_KEY", "test-key")

	duration, distance, err := requestGoogleRoute(t.Context(), 35.0, 139.0, 35.1, 139.1, "DRIVE")
	if err != nil {
		t.Fatal(err)
	}
	if duration != 615 || distance != 4200 {
		t.Fatalf("route = (%d, %d), want (615, 4200)", duration, distance)
	}
}
