package main

import "testing"

func TestNormalizeDatabaseURL(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "plain URL",
			input: "postgresql://postgres:password@db.example.com:5432/postgres",
			want:  "postgresql://postgres:password@db.example.com:5432/postgres",
		},
		{
			name:  "single quotes from dashboard input",
			input: "'postgresql://postgres:password@db.example.com:5432/postgres'",
			want:  "postgresql://postgres:password@db.example.com:5432/postgres",
		},
		{
			name:  "double quotes and surrounding whitespace",
			input: "  \"postgresql://postgres:password@db.example.com:5432/postgres\"  ",
			want:  "postgresql://postgres:password@db.example.com:5432/postgres",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeDatabaseURL(tt.input); got != tt.want {
				t.Fatalf("normalizeDatabaseURL() = %q, want %q", got, tt.want)
			}
		})
	}
}
