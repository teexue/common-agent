package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAIBuildRequestWithThinking(t *testing.T) {
	o, err := NewOpenAI(OpenAIConfig{
		APIKey:   "test",
		Thinking: &ThinkingConfig{Type: "disabled"},
	})
	if err != nil {
		t.Fatal(err)
	}

	body := o.buildRequest(Request{
		Model: "kimi-k2.6",
		Messages: []Message{
			{Role: RoleUser, Content: "hi"},
		},
	})
	if body.Thinking == nil || body.Thinking.Type != "disabled" {
		t.Fatalf("thinking = %#v", body.Thinking)
	}
}

func TestOpenAIBuildRequestPreservesReasoningContent(t *testing.T) {
	o, err := NewOpenAI(OpenAIConfig{APIKey: "test"})
	if err != nil {
		t.Fatal(err)
	}

	body := o.buildRequest(Request{
		Model: "kimi-k2.6",
		Messages: []Message{
			{Role: RoleUser, Content: "time?"},
			{
				Role:             RoleAssistant,
				ReasoningContent: "need get_time tool",
				Content:          "",
				ToolCalls: []ToolCall{{
					ID: "1", Name: "get_time", Arguments: json.RawMessage("{}"),
				}},
			},
		},
	})
	if len(body.Messages) != 2 {
		t.Fatalf("messages = %d", len(body.Messages))
	}
	if body.Messages[1].ReasoningContent != "need get_time tool" {
		t.Fatalf("reasoning_content = %q", body.Messages[1].ReasoningContent)
	}
}

func TestOpenAIListModels(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/models" {
			t.Fatalf("path = %q, want /models", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test" {
			t.Fatalf("auth = %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"kimi-k2.6"},{"id":"kimi-k2.5"}]}`))
	}))
	defer srv.Close()

	o, err := NewOpenAI(OpenAIConfig{APIKey: "test", BaseURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}
	models, err := o.ListModels(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(models) != 2 || models[0].ID != "kimi-k2.6" {
		t.Fatalf("models = %#v", models)
	}
}

func TestOpenAICapabilities(t *testing.T) {
	o, err := NewOpenAI(OpenAIConfig{APIKey: "test", Vision: true, Thinking: &ThinkingConfig{Type: "enabled"}})
	if err != nil {
		t.Fatal(err)
	}
	caps := o.Capabilities()
	if !caps.Vision || !caps.Reasoning {
		t.Fatalf("caps = %#v", caps)
	}
}
