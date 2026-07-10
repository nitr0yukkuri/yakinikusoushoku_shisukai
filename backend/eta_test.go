package main

import (
	"encoding/json"
	"fmt"
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
		if r.Header.Get("X-Goog-FieldMask") != "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.polyline.encodedPolyline" {
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

func TestRequestGoogleRouteBuildsPolylineFromSteps(t *testing.T) {
	stepOne := encodeRoutePolyline([]routeLatLng{
		{Latitude: 38.5, Longitude: -120.2},
		{Latitude: 40.7, Longitude: -120.95},
	})
	stepTwo := encodeRoutePolyline([]routeLatLng{
		{Latitude: 40.7, Longitude: -120.95},
		{Latitude: 43.252, Longitude: -126.453},
	})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{
			"routes": [{
				"duration": "900s",
				"distanceMeters": 5200,
				"polyline": {},
				"legs": [{
					"steps": [{
						"polyline": {"encodedPolyline": %q}
					}, {
						"polyline": {"encodedPolyline": %q}
					}]
				}]
			}]
		}`, stepOne, stepTwo)
	}))
	defer server.Close()

	previousURL := googleRoutesURL
	googleRoutesURL = server.URL
	t.Cleanup(func() { googleRoutesURL = previousURL })
	t.Setenv("GOOGLE_MAPS_API_KEY", "test-key")

	_, _, routePolyline, err := requestGoogleRoute(t.Context(), 35.0, 139.0, 35.1, 139.1, "TRANSIT")
	if err != nil {
		t.Fatal(err)
	}
	points, err := decodeEncodedPolyline(routePolyline)
	if err != nil {
		t.Fatal(err)
	}
	if len(points) != 3 {
		t.Fatalf("points = %d, want 3", len(points))
	}
}

func TestSelectTravelModeByDistance(t *testing.T) {
	if mode := selectTravelModeByDistance(35.681236, 139.767125, 35.689634, 139.692101); mode != "WALK" {
		t.Fatalf("mode = %s, want WALK", mode)
	}
	if mode := selectTravelModeByDistance(35.681236, 139.767125, 35.443708, 139.638026); mode != "TRANSIT" {
		t.Fatalf("mode = %s, want TRANSIT", mode)
	}
}

func TestBufferMinutesForTravelMode(t *testing.T) {
	if got := bufferMinutesForTravelMode("WALK", 5); got != 5 {
		t.Fatalf("walk buffer = %d, want 5", got)
	}
	if got := bufferMinutesForTravelMode("TRANSIT", 5); got != 15 {
		t.Fatalf("transit buffer = %d, want 15", got)
	}
}

func TestRequestRouteDisplayPolylineFallsBackForTransit(t *testing.T) {
	var requestedModes []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body routesAPIRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		requestedModes = append(requestedModes, body.TravelMode)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"routes":[{"duration":"600s","distanceMeters":5000,"polyline":{"encodedPolyline":"display123"}}]}`))
	}))
	defer server.Close()

	previousURL := googleRoutesURL
	googleRoutesURL = server.URL
	t.Cleanup(func() { googleRoutesURL = previousURL })
	t.Setenv("GOOGLE_MAPS_API_KEY", "test-key")

	routePolyline := requestRouteDisplayPolyline(t.Context(), 35.0, 139.0, 35.1, 139.1, "TRANSIT")
	if routePolyline != "display123" {
		t.Fatalf("routePolyline = %q, want display123", routePolyline)
	}
	if len(requestedModes) != 1 || requestedModes[0] != "DRIVE" {
		t.Fatalf("requested modes = %+v, want [DRIVE]", requestedModes)
	}
}

func TestEstimateFallbackRoute(t *testing.T) {
	duration, distance := estimateFallbackRoute(35.681236, 139.767125, 35.689634, 139.692101, "DRIVE")
	if distance < 6000 || distance > 7000 {
		t.Fatalf("distance = %d, want roughly 6000-7000", distance)
	}
	if duration <= 0 {
		t.Fatalf("duration = %d, want positive", duration)
	}
}
