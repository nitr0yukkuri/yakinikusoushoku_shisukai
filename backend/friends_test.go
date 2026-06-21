package main

import "testing"

func TestCanonicalFriendPair(t *testing.T) {
	for _, test := range []struct {
		first, second int64
		wantLow       int64
		wantHigh      int64
	}{
		{first: 2, second: 9, wantLow: 2, wantHigh: 9},
		{first: 9, second: 2, wantLow: 2, wantHigh: 9},
	} {
		low, high := canonicalFriendPair(test.first, test.second)
		if low != test.wantLow || high != test.wantHigh {
			t.Fatalf("canonicalFriendPair(%d, %d) = (%d, %d), want (%d, %d)",
				test.first, test.second, low, high, test.wantLow, test.wantHigh)
		}
	}
}

func TestFriendQRValue(t *testing.T) {
	got := friendQRValue("user123")
	want := "matsunya://friends/add?userId=user123"
	if got != want {
		t.Fatalf("friendQRValue() = %q, want %q", got, want)
	}
}
