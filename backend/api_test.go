package main

import (
	"fmt"
	"net/http"
	"os"
	"testing"
)

func TestGoogleMapsAPI(t *testing.T) {
	apiKey := os.Getenv("GOOGLE_MAPS_API_KEY")
	if apiKey == "" {
		t.Fatal("GOOGLE_MAPS_API_KEY is not set")
	}

	// 例: Places APIの検索リクエスト（実際に叩いてみる）
	url := fmt.Sprintf("https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=-33.867,151.195&radius=500&key=%s", apiKey)
	
	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	} else {
		fmt.Println("API connection successful!")
	}
}