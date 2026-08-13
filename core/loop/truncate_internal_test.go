package loop

import (
	"strings"
	"testing"
)

func TestTruncateToolOutput_Short(t *testing.T) {
	s := "small output"
	if got := truncateToolOutput(s); got != s {
		t.Fatalf("short output should pass through, got %q", got)
	}
}

func TestTruncateToolOutput_KeepsHeadAndTail(t *testing.T) {
	big := strings.Repeat("A", 20*1024) + "END-MARKER" + strings.Repeat("B", 20*1024)
	got := truncateToolOutput(big)
	if len(got) > maxToolResultBytes {
		t.Fatalf("truncated output %d bytes exceeds cap %d", len(got), maxToolResultBytes)
	}
	if !strings.HasPrefix(got, strings.Repeat("A", 8)) {
		t.Fatal("truncated output should keep the head")
	}
	if !strings.HasSuffix(got, strings.Repeat("B", 8)) {
		t.Fatal("truncated output should keep the tail")
	}
	if !strings.Contains(got, "tool output truncated") {
		t.Fatal("truncated output should carry the marker")
	}
}

func TestTruncateToolOutput_KeepsMiddleMarker(t *testing.T) {
	big := strings.Repeat("x", 32*1024)
	got := truncateToolOutput(big)
	if !strings.Contains(got, "END") && !strings.Contains(got, "truncated") {
		t.Fatal("expected truncation marker in output")
	}
}
