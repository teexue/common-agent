package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAnthropicBuildRequest(t *testing.T) {
	a, err := NewAnthropic(AnthropicConfig{APIKey: "test"})
	if err != nil {
		t.Fatal(err)
	}

	req := Request{
		Model: "claude-sonnet-4-20250514",
		Messages: []Message{
			{Role: RoleSystem, Content: "system prompt"},
			{Role: RoleUser, Content: "hello"},
			{
				Role:    RoleAssistant,
				Content: "calling tool",
				ToolCalls: []ToolCall{{
					ID: "toolu_1", Name: "echo", Arguments: json.RawMessage(`{"message":"hi"}`),
				}},
			},
			{Role: RoleTool, ToolCallID: "toolu_1", Content: `{"message":"hi"}`},
		},
		Tools: []ToolDefinition{{
			Name: "echo", Description: "echo", Parameters: map[string]any{"type": "object"},
		}},
	}

	body := a.buildRequest(req)
	if body.System != "system prompt" {
		t.Fatalf("system = %q", body.System)
	}
	if len(body.Messages) != 3 {
		t.Fatalf("messages = %d, want 3", len(body.Messages))
	}
	if body.Messages[1].Role != "assistant" {
		t.Fatalf("assistant role = %q", body.Messages[1].Role)
	}
	if body.Messages[1].Content[1].Type != "tool_use" {
		t.Fatalf("expected tool_use block")
	}
	if body.Messages[2].Content[0].Type != "tool_result" {
		t.Fatalf("expected tool_result block")
	}
}

func TestNewAnthropicRequiresAPIKey(t *testing.T) {
	if _, err := NewAnthropic(AnthropicConfig{}); err == nil {
		t.Fatal("expected error")
	}
}

func TestAnthropicListModels(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" {
			t.Fatalf("path = %q, want /v1/models", r.URL.Path)
		}
		if got := r.Header.Get("x-api-key"); got != "test" {
			t.Fatalf("x-api-key = %q", got)
		}
		if got := r.Header.Get("anthropic-version"); got == "" {
			t.Fatal("missing anthropic-version header")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"claude-sonnet-4-20250514"},{"id":"claude-3-5-sonnet-20241022"}]}`))
	}))
	defer srv.Close()

	a, err := NewAnthropic(AnthropicConfig{APIKey: "test", BaseURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}
	models, err := a.ListModels(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(models) != 2 || models[0].ID != "claude-sonnet-4-20250514" {
		t.Fatalf("models = %#v", models)
	}
}
