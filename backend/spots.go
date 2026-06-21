package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var googlePlacesBaseURL = "https://places.googleapis.com/v1"

const placesListFieldMask = "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.googleMapsUri,places.rating"
const placeDetailFieldMask = "id,displayName,formattedAddress,location,primaryType,googleMapsUri,rating"

var allowedSpotTypes = map[string]bool{
	"bakery": true, "bar": true, "cafe": true, "gym": true,
	"library": true, "movie_theater": true, "park": true,
	"restaurant": true, "shopping_mall": true, "tourist_attraction": true,
}

type spot struct {
	PlaceID          string  `json:"placeId"`
	Name             string  `json:"name"`
	FormattedAddress string  `json:"formattedAddress"`
	Latitude         float64 `json:"latitude"`
	Longitude        float64 `json:"longitude"`
	PrimaryType      string  `json:"primaryType"`
	GoogleMapsURI    string  `json:"googleMapsUri"`
	Rating           float64 `json:"rating,omitempty"`
}

type googlePlace struct {
	ID          string `json:"id"`
	DisplayName struct {
		Text string `json:"text"`
	} `json:"displayName"`
	FormattedAddress string `json:"formattedAddress"`
	Location         struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"location"`
	PrimaryType   string  `json:"primaryType"`
	GoogleMapsURI string  `json:"googleMapsUri"`
	Rating        float64 `json:"rating"`
}

type googlePlacesResponse struct {
	Places []googlePlace `json:"places"`
}

type nearbySearchRequest struct {
	IncludedTypes       []string `json:"includedTypes"`
	MaxResultCount      int      `json:"maxResultCount"`
	LanguageCode        string   `json:"languageCode"`
	RegionCode          string   `json:"regionCode"`
	LocationRestriction struct {
		Circle struct {
			Center struct {
				Latitude  float64 `json:"latitude"`
				Longitude float64 `json:"longitude"`
			} `json:"center"`
			Radius float64 `json:"radius"`
		} `json:"circle"`
	} `json:"locationRestriction"`
}

type textSearchRequest struct {
	TextQuery      string `json:"textQuery"`
	MaxResultCount int    `json:"maxResultCount"`
	LanguageCode   string `json:"languageCode"`
	RegionCode     string `json:"regionCode"`
	LocationBias   *struct {
		Circle struct {
			Center struct {
				Latitude  float64 `json:"latitude"`
				Longitude float64 `json:"longitude"`
			} `json:"center"`
			Radius float64 `json:"radius"`
		} `json:"circle"`
	} `json:"locationBias,omitempty"`
}

func handleSpots(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		if _, ok := authenticatedUserNo(w, r); !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		switch {
		case r.URL.Path == "/spots/nearby":
			searchNearbySpots(w, r, ctx)
		case r.URL.Path == "/spots/search":
			searchSpotsByText(w, r, ctx)
		case strings.HasPrefix(r.URL.Path, "/spots/"):
			placeID, err := url.PathUnescape(strings.TrimPrefix(r.URL.Path, "/spots/"))
			if err != nil || strings.TrimSpace(placeID) == "" || strings.Contains(placeID, "/") {
				writeJSONError(w, http.StatusBadRequest, "valid placeId is required")
				return
			}
			item, err := fetchGooglePlace(ctx, placeID)
			if err != nil {
				writeJSONError(w, http.StatusBadGateway, "failed to read spot")
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"spot": item})
		default:
			writeJSONError(w, http.StatusNotFound, "not found")
		}
	}
}

func searchNearbySpots(w http.ResponseWriter, r *http.Request, ctx context.Context) {
	latitude, longitude, err := parseSpotCoordinates(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	radius, err := parseBoundedFloat(r.URL.Query().Get("radius"), 1500, 50, 5000)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "radius must be between 50 and 5000 meters")
		return
	}
	maxResults, err := parseBoundedInt(r.URL.Query().Get("limit"), 10, 1, 20)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "limit must be between 1 and 20")
		return
	}
	types, err := parseSpotTypes(r.URL.Query().Get("types"))
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	var request nearbySearchRequest
	request.IncludedTypes = types
	request.MaxResultCount = maxResults
	request.LanguageCode = "ja"
	request.RegionCode = "JP"
	request.LocationRestriction.Circle.Center.Latitude = latitude
	request.LocationRestriction.Circle.Center.Longitude = longitude
	request.LocationRestriction.Circle.Radius = radius
	var response googlePlacesResponse
	if err := callGooglePlaces(ctx, http.MethodPost, "/places:searchNearby", placesListFieldMask, request, &response); err != nil {
		writeJSONError(w, http.StatusBadGateway, "failed to search nearby spots")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"spots": convertGooglePlaces(response.Places)})
}

func searchSpotsByText(w http.ResponseWriter, r *http.Request, ctx context.Context) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" || len([]rune(query)) > 100 {
		writeJSONError(w, http.StatusBadRequest, "q must be between 1 and 100 characters")
		return
	}
	maxResults, err := parseBoundedInt(r.URL.Query().Get("limit"), 10, 1, 20)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "limit must be between 1 and 20")
		return
	}
	var request textSearchRequest
	request.TextQuery = query
	request.MaxResultCount = maxResults
	request.LanguageCode = "ja"
	request.RegionCode = "JP"
	if r.URL.Query().Has("latitude") || r.URL.Query().Has("longitude") {
		latitude, longitude, err := parseSpotCoordinates(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		radius, err := parseBoundedFloat(r.URL.Query().Get("radius"), 5000, 50, 50000)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "radius must be between 50 and 50000 meters")
			return
		}
		request.LocationBias = &struct {
			Circle struct {
				Center struct {
					Latitude  float64 `json:"latitude"`
					Longitude float64 `json:"longitude"`
				} `json:"center"`
				Radius float64 `json:"radius"`
			} `json:"circle"`
		}{}
		request.LocationBias.Circle.Center.Latitude = latitude
		request.LocationBias.Circle.Center.Longitude = longitude
		request.LocationBias.Circle.Radius = radius
	}
	var response googlePlacesResponse
	if err := callGooglePlaces(ctx, http.MethodPost, "/places:searchText", placesListFieldMask, request, &response); err != nil {
		writeJSONError(w, http.StatusBadGateway, "failed to search spots")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"spots": convertGooglePlaces(response.Places)})
}

func fetchGooglePlace(ctx context.Context, placeID string) (spot, error) {
	var response googlePlace
	path := "/places/" + url.PathEscape(strings.TrimSpace(placeID))
	if err := callGooglePlaces(ctx, http.MethodGet, path, placeDetailFieldMask, nil, &response); err != nil {
		return spot{}, err
	}
	return convertGooglePlace(response), nil
}

func callGooglePlaces(ctx context.Context, method, path, fieldMask string, requestBody, responseBody any) error {
	apiKey := strings.TrimSpace(os.Getenv("GOOGLE_MAPS_API_KEY"))
	if apiKey == "" {
		return fmt.Errorf("GOOGLE_MAPS_API_KEY is not configured")
	}
	var body io.Reader
	if requestBody != nil {
		encoded, err := json.Marshal(requestBody)
		if err != nil {
			return err
		}
		body = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(googlePlacesBaseURL, "/")+path, body)
	if err != nil {
		return err
	}
	if requestBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("X-Goog-Api-Key", apiKey)
	req.Header.Set("X-Goog-FieldMask", fieldMask)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		limited, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("places API returned %d: %s", resp.StatusCode, strings.TrimSpace(string(limited)))
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(responseBody)
}

func parseSpotCoordinates(r *http.Request) (float64, float64, error) {
	latitude, err := strconv.ParseFloat(strings.TrimSpace(r.URL.Query().Get("latitude")), 64)
	if err != nil || math.IsNaN(latitude) || math.IsInf(latitude, 0) || latitude < -90 || latitude > 90 {
		return 0, 0, fmt.Errorf("valid latitude is required")
	}
	longitude, err := strconv.ParseFloat(strings.TrimSpace(r.URL.Query().Get("longitude")), 64)
	if err != nil || math.IsNaN(longitude) || math.IsInf(longitude, 0) || longitude < -180 || longitude > 180 {
		return 0, 0, fmt.Errorf("valid longitude is required")
	}
	return latitude, longitude, nil
}

func parseSpotTypes(value string) ([]string, error) {
	if strings.TrimSpace(value) == "" {
		return []string{"cafe", "restaurant"}, nil
	}
	seen := make(map[string]bool)
	result := make([]string, 0)
	for _, raw := range strings.Split(value, ",") {
		spotType := strings.ToLower(strings.TrimSpace(raw))
		if !allowedSpotTypes[spotType] {
			return nil, fmt.Errorf("unsupported spot type: %s", spotType)
		}
		if !seen[spotType] {
			seen[spotType] = true
			result = append(result, spotType)
		}
	}
	return result, nil
}

func parseBoundedFloat(value string, fallback, minimum, maximum float64) (float64, error) {
	if strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) || parsed < minimum || parsed > maximum {
		return 0, fmt.Errorf("value is outside the allowed range")
	}
	return parsed, nil
}

func parseBoundedInt(value string, fallback, minimum, maximum int) (int, error) {
	if strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < minimum || parsed > maximum {
		return 0, fmt.Errorf("value is outside the allowed range")
	}
	return parsed, nil
}

func convertGooglePlaces(places []googlePlace) []spot {
	result := make([]spot, 0, len(places))
	for _, place := range places {
		result = append(result, convertGooglePlace(place))
	}
	return result
}

func convertGooglePlace(place googlePlace) spot {
	return spot{
		PlaceID: place.ID, Name: place.DisplayName.Text,
		FormattedAddress: place.FormattedAddress,
		Latitude:         place.Location.Latitude, Longitude: place.Location.Longitude,
		PrimaryType: place.PrimaryType, GoogleMapsURI: place.GoogleMapsURI,
		Rating: place.Rating,
	}
}
