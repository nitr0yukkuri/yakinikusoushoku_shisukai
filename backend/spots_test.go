package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCallGooglePlacesNearby(t *testing.T) {
	t.Setenv("GOOGLE_MAPS_API_KEY", "test-key")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/places:searchNearby" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("X-Goog-Api-Key"); got != "test-key" {
			t.Fatalf("unexpected API key header: %q", got)
		}
		if got := r.Header.Get("X-Goog-FieldMask"); got != placesListFieldMask {
			t.Fatalf("unexpected field mask: %q", got)
		}
		var request nearbySearchRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if request.LocationRestriction.Circle.Center.Latitude != 35.6812 ||
			request.LocationRestriction.Circle.Center.Longitude != 139.7671 ||
			request.LocationRestriction.Circle.Radius != 1200 {
			t.Fatalf("unexpected location restriction: %+v", request.LocationRestriction.Circle)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"places":[{"id":"spot-1","displayName":{"text":"東京駅"},"formattedAddress":"東京都千代田区","location":{"latitude":35.6812,"longitude":139.7671},"primaryType":"train_station","googleMapsUri":"https://maps.example/spot-1","rating":4.4}]}`))
	}))
	defer server.Close()

	previousBaseURL := googlePlacesBaseURL
	googlePlacesBaseURL = server.URL
	defer func() { googlePlacesBaseURL = previousBaseURL }()

	var request nearbySearchRequest
	request.IncludedTypes = []string{"cafe"}
	request.MaxResultCount = 10
	request.LocationRestriction.Circle.Center.Latitude = 35.6812
	request.LocationRestriction.Circle.Center.Longitude = 139.7671
	request.LocationRestriction.Circle.Radius = 1200
	var response googlePlacesResponse
	if err := callGooglePlaces(context.Background(), http.MethodPost, "/places:searchNearby", placesListFieldMask, request, &response); err != nil {
		t.Fatal(err)
	}
	spots := convertGooglePlaces(response.Places)
	if len(spots) != 1 || spots[0].PlaceID != "spot-1" || spots[0].Name != "東京駅" {
		t.Fatalf("unexpected spots response: %+v", spots)
	}
}

func TestFetchGooglePlace(t *testing.T) {
	t.Setenv("GOOGLE_MAPS_API_KEY", "test-key")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/places/spot-2" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("X-Goog-FieldMask") != placeDetailFieldMask {
			t.Fatal("detail field mask was not sent")
		}
		_, _ = w.Write([]byte(`{"id":"spot-2","displayName":{"text":"大阪駅"},"formattedAddress":"大阪府大阪市","location":{"latitude":34.7024,"longitude":135.4959}}`))
	}))
	defer server.Close()

	previousBaseURL := googlePlacesBaseURL
	googlePlacesBaseURL = server.URL
	defer func() { googlePlacesBaseURL = previousBaseURL }()

	item, err := fetchGooglePlace(context.Background(), "spot-2")
	if err != nil {
		t.Fatal(err)
	}
	if item.PlaceID != "spot-2" || item.Name != "大阪駅" || item.Latitude != 34.7024 || item.Longitude != 135.4959 {
		t.Fatalf("unexpected spot: %+v", item)
	}
}

func TestParseSpotTypes(t *testing.T) {
	types, err := parseSpotTypes("cafe, restaurant,cafe")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(types, ",") != "cafe,restaurant" {
		t.Fatalf("unexpected normalized types: %v", types)
	}
	if _, err := parseSpotTypes("not_a_place_type"); err == nil {
		t.Fatal("unsupported spot type was accepted")
	}
}

func TestResolveMeetupSpot(t *testing.T) {
	t.Setenv("GOOGLE_MAPS_API_KEY", "test-key")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id":"spot-3","displayName":{"text":"中之島公園"},"location":{"latitude":34.6931,"longitude":135.5076}}`))
	}))
	defer server.Close()

	previousBaseURL := googlePlacesBaseURL
	googlePlacesBaseURL = server.URL
	defer func() { googlePlacesBaseURL = previousBaseURL }()

	name := "古い場所"
	latitude, longitude := 0.0, 0.0
	if err := resolveMeetupSpot(context.Background(), "spot-3", &name, &latitude, &longitude); err != nil {
		t.Fatal(err)
	}
	if name != "中之島公園" || latitude != 34.6931 || longitude != 135.5076 {
		t.Fatalf("spot was not resolved: %q %f %f", name, latitude, longitude)
	}
}
