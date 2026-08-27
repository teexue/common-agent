package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOllamaThinkMapping(t *testing.T) {
	cases := []struct {
		in   *ThinkingConfig
		want any
	}{
		{nil, nil},
		{&ThinkingConfig{Type: ""}, nil},
		{&ThinkingConfig{Type: "enabled"}, true},
		{&ThinkingConfig{Type: "disabled"}, false},
		{&ThinkingConfig{Type: "high"}, "high"},
		{&ThinkingConfig{Type: "medium"}, "medium"},
		{&ThinkingConfig{Type: "low"}, "low"},
		{&ThinkingConfig{Type: "max"}, "max"},
		{&ThinkingConfig{Type: "bogus"}, nil},
	}
	for _, c := range cases {
		assert.Equal(t, c.want, ollamaThinkValue(c.in), "input %+v", c.in)
	}
}

func TestOllamaBuildRequest(t *testing.T) {
	o, err := NewOllama(OllamaConfig{
		BaseURL:   "http://localhost:11434",
		Thinking:  &ThinkingConfig{Type: "high"},
		KeepAlive: "5m",
	})
	require.NoError(t, err)

	body := o.buildRequest(Request{
		Model:     "qwen3",
		MaxTokens: 256,
		Messages: []Message{
			{
				Role: RoleUser,
				ContentParts: []ContentPart{
					{Type: "text", Text: "what is this?"},
					{Type: "image_url", ImageURL: &ImageURL{URL: "data:image/png;base64,QUJD"}},
				},
			},
		},
		Tools: []ToolDefinition{{Name: "get_time", Description: "now", Parameters: map[string]any{"type": "object"}}},
	})

	assert.Equal(t, "qwen3", body.Model)
	assert.True(t, body.Stream)
	assert.Equal(t, "high", body.Think)
	assert.Equal(t, "5m", body.KeepAlive)
	require.NotNil(t, body.Options)
	assert.Equal(t, 256, body.Options.NumPredict)

	require.Len(t, body.Messages, 1)
	assert.Equal(t, "what is this?", body.Messages[0].Content)
	assert.Equal(t, []string{"QUJD"}, body.Messages[0].Images) // base64 stripped of data: prefix

	require.Len(t, body.Tools, 1)
	assert.Equal(t, "function", body.Tools[0].Type)
	assert.Equal(t, "get_time", body.Tools[0].Function.Name)
}

func TestOllamaBuildRequestOmitsOptionsWhenNoMaxTokens(t *testing.T) {
	o, _ := NewOllama(OllamaConfig{})
	body := o.buildRequest(Request{Model: "qwen3"})
	assert.Nil(t, body.Options)
	assert.Nil(t, body.Think)
	assert.Empty(t, body.KeepAlive)
}

func TestOllamaDataURLToBase64(t *testing.T) {
	b64, ok := dataURLToBase64("data:image/png;base64,QUJD")
	require.True(t, ok)
	assert.Equal(t, "QUJD", b64)

	_, ok = dataURLToBase64("https://example.com/img.png")
	assert.False(t, ok)

	_, ok = dataURLToBase64("data:image/png")
	assert.False(t, ok)
}

func TestOllamaStreamAuthAndPath(t *testing.T) {
	var gotPath, gotAuth, gotAccept string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		gotAccept = r.Header.Get("Accept")
		w.Header().Set("Content-Type", "application/x-ndjson")
		// terminal event with usage
		_, _ = w.Write([]byte(`{"message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","prompt_eval_count":11,"eval_count":18}` + "\n"))
	}))
	defer srv.Close()

	o, err := NewOllama(OllamaConfig{BaseURL: srv.URL, APIKey: "secret"})
	require.NoError(t, err)
	ch, err := o.Stream(context.Background(), Request{Model: "qwen3", Messages: []Message{{Role: RoleUser, Content: "hi"}}})
	require.NoError(t, err)

	var done *Chunk
	for c := range ch {
		if c.Done {
			d := c
			done = &d
		}
	}
	require.NotNil(t, done)
	assert.Equal(t, 11, done.InputTokens)
	assert.Equal(t, 18, done.OutputTokens)

	assert.Equal(t, "/api/chat", gotPath)
	assert.Equal(t, "Bearer secret", gotAuth)
	assert.Equal(t, "application/x-ndjson", gotAccept)
}

func TestOllamaStreamNoAuthWhenKeyEmpty(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/x-ndjson")
		_, _ = w.Write([]byte(`{"message":{"role":"assistant","content":"hi"},"done":true}` + "\n"))
	}))
	defer srv.Close()

	o, err := NewOllama(OllamaConfig{BaseURL: srv.URL}) // no API key
	require.NoError(t, err)
	ch, err := o.Stream(context.Background(), Request{Model: "qwen3", Messages: []Message{{Role: RoleUser, Content: "hi"}}})
	require.NoError(t, err)
	for range ch {
	}
	assert.Empty(t, gotAuth, "local ollama must not send Authorization header")
}

