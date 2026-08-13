package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestOpenAIStreamCachedTokens(t *testing.T) {
	// OpenAI official style: prompt_tokens_details.cached_tokens.
	payload := "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":1000,\"completion_tokens\":50,\"prompt_tokens_details\":{\"cached_tokens\":700}}}\n\ndata: [DONE]\n\n"
	o := &OpenAI{}
	ch := make(chan Chunk, 16)
	o.readStream(context.Background(), strings.NewReader(payload), ch)
	close(ch)
	var done *Chunk
	for c := range ch {
		if c.Done {
			done = &c
		}
	}
	if done == nil {
		t.Fatal("no done chunk")
	}
	if done.CacheReadInputTokens != 700 {
		t.Fatalf("cache read = %d, want 700", done.CacheReadInputTokens)
	}
}

func TestOpenAIStreamDeepSeekCacheHits(t *testing.T) {
	// DeepSeek style: prompt_cache_hit_tokens.
	payload := "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":900,\"completion_tokens\":40,\"prompt_cache_hit_tokens\":600,\"prompt_cache_miss_tokens\":300}}\n\ndata: [DONE]\n\n"
	o := &OpenAI{}
	ch := make(chan Chunk, 16)
	o.readStream(context.Background(), strings.NewReader(payload), ch)
	close(ch)
	var done *Chunk
	for c := range ch {
		if c.Done {
			done = &c
		}
	}
	if done == nil {
		t.Fatal("no done chunk")
	}
	if done.CacheReadInputTokens != 600 {
		t.Fatalf("cache read = %d, want 600", done.CacheReadInputTokens)
	}
}
