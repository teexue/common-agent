package provider

import "testing"

func TestIsOutputTruncated(t *testing.T) {
	tests := []struct {
		name   string
		reason string
		out    int
		max    int
		want   bool
	}{
		{name: "length reason", reason: "length", out: 100, max: 8000, want: true},
		{name: "max_tokens reason", reason: "max_tokens", out: 1, max: 0, want: true},
		{name: "hit cap", reason: "stop", out: 8000, max: 8000, want: true},
		{name: "under cap", reason: "stop", out: 100, max: 8000, want: false},
		{name: "no cap", reason: "", out: 9000, max: 0, want: false},
		{name: "empty stop", reason: "", out: 100, max: 8000, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsOutputTruncated(tt.reason, tt.out, tt.max); got != tt.want {
				t.Fatalf("IsOutputTruncated(%q,%d,%d)=%v want %v", tt.reason, tt.out, tt.max, got, tt.want)
			}
		})
	}
}
