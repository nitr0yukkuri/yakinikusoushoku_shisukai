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
		if r.Header.Get("X-Goog-FieldMask") != "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline" {
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
		_, _ = w.Write([]byte(`{"routes":[{"duration":"615s","distanceMeters":4200,"polyline":{"encodedPolyline":"abc123"}}]}`))
	}))
	defer server.Close()

	previousURL := googleRoutesURL
	googleRoutesURL = server.URL
	t.Cleanup(func() { googleRoutesURL = previousURL })
	t.Setenv("GOOGLE_MAPS_API_KEY", "test-key")

	duration, distance, routePolyline, err := requestGoogleRoute(t.Context(), 35.0, 139.0, 35.1, 139.1, "DRIVE")
	if err != nil {
		t.Fatal(err)
	}
	if duration != 615 || distance != 4200 || routePolyline != "abc123" {
		t.Fatalf("route = (%d, %d, %q), want (615, 4200, %q)", duration, distance, routePolyline, "abc123")
	}
}

func TestRequestGoogleRouteTransit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body routesAPIRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.TravelMode != "TRANSIT" {
			t.Fatalf("travel mode = %s, want TRANSIT", body.TravelMode)
		}
		if body.RoutingPreference != "" {
			t.Fatalf("routing preference = %s, want empty for transit", body.RoutingPreference)
		}
		if body.DepartureTime == "" {
			t.Fatal("departure time was not set for transit")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"routes":[{"duration":"900s","distanceMeters":5200,"polyline":{"encodedPolyline":"transit123"}}]}`))
	}))
	defer server.Close()

	previousURL := googleRoutesURL
	googleRoutesURL = server.URL
	t.Cleanup(func() { googleRoutesURL = previousURL })
	t.Setenv("GOOGLE_MAPS_API_KEY", "test-key")

	duration, distance, routePolyline, err := requestGoogleRoute(t.Context(), 35.0, 139.0, 35.1, 139.1, "TRANSIT")
	if err != nil {
		t.Fatal(err)
	}
	if duration != 900 || distance != 5200 || routePolyline != "transit123" {
		t.Fatalf("route = (%d, %d, %q), want (900, 5200, %q)", duration, distance, routePolyline, "transit123")
	}
}
