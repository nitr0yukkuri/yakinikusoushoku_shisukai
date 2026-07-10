package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var googleRoutesURL = "https://routes.googleapis.com/directions/v2:computeRoutes"

const earthRadiusMeters = 6371000
const walkRouteThresholdMeters = 10000
const transitExtraBufferMinutes = 10

type calculateETARequest struct {
	Latitude      float64 `json:"latitude"`
	Longitude     float64 `json:"longitude"`
	TravelMode    string  `json:"travelMode"`
	BufferMinutes *int    `json:"bufferMinutes"`
}

type etaResponse struct {
	MeetupID        int64     `json:"meetupId"`
	TravelMode      string    `json:"travelMode"`
	DurationSeconds int64     `json:"durationSeconds"`
	DistanceMeters  int64     `json:"distanceMeters"`
	BufferMinutes   int       `json:"bufferMinutes"`
	RoutePolyline   string    `json:"routePolyline,omitempty"`
	ArrivalAt       time.Time `json:"arrivalAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type meetupETA struct {
	etaResponse
	User friendProfile `json:"user"`
}

type routesAPIRequest struct {
	Origin            routeWaypoint `json:"origin"`
	Destination       routeWaypoint `json:"destination"`
	TravelMode        string        `json:"travelMode"`
	RoutingPreference string        `json:"routingPreference,omitempty"`
	DepartureTime     string        `json:"departureTime,omitempty"`
}

type routeWaypoint struct {
	Location routeLocation `json:"location"`
}

type routeLocation struct {
	LatLng routeLatLng `json:"latLng"`
}

type routeLatLng struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type routesAPIResponse struct {
	Routes []struct {
		Duration       string `json:"duration"`
		DistanceMeters int64  `json:"distanceMeters"`
		Polyline       struct {
			EncodedPolyline string `json:"encodedPolyline"`
		} `json:"polyline"`
		Legs []struct {
			Steps []struct {
				Polyline struct {
					EncodedPolyline string `json:"encodedPolyline"`
				} `json:"polyline"`
			} `json:"steps"`
		} `json:"legs"`
	} `json:"routes"`
}

func calculateMeetupETA(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo, meetupID int64) {
	var req calculateETARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		writeJSONError(w, http.StatusBadRequest, "valid origin coordinates are required")
		return
	}
	bufferMinutes := 5
	if req.BufferMinutes != nil {
		bufferMinutes = *req.BufferMinutes
	}
	if bufferMinutes < 0 || bufferMinutes > 30 {
		writeJSONError(w, http.StatusBadRequest, "bufferMinutes must be between 0 and 30")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	if err := requireAcceptedMeetupMember(ctx, pool, userNo, meetupID); err != nil {
		writeJSONError(w, http.StatusForbidden, "meetup access denied")
		return
	}

	var destinationLat, destinationLng float64
	err := pool.QueryRow(ctx, `
		SELECT latitude, longitude FROM meetups
		WHERE id = $1 AND status IN ('scheduled', 'active')
	`, meetupID).Scan(&destinationLat, &destinationLng)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSONError(w, http.StatusNotFound, "meetup not found")
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read meetup destination")
		return
	}

	travelMode := selectTravelModeByDistance(req.Latitude, req.Longitude, destinationLat, destinationLng)
	durationSeconds, distanceMeters, routePolyline, err := requestGoogleRoute(ctx, req.Latitude, req.Longitude, destinationLat, destinationLng, travelMode)
	if err != nil {
		log.Printf("route calculation failed; using fallback ETA: meetup=%d user=%d mode=%s err=%v", meetupID, userNo, travelMode, err)
		durationSeconds, distanceMeters = estimateFallbackRoute(req.Latitude, req.Longitude, destinationLat, destinationLng, travelMode)
	}
	effectiveBufferMinutes := bufferMinutesForTravelMode(travelMode, bufferMinutes)
	now := time.Now()
	arrivalAt := now.Add(time.Duration(durationSeconds)*time.Second + time.Duration(effectiveBufferMinutes)*time.Minute)
	var saved etaResponse
	err = pool.QueryRow(ctx, `
		INSERT INTO meetup_arrival_estimates (
			meetup_id, user_id, travel_mode, duration_seconds, distance_meters,
			buffer_minutes, route_polyline, arrival_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
		ON CONFLICT (meetup_id, user_id) DO UPDATE SET
			travel_mode = EXCLUDED.travel_mode,
			duration_seconds = EXCLUDED.duration_seconds,
			distance_meters = EXCLUDED.distance_meters,
			buffer_minutes = EXCLUDED.buffer_minutes,
			route_polyline = EXCLUDED.route_polyline,
			arrival_at = EXCLUDED.arrival_at,
			updated_at = now()
		RETURNING meetup_id, travel_mode, duration_seconds, distance_meters,
			buffer_minutes, COALESCE(route_polyline, ''), arrival_at, updated_at
	`, meetupID, userNo, travelMode, durationSeconds, distanceMeters, effectiveBufferMinutes, routePolyline, arrivalAt).Scan(
		&saved.MeetupID, &saved.TravelMode, &saved.DurationSeconds, &saved.DistanceMeters,
		&saved.BufferMinutes, &saved.RoutePolyline, &saved.ArrivalAt, &saved.UpdatedAt,
	)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to save ETA")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"eta": saved})
}

func listMeetupETAs(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, userNo, meetupID int64) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if err := requireAcceptedMeetupMember(ctx, pool, userNo, meetupID); err != nil {
		writeJSONError(w, http.StatusForbidden, "meetup access denied")
		return
	}
	rows, err := pool.Query(ctx, `
		SELECT e.meetup_id, e.travel_mode, e.duration_seconds, e.distance_meters,
			e.buffer_minutes, COALESCE(e.route_polyline, ''), e.arrival_at, e.updated_at,
			u.user_id, COALESCE(u.name, ''),
			COALESCE(NULLIF(u.profile_image, ''), NULLIF(u.picture_url, ''), '')
		FROM meetup_arrival_estimates e
		JOIN auth_users u ON u.id = e.user_id
		JOIN meetup_members mm ON mm.meetup_id = e.meetup_id
			AND mm.user_id = e.user_id AND mm.status = 'accepted'
		WHERE e.meetup_id = $1
		ORDER BY e.arrival_at, LOWER(u.name)
	`, meetupID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read ETAs")
		return
	}
	defer rows.Close()
	etas := make([]meetupETA, 0)
	for rows.Next() {
		var item meetupETA
		if err := rows.Scan(
			&item.MeetupID, &item.TravelMode, &item.DurationSeconds, &item.DistanceMeters,
			&item.BufferMinutes, &item.RoutePolyline, &item.ArrivalAt, &item.UpdatedAt,
			&item.User.UserID, &item.User.Name, &item.User.ProfileImage,
		); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to read ETAs")
			return
		}
		etas = append(etas, item)
	}
	if err := rows.Err(); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to read ETAs")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"etas": etas})
}

func requestGoogleRoute(ctx context.Context, originLat, originLng, destinationLat, destinationLng float64, travelMode string) (int64, int64, string, error) {
	apiKey := strings.TrimSpace(os.Getenv("GOOGLE_MAPS_API_KEY"))
	if apiKey == "" {
		return 0, 0, "", fmt.Errorf("GOOGLE_MAPS_API_KEY is not configured")
	}
	payload := routesAPIRequest{
		Origin:      routeWaypoint{Location: routeLocation{LatLng: routeLatLng{Latitude: originLat, Longitude: originLng}}},
		Destination: routeWaypoint{Location: routeLocation{LatLng: routeLatLng{Latitude: destinationLat, Longitude: destinationLng}}},
		TravelMode:  travelMode,
	}
	if travelMode == "DRIVE" {
		payload.RoutingPreference = "TRAFFIC_AWARE"
	}
	if travelMode == "TRANSIT" {
		payload.DepartureTime = time.Now().UTC().Format(time.RFC3339)
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return 0, 0, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleRoutesURL, bytes.NewReader(body))
	if err != nil {
		return 0, 0, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Goog-Api-Key", apiKey)
	req.Header.Set("X-Goog-FieldMask", "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.polyline.encodedPolyline")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, 0, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		limitedBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return 0, 0, "", fmt.Errorf("routes API returned %d: %s", resp.StatusCode, strings.TrimSpace(string(limitedBody)))
	}
	var result routesAPIResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return 0, 0, "", err
	}
	if len(result.Routes) == 0 {
		return 0, 0, "", fmt.Errorf("route not found")
	}
	duration, err := time.ParseDuration(result.Routes[0].Duration)
	if err != nil {
		return 0, 0, "", fmt.Errorf("invalid route duration: %w", err)
	}
	routePolyline := result.Routes[0].Polyline.EncodedPolyline
	if routePolyline == "" {
		routePolyline = buildRoutePolylineFromSteps(result.Routes[0].Legs)
	}
	return int64(duration.Seconds()), result.Routes[0].DistanceMeters, routePolyline, nil
}

func selectTravelModeByDistance(originLat, originLng, destinationLat, destinationLng float64) string {
	if haversineDistanceMeters(originLat, originLng, destinationLat, destinationLng) <= walkRouteThresholdMeters {
		return "WALK"
	}
	return "TRANSIT"
}

func bufferMinutesForTravelMode(travelMode string, baseBufferMinutes int) int {
	if travelMode == "TRANSIT" {
		return baseBufferMinutes + transitExtraBufferMinutes
	}
	return baseBufferMinutes
}

func buildRoutePolylineFromSteps(legs []struct {
	Steps []struct {
		Polyline struct {
			EncodedPolyline string `json:"encodedPolyline"`
		} `json:"polyline"`
	} `json:"steps"`
}) string {
	points := make([]routeLatLng, 0)
	for _, leg := range legs {
		for _, step := range leg.Steps {
			stepPoints, err := decodeEncodedPolyline(step.Polyline.EncodedPolyline)
			if err != nil || len(stepPoints) == 0 {
				continue
			}
			if len(points) > 0 && sameRoutePoint(points[len(points)-1], stepPoints[0]) {
				stepPoints = stepPoints[1:]
			}
			points = append(points, stepPoints...)
		}
	}
	if len(points) < 2 {
		return ""
	}
	return encodeRoutePolyline(points)
}

func decodeEncodedPolyline(encoded string) ([]routeLatLng, error) {
	points := make([]routeLatLng, 0)
	index := 0
	lat := int64(0)
	lng := int64(0)
	for index < len(encoded) {
		latDelta, nextIndex, err := decodePolylineValue(encoded, index)
		if err != nil {
			return nil, err
		}
		index = nextIndex
		lngDelta, nextIndex, err := decodePolylineValue(encoded, index)
		if err != nil {
			return nil, err
		}
		index = nextIndex
		lat += latDelta
		lng += lngDelta
		points = append(points, routeLatLng{Latitude: float64(lat) / 1e5, Longitude: float64(lng) / 1e5})
	}
	return points, nil
}

func decodePolylineValue(encoded string, index int) (int64, int, error) {
	var result int64
	var shift uint
	for index < len(encoded) {
		value := int64(encoded[index] - 63)
		index++
		result |= (value & 0x1f) << shift
		shift += 5
		if value < 0x20 {
			if result&1 != 0 {
				return ^(result >> 1), index, nil
			}
			return result >> 1, index, nil
		}
	}
	return 0, index, fmt.Errorf("invalid encoded polyline")
}

func encodeRoutePolyline(points []routeLatLng) string {
	var builder strings.Builder
	prevLat := int64(0)
	prevLng := int64(0)
	for _, point := range points {
		lat := int64(math.Round(point.Latitude * 1e5))
		lng := int64(math.Round(point.Longitude * 1e5))
		encodePolylineValue(&builder, lat-prevLat)
		encodePolylineValue(&builder, lng-prevLng)
		prevLat = lat
		prevLng = lng
	}
	return builder.String()
}

func encodePolylineValue(builder *strings.Builder, value int64) {
	value <<= 1
	if value < 0 {
		value = ^value
	}
	for value >= 0x20 {
		builder.WriteByte(byte((0x20 | (value & 0x1f)) + 63))
		value >>= 5
	}
	builder.WriteByte(byte(value + 63))
}

func sameRoutePoint(left, right routeLatLng) bool {
	return math.Abs(left.Latitude-right.Latitude) < 0.00001 && math.Abs(left.Longitude-right.Longitude) < 0.00001
}

func estimateFallbackRoute(originLat, originLng, destinationLat, destinationLng float64, travelMode string) (int64, int64) {
	distanceMeters := haversineDistanceMeters(originLat, originLng, destinationLat, destinationLng)
	speedMetersPerSecond := fallbackSpeedMetersPerSecond(travelMode)
	durationSeconds := int64(math.Ceil(float64(distanceMeters) / speedMetersPerSecond))
	if durationSeconds < 60 && distanceMeters > 0 {
		durationSeconds = 60
	}
	return durationSeconds, distanceMeters
}

func fallbackSpeedMetersPerSecond(travelMode string) float64 {
	switch travelMode {
	case "WALK":
		return 1.4
	case "BICYCLE":
		return 4.2
	case "TRANSIT":
		return 6.9
	default:
		return 8.3
	}
}

func haversineDistanceMeters(originLat, originLng, destinationLat, destinationLng float64) int64 {
	originLatRad := originLat * math.Pi / 180
	destinationLatRad := destinationLat * math.Pi / 180
	latDelta := (destinationLat - originLat) * math.Pi / 180
	lngDelta := (destinationLng - originLng) * math.Pi / 180

	a := math.Sin(latDelta/2)*math.Sin(latDelta/2) +
		math.Cos(originLatRad)*math.Cos(destinationLatRad)*
			math.Sin(lngDelta/2)*math.Sin(lngDelta/2)
	return int64(math.Round(earthRadiusMeters * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))))
}
