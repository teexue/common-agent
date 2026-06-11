package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/scenario"
	"github.com/teexue/common-agent/core/tool"
	"github.com/teexue/common-agent/tools/registry"
)

// mockTool is a minimal tool for testing.
type mockTool struct{}

func (m *mockTool) Name() string        { return "test_tool" }
func (m *mockTool) Description() string  { return "A test tool" }
func (m *mockTool) InputSchema() map[string]any {
	return map[string]any{
		"type":       "object",
		"properties": map[string]any{},
	}
}
func (m *mockTool) Execute(_ context.Context, _ json.RawMessage) (tool.Result, error) {
	return tool.Result{Output: json.RawMessage(`"ok"`)}, nil
}

func setupTestServer(t *testing.T) (*Server, string) {
	t.Helper()

	// Create temp scenario directory.
	dir := t.TempDir()

	// Write a test scenario.
	scContent := `name: test
version: 1
provider: mock
model: test-model
system_prompt: |
  You are a test assistant.
tools:
  - test_tool
max_turns: 5
max_tokens: 1024
`
	if err := os.WriteFile(filepath.Join(dir, "test.yaml"), []byte(scContent), 0o644); err != nil {
		t.Fatal(err)
	}

	// Create registry with mock tool.
	reg := registry.New()
	reg.Register(&mockTool{})

	// Create server with mock provider factory.
	newProvider := func(sc *scenario.Scenario) (provider.Provider, error) {
		return &provider.MockProvider{
			Calls: [][]provider.MockStep{
				{{Text: "test response"}},
			},
		}, nil
	}

	srv := NewServer(dir, reg, newProvider, nil, nil)
	return srv, dir
}

func TestHandleHealth(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/healthz", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	if w.Body.String() != "ok" {
		t.Errorf("expected body 'ok', got %q", w.Body.String())
	}
}

func TestHandleRun_MissingParams(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	tests := []struct {
		name string
		body RunRequest
	}{
		{
			name: "missing scenario",
			body: RunRequest{Prompt: "hello"},
		},
		{
			name: "missing prompt",
			body: RunRequest{Scenario: "test"},
		},
		{
			name: "both missing",
			body: RunRequest{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.body)
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("expected status 400, got %d", w.Code)
			}
		})
	}
}

func TestHandleRun_ScenarioNotFound(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	body, _ := json.Marshal(RunRequest{
		Scenario: "nonexistent",
		Prompt:   "hello",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestHandleRun_HappyPath(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	body, _ := json.Marshal(RunRequest{
		Scenario: "test",
		Prompt:   "hello",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Errorf("expected Content-Type text/event-stream, got %q", ct)
	}
	// Verify we got some SSE data.
	if w.Body.Len() == 0 {
		t.Error("expected non-empty response body")
	}
}

func TestHandleTools(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/tools", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var tools []ToolInfo
	if err := json.Unmarshal(w.Body.Bytes(), &tools); err != nil {
		t.Fatalf("failed to unmarshal tools: %v", err)
	}
	if len(tools) != 1 {
		t.Errorf("expected 1 tool, got %d", len(tools))
	}
	if tools[0].Name != "test_tool" {
		t.Errorf("expected tool name 'test_tool', got %q", tools[0].Name)
	}
}

func TestHandleScenarios(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/scenarios", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var names []string
	if err := json.Unmarshal(w.Body.Bytes(), &names); err != nil {
		t.Fatalf("failed to unmarshal scenarios: %v", err)
	}
	if len(names) != 1 {
		t.Errorf("expected 1 scenario, got %d", len(names))
	}
	if names[0] != "test" {
		t.Errorf("expected scenario name 'test', got %q", names[0])
	}
}

func TestNormalizeScenarioName(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"test", "test"},
		{"test.yaml", "test"},
		{"my-scenario.yaml", "my-scenario"},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			if got := NormalizeScenarioName(tt.input); got != tt.want {
				t.Errorf("NormalizeScenarioName(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
