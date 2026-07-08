package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
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

	// Create temp agents directory.
	dir := t.TempDir()

	// Write a test agent.
	agentContent := `name: test
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
	if err := os.WriteFile(filepath.Join(dir, "test.yaml"), []byte(agentContent), 0o644); err != nil {
		t.Fatal(err)
	}

	// Create registry with mock tool.
	reg := registry.New()
	reg.Register(&mockTool{})

	// Create server with mock provider factory.
	newProvider := func(a *agent.Agent) (provider.Provider, error) {
		return &provider.MockProvider{
			Calls: [][]provider.MockStep{
				{{Text: "test response"}},
			},
		}, nil
	}

	srv := NewServer(ServerConfig{AgentsDir: dir, Registry: reg, NewProvider: newProvider})
	return srv, dir
}

func setupTestServerWithProvider(t *testing.T, newProvider func(a *agent.Agent) (provider.Provider, error)) (*Server, string) {
	t.Helper()
	srv, dir := setupTestServer(t)
	srv.newProvider = newProvider
	srv.svc.NewProvider = newProvider
	return srv, dir
}

func setupTestServerWithStore(t *testing.T) (*Server, string, session.Store) {
	t.Helper()
	srv, dir := setupTestServer(t)
	store, err := session.NewFileStore(filepath.Join(dir, "sessions"))
	if err != nil {
		t.Fatal(err)
	}
	srv.SetStore(store)
	return srv, dir, store
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

	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "up" {
		t.Errorf("expected status 'up', got %q", resp["status"])
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
			name: "missing agent",
			body: RunRequest{Prompt: "hello"},
		},
		{
			name: "missing prompt",
			body: RunRequest{Agent: "test"},
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

func TestHandleRun_AgentNotFound(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	body, _ := json.Marshal(RunRequest{
		Agent:  "nonexistent",
		Prompt: "hello",
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
		Agent:  "test",
		Prompt: "hello",
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

func TestHandleAgents(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/agents", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var items []AgentListItem
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatalf("failed to unmarshal agents: %v", err)
	}
	if len(items) != 1 {
		t.Errorf("expected 1 agent, got %d", len(items))
	}
	if items[0].Name != "test" {
		t.Errorf("expected agent name 'test', got %q", items[0].Name)
	}
	if items[0].Provider != "mock" {
		t.Errorf("expected provider 'mock', got %q", items[0].Provider)
	}
	if items[0].Model != "test-model" {
		t.Errorf("expected model 'test-model', got %q", items[0].Model)
	}
}

func TestNormalizeAgentName(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"test", "test"},
		{"test.yaml", "test"},
		{"my-agent.yaml", "my-agent"},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			if got := service.NormalizeAgentName(tt.input); got != tt.want {
				t.Errorf("NormalizeAgentName(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
func TestHandleApprove(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	// Start a pending approval directly on the server's approver.
	approvalID := "appr-test-1"
	go func() {
		// Block briefly to ensure the registration happens before we resolve.
		srv.approver.Approve(context.Background(), loop.ApprovalRequest{
			Tool:       "test_tool",
			ApprovalID: approvalID,
		})
	}()

	// Wait for the goroutine to register the pending approval.
	time.Sleep(50 * time.Millisecond)

	body, _ := json.Marshal(ApproveRequest{
		ApprovalID: approvalID,
		Approved:   true,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/approve", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp["resolved"] != true {
		t.Fatalf("expected resolved=true, got %v", resp["resolved"])
	}
}

func TestHandleApprove_MissingID(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	body, _ := json.Marshal(ApproveRequest{Approved: true})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/approve", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Code)
	}
}

func TestHandleApprove_NotFound(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	body, _ := json.Marshal(ApproveRequest{ApprovalID: "does-not-exist", Approved: true})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/approve", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", w.Code)
	}
}

// parseSSEEvents parses data: lines from an SSE response body.
func parseSSEEvents(body string) []map[string]any {
	var events []map[string]any
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		var ev map[string]any
		if err := json.Unmarshal([]byte(data), &ev); err == nil {
			events = append(events, ev)
		}
	}
	return events
}

func TestHandleAgents_PartialLoadFailure(t *testing.T) {
	srv, dir := setupTestServer(t)

	// Add an invalid agent file.
	if err := os.WriteFile(filepath.Join(dir, "invalid.yaml"), []byte("name: invalid\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	router := srv.Handler()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/agents", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var items []AgentListItem
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatalf("failed to unmarshal agents: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 valid agent, got %d", len(items))
	}
	if items[0].Name != "test" {
		t.Fatalf("expected agent 'test', got %q", items[0].Name)
	}
}

func TestHandleAgentGet(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/agents/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var detail AgentDetail
	if err := json.Unmarshal(w.Body.Bytes(), &detail); err != nil {
		t.Fatalf("failed to unmarshal agent detail: %v", err)
	}
	if detail.Name != "test" {
		t.Fatalf("expected name 'test', got %q", detail.Name)
	}
	if detail.Provider != "mock" {
		t.Fatalf("expected provider 'mock', got %q", detail.Provider)
	}
	if detail.SystemPrompt == "" {
		t.Fatal("expected non-empty system_prompt")
	}
	if detail.MaxTurns != 5 {
		t.Fatalf("expected max_turns 5, got %d", detail.MaxTurns)
	}
	if detail.MaxTokens != 1024 {
		t.Fatalf("expected max_tokens 1024, got %d", detail.MaxTokens)
	}
}

func TestHandleAgentGet_NotFound(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/agents/nonexistent", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", w.Code)
	}
}

func TestHandleAgentGet_WithYamlSuffix(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/agents/test.yaml", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var detail AgentDetail
	if err := json.Unmarshal(w.Body.Bytes(), &detail); err != nil {
		t.Fatalf("failed to unmarshal agent detail: %v", err)
	}
	if detail.Name != "test" {
		t.Fatalf("expected name 'test', got %q", detail.Name)
	}
}

func TestHandleRun_SessionResume(t *testing.T) {
	srv, _, store := setupTestServerWithStore(t)
	router := srv.Handler()

	// Create and save a session with existing messages.
	sess := session.New("test")
	sess.SetMessages([]provider.Message{
		{Role: provider.RoleSystem, Content: "system prompt"},
		{Role: provider.RoleUser, Content: "hello"},
	})
	if err := store.Save(sess); err != nil {
		t.Fatal(err)
	}

	// Provider returns a response for the resumed conversation.
	srv.newProvider = func(a *agent.Agent) (provider.Provider, error) {
		return &provider.MockProvider{
			Calls: [][]provider.MockStep{
				{{Text: "resumed response"}},
			},
		}, nil
	}

	body, _ := json.Marshal(RunRequest{
		Agent:     "test",
		Prompt:    "follow-up",
		SessionID: sess.ID,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("expected Content-Type text/event-stream, got %q", ct)
	}
	if w.Body.Len() == 0 {
		t.Fatal("expected non-empty SSE response")
	}
}

func TestHandleRun_SessionResumeNotFound(t *testing.T) {
	srv, _, _ := setupTestServerWithStore(t)
	router := srv.Handler()

	body, _ := json.Marshal(RunRequest{
		Agent:     "test",
		Prompt:    "hello",
		SessionID: "does-not-exist",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Code)
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp["code"] != "invalid_request" && resp["code"] != "run_error" {
		t.Fatalf("expected code invalid_request or run_error, got %v", resp["code"])
	}
}

func TestHandleRun_SessionResumeNoStore(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	body, _ := json.Marshal(RunRequest{
		Agent:     "test",
		Prompt:    "hello",
		SessionID: "some-id",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Code)
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp["code"] != "invalid_request" && resp["code"] != "run_error" {
		t.Fatalf("expected code invalid_request or run_error, got %v", resp["code"])
	}
}

func TestHandleRun_ProviderFactoryError(t *testing.T) {
	srv, _ := setupTestServerWithProvider(t, func(a *agent.Agent) (provider.Provider, error) {
		return nil, fmt.Errorf("provider unavailable")
	})
	router := srv.Handler()

	body, _ := json.Marshal(RunRequest{
		Agent:  "test",
		Prompt: "hello",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", w.Code)
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp["code"] != "provider_error" {
		t.Fatalf("expected code provider_error, got %v", resp["code"])
	}
}

type streamErrorProvider struct{}

func (p *streamErrorProvider) Stream(ctx context.Context, req provider.Request) (<-chan provider.Chunk, error) {
	return nil, fmt.Errorf("stream error: connection reset")
}

func TestHandleRun_ProviderStreamError(t *testing.T) {
	srv, _ := setupTestServerWithProvider(t, func(a *agent.Agent) (provider.Provider, error) {
		return &streamErrorProvider{}, nil
	})
	router := srv.Handler()

	body, _ := json.Marshal(RunRequest{
		Agent:  "test",
		Prompt: "hello",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	events := parseSSEEvents(w.Body.String())
	var foundError, foundDone bool
	for _, ev := range events {
		if ev["type"] == "error" && ev["code"] == "provider_error" {
			foundError = true
		}
		if ev["type"] == "done" && ev["status"] == "failed" {
			foundDone = true
		}
	}
	if !foundError {
		t.Fatalf("expected provider_error event, got %v", events)
	}
	if !foundDone {
		t.Fatalf("expected done failed event, got %v", events)
	}
}

func TestHandleRun_ToolApprovalRequired(t *testing.T) {
	srv, dir := setupTestServer(t)

	// Create an agent where test_tool requires confirmation.
	agentContent := `name: confirm-agent
