package builtin_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/teexue/common-agent/tools/builtin"
)

// TestRunCommandOutputCapped verifies that chatty command output is truncated
// instead of being captured in full and re-sent to the LLM every turn.
func TestRunCommandOutputCapped(t *testing.T) {
	dir := t.TempDir()
	rc := builtin.RunCommand{WorkDir: dir}

	// Generate ~2MB of stdout and stderr.
	input, _ := json.Marshal(map[string]string{
		"command": "python3 -c \"import sys; sys.stdout.write('x'*1200000); sys.stderr.write('y'*1200000)\"",
	})
	res, err := rc.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	stdout, _ := out["stdout"].(string)
	stderr, _ := out["stderr"].(string)

	// Output must be capped near the limit (not megabytes), and marked.
	if len(stdout) > builtin.MaxCommandOutputForTest+64 {
		t.Fatalf("stdout too large: %d", len(stdout))
	}
	if len(stderr) > builtin.MaxCommandOutputForTest+64 {
		t.Fatalf("stderr too large: %d", len(stderr))
	}
	if !strings.Contains(stdout, "...[output truncated]") {
		t.Fatalf("expected truncation marker in stdout, got %d bytes", len(stdout))
	}
	if !strings.Contains(stderr, "...[output truncated]") {
		t.Fatalf("expected truncation marker in stderr, got %d bytes", len(stderr))
	}
}
