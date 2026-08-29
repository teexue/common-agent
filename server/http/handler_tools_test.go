package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

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