version: 1
provider: mock
model: test-model
system_prompt: |
  You are a test assistant.
tools:
  - test_tool
permissions:
  auto_approve: []
`
	if err := os.WriteFile(filepath.Join(dir, "confirm-agent.yaml"), []byte(agentContent), 0o644); err != nil {
		t.Fatal(err)
	}

	// Provider emits a tool call that will require approval.
	args, _ := json.Marshal(map[string]string{})
	mockProviderFactory := func(a *agent.Agent) (provider.Provider, error) {
		return &provider.MockProvider{
			Calls: [][]provider.MockStep{
				{{
					ToolCalls: []provider.ToolCall{{
						ID:        "call_1",
						Name:      "test_tool",
						Arguments: args,
					}},
				}},
			},
		}, nil
	}
	srv.newProvider = mockProviderFactory
	srv.svc.NewProvider = mockProviderFactory

	router := srv.Handler()
	body, _ := json.Marshal(RunRequest{
		Agent:  "confirm-agent",
		Prompt: "call the tool",
	})

	// Resolve the approval in the background so the run can complete.
	go func() {
		time.Sleep(50 * time.Millisecond)
		srv.approver.ResolveApproval("call_1", true)
	}()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	events := parseSSEEvents(w.Body.String())
	var foundApproval bool
	for _, ev := range events {
		if ev["type"] == "tool_approval_required" {
			foundApproval = true
			if ev["approval_id"] == "" {
				t.Fatal("expected approval_id in approval event")
			}
			if ev["tool_call_id"] == "" {
				t.Fatal("expected tool_call_id in approval event")
			}
		}
	}
	if !foundApproval {
		t.Fatalf("expected tool_approval_required event, got %v", events)
	}
}

func TestHandleRun_ClientDisconnect(t *testing.T) {
	srv, _ := setupTestServerWithProvider(t, func(a *agent.Agent) (provider.Provider, error) {
		return &provider.MockProvider{BlockOnStream: true}, nil
	})
	router := srv.Handler()

	body, _ := json.Marshal(RunRequest{
		Agent:  "test",
		Prompt: "hello",
	})

	ctx, cancel := context.WithCancel(context.Background())
	req, _ := http.NewRequestWithContext(ctx, "POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		router.ServeHTTP(w, req)
		close(done)
	}()

	// Give the handler a moment to start the SSE stream, then cancel.
	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("handler did not return after context cancellation")
	}

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	events := parseSSEEvents(w.Body.String())
	var foundError, foundDone bool
	for _, ev := range events {
		if ev["type"] == "error" && ev["code"] == "cancelled" {
			foundError = true
		}
		if ev["type"] == "done" && ev["status"] == "cancelled" {
			foundDone = true
		}
	}
	if !foundError {
		t.Fatalf("expected cancelled error event, got %v", events)
	}
	if !foundDone {
		t.Fatalf("expected done cancelled event, got %v", events)
	}
}

func TestHandleSessionsList(t *testing.T) {
	srv, _, store := setupTestServerWithStore(t)
	router := srv.Handler()

	sess := session.New("test")
	if err := store.Save(sess); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/sessions", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var metas []session.SessionMeta
	if err := json.Unmarshal(w.Body.Bytes(), &metas); err != nil {
		t.Fatalf("failed to unmarshal sessions: %v", err)
	}
	if len(metas) != 1 {
		t.Fatalf("expected 1 session, got %d", len(metas))
	}
	if metas[0].ID != sess.ID {
		t.Fatalf("expected session id %q, got %q", sess.ID, metas[0].ID)
	}
}

func TestHandleSessionsGet(t *testing.T) {
	srv, _, store := setupTestServerWithStore(t)
	router := srv.Handler()

	sess := session.New("test")
	if err := store.Save(sess); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/sessions/"+sess.ID, nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp["id"] != sess.ID {
		t.Fatalf("expected id %q, got %v", sess.ID, resp["id"])
	}
}

func TestHandleSessionsGet_NotFound(t *testing.T) {
	srv, _, _ := setupTestServerWithStore(t)
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/sessions/does-not-exist", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", w.Code)
	}
}

func TestHandleSessionsDelete(t *testing.T) {
	srv, _, store := setupTestServerWithStore(t)
	router := srv.Handler()

	sess := session.New("test")
	if err := store.Save(sess); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/v1/sessions/"+sess.ID, nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	_, err := store.Load(sess.ID)
	if err == nil {
		t.Fatal("expected session to be deleted")
	}
}

func TestHandleSessionsDelete_NotFound(t *testing.T) {
	srv, _, _ := setupTestServerWithStore(t)
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/v1/sessions/does-not-exist", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", w.Code)
	}
}

// ─── Auth Middleware ──────────────────────────────────────────────

func TestAuth_NoAPIKey_AllowsAll(t *testing.T) {
	srv, _ := setupTestServer(t)
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/tools", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 without auth, got %d", w.Code)
	}
}

func TestAuth_WithAPIKey_RequiresKey(t *testing.T) {
	srv, _ := setupTestServer(t)
	srv.SetAPIKey("secret-key-123")
	router := srv.Handler()

	// No key → 401.
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/tools", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without key, got %d", w.Code)
	}

	// Wrong key → 401.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/tools", nil)
	req.Header.Set("Authorization", "Bearer wrong-key")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with wrong key, got %d", w.Code)
	}

	// Correct key via Bearer → 200.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/tools", nil)
	req.Header.Set("Authorization", "Bearer secret-key-123")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 with correct Bearer key, got %d", w.Code)
	}

	// Correct key via X-API-Key → 200.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/tools", nil)
	req.Header.Set("X-API-Key", "secret-key-123")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 with correct X-API-Key, got %d", w.Code)
	}
}

func TestAuth_WithAPIKey_CaseInsensitiveBearer(t *testing.T) {
	srv, _ := setupTestServer(t)
	srv.SetAPIKey("secret-key-123")
	router := srv.Handler()

	// Lowercase "bearer" should also be accepted.
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/tools", nil)
	req.Header.Set("Authorization", "bearer secret-key-123")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 with lowercase bearer, got %d", w.Code)
	}
}

func TestAuth_HealthEndpointsAlwaysPublic(t *testing.T) {
	srv, _ := setupTestServer(t)
	srv.SetAPIKey("secret-key-123")
	router := srv.Handler()

	for _, path := range []string{"/healthz", "/readyz"} {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", path, nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 for %s with auth enabled, got %d", path, w.Code)
		}
	}
}

func TestAuth_RunEndpointWithKey(t *testing.T) {
	srv, _ := setupTestServer(t)
	srv.SetAPIKey("test-api-key")
	router := srv.Handler()

	body, _ := json.Marshal(RunRequest{
		Agent:  "test",
		Prompt: "hello",
	})

	// Without key → 401.
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without key, got %d", w.Code)
	}

	// With correct key → 200.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/agents/run", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-api-key")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 with correct key, got %d: %s", w.Code, w.Body.String())
	}
}