func TestOllamaReadStreamDeltas(t *testing.T) {
	ndjson := strings.Join([]string{
		`{"message":{"role":"assistant","thinking":"reasoning..."},"done":false}`,
		`{"message":{"role":"assistant","content":"Hello"},"done":false}`,
		`{"message":{"role":"assistant","tool_calls":[{"function":{"name":"get_time","arguments":{}}}]},"done":false}`,
		`{"message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":5,"eval_count":3}`,
	}, "\n")

	o, _ := NewOllama(OllamaConfig{})
	ch := make(chan Chunk, 16)
	o.readStream(context.Background(), strings.NewReader(ndjson), ch)
	close(ch)

	var reasoning, text, doneCount int
	var calls []ToolCall
	var done *Chunk
	for c := range ch {
		if c.ReasoningDelta != "" {
			reasoning++
		}
		if c.TextDelta != "" {
			text++
		}
		if len(c.ToolCalls) > 0 {
			calls = append(calls, c.ToolCalls...)
		}
		if c.Done {
			d := c
			done = &d
			doneCount++
		}
	}
	assert.Equal(t, 1, reasoning)
	assert.Equal(t, 1, text)
	require.Len(t, calls, 1)
	assert.Equal(t, "get_time", calls[0].Name)
	assert.NotEmpty(t, calls[0].ID, "ollama tool calls need a synthetic id")
	assert.JSONEq(t, `{}`, string(calls[0].Arguments))
	require.NotNil(t, done)
	assert.Equal(t, 5, done.InputTokens)
	assert.Equal(t, 3, done.OutputTokens)
	assert.Equal(t, 1, doneCount, "exactly one done chunk")
}

func TestOllamaReadStreamToolCallArgumentsAsString(t *testing.T) {
	// Some Ollama builds return arguments as a JSON object; ensure we keep it raw.
	ndjson := `{"message":{"role":"assistant","tool_calls":[{"function":{"name":"f","arguments":{"x":1}}}]},"done":false}` + "\n" +
		`{"message":{"role":"assistant","content":""},"done":true}` + "\n"
	o, _ := NewOllama(OllamaConfig{})
	ch := make(chan Chunk, 16)
	o.readStream(context.Background(), strings.NewReader(ndjson), ch)
	close(ch)
	var calls []ToolCall
	for c := range ch {
		calls = append(calls, c.ToolCalls...)
	}
	require.Len(t, calls, 1)
	assert.JSONEq(t, `{"x":1}`, string(calls[0].Arguments))
}

func TestOllamaListModels(t *testing.T) {
	var gotPath, gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"models":[{"name":"llama3.1","details":{"families":["llama"]}},{"name":"llava","details":{"families":["clip","llama"]}}]}`))
	}))
	defer srv.Close()

	o, err := NewOllama(OllamaConfig{BaseURL: srv.URL, APIKey: "k"})
	require.NoError(t, err)
	models, err := o.ListModels(context.Background())
	require.NoError(t, err)
	require.Len(t, models, 2)
	assert.Equal(t, "llama3.1", models[0].ID)
	assert.False(t, models[0].Vision)
	assert.Equal(t, "llava", models[1].ID)
	assert.True(t, models[1].Vision, "clip family => vision")
	assert.Equal(t, "/api/tags", gotPath)
	assert.Equal(t, "Bearer k", gotAuth)
}

func TestOllamaCapabilities(t *testing.T) {
	o, _ := NewOllama(OllamaConfig{Vision: true, Thinking: &ThinkingConfig{Type: "enabled"}})
	caps := o.Capabilities()
	assert.True(t, caps.Vision)
	assert.True(t, caps.Reasoning)

	o2, _ := NewOllama(OllamaConfig{Thinking: &ThinkingConfig{Type: "disabled"}})
	assert.False(t, o2.Capabilities().Reasoning)
}

func TestOllamaConvertMessagesWithToolHistory(t *testing.T) {
	msgs := convertOllamaMessages([]Message{
		{Role: RoleUser, Content: "time?"},
		{Role: RoleAssistant, ToolCalls: []ToolCall{{ID: "1", Name: "get_time", Arguments: json.RawMessage(`{}`)}}},
		{Role: RoleTool, Content: "12:00"},
	})
	require.Len(t, msgs, 3)
	assert.Equal(t, "tool", msgs[2].Role)
	assert.Equal(t, "12:00", msgs[2].Content)
	require.Len(t, msgs[1].ToolCalls, 1)
	assert.Equal(t, "get_time", msgs[1].ToolCalls[0].Function.Name)
	assert.JSONEq(t, `{}`, string(msgs[1].ToolCalls[0].Function.Arguments))
}
