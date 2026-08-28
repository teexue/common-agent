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

func TestToolResultBudget_ShrinksWithPressure(t *testing.T) {
	// Low pressure keeps the full cap; high pressure shrinks to the floor.
	assertEqual(t, maxToolResultBytes, toolResultBudget(0))
	assertEqual(t, maxToolResultBytes, toolResultBudget(0.6))
	assertEqual(t, minToolResultBytes, toolResultBudget(1.0))
	assertEqual(t, minToolResultBytes, toolResultBudget(2.0))
	mid := toolResultBudget(0.8)
	if mid <= minToolResultBytes || mid >= maxToolResultBytes {
		t.Fatalf("mid pressure budget %d should be between floor and cap", mid)
	}
}

func TestTruncateToolOutputBudget_RespectsBudget(t *testing.T) {
	big := strings.Repeat("z", 64*1024)
	got := truncateToolOutputBudget(big, 4*1024)
	if len(got) > 5*1024 {
		t.Fatalf("budget-truncated output %d bytes too large", len(got))
	}
	if !strings.Contains(got, "tool output truncated") {
		t.Fatal("budget truncation should carry the marker")
	}
}

func assertEqual(t *testing.T, want, got int) {
	t.Helper()
	if want != got {
		t.Fatalf("expected %d, got %d", want, got)
	}
}
