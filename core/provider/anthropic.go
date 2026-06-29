package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const (
	defaultAnthropicBaseURL = "https://api.anthropic.com"
	defaultAnthropicVersion = "2023-06-01"
)

// AnthropicConfig configures an Anthropic Messages API provider.
type AnthropicConfig struct {
	APIKey     string
	BaseURL    string
	APIVersion string
	Client     *http.Client
}

// Anthropic implements Provider using Anthropic Messages API.
type Anthropic struct {
	apiKey     string
	baseURL    string
	apiVersion string
	client     *http.Client
}

// NewAnthropic creates an Anthropic provider.
func NewAnthropic(cfg AnthropicConfig) (*Anthropic, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("anthropic api key is required")
	}
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = defaultAnthropicBaseURL
	}
	apiVersion := cfg.APIVersion
	if apiVersion == "" {
		apiVersion = defaultAnthropicVersion
	}
	client := cfg.Client
	if client == nil {
		client = DefaultHTTPClient()
	}
	return &Anthropic{
		apiKey:     cfg.APIKey,
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiVersion: apiVersion,
		client:     client,
	}, nil
}

type anthropicRequest struct {
	Model     string              `json:"model"`
	System    string              `json:"system,omitempty"`
	Messages  []anthropicMessage  `json:"messages"`
	Tools     []anthropicTool     `json:"tools,omitempty"`
	MaxTokens int                 `json:"max_tokens"`
	Stream    bool                `json:"stream"`
}

type anthropicMessage struct {
	Role    string           `json:"role"`
	Content []anthropicBlock `json:"content"`
}

type anthropicBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	ID        string          `json:"id,omitempty"`
	Name      string          `json:"name,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	ToolUseID string          `json:"tool_use_id,omitempty"`
	Content   string          `json:"content,omitempty"`
}

type anthropicTool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"input_schema"`
}

type anthropicStreamEvent struct {
	Type         string `json:"type"`
	Index        int    `json:"index"`
	ContentBlock struct {
		Type string `json:"type"`
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"content_block"`
	Delta struct {
		Type         string `json:"type"`
		Text         string `json:"text"`
		PartialJSON  string `json:"partial_json"`
		StopReason   string `json:"stop_reason"`
	} `json:"delta"`
	Usage *anthropicUsage `json:"usage,omitempty"`
}

type anthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// Stream implements Provider.
func (a *Anthropic) Stream(ctx context.Context, req Request) (<-chan Chunk, error) {
	body, err := json.Marshal(a.buildRequest(req))
	if err != nil {
		return nil, fmt.Errorf("marshal anthropic request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create anthropic request: %w", err)
	}
	httpReq.Header.Set("x-api-key", a.apiKey)
	httpReq.Header.Set("anthropic-version", a.apiVersion)
	httpReq.Header.Set("Content-Type", "application/json")

	return StreamHTTP(ctx, a.client, httpReq, a.readStream)
}

func (a *Anthropic) buildRequest(req Request) anthropicRequest {
	system, messages := convertMessages(req.Messages)
	tools := make([]anthropicTool, 0, len(req.Tools))
	for _, t := range req.Tools {
		tools = append(tools, anthropicTool{
			Name:        t.Name,
			Description: t.Description,
			InputSchema: t.Parameters,
		})
	}
	maxTokens := req.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 4096
	}
	return anthropicRequest{
		Model:     req.Model,
		System:    system,
		Messages:  messages,
		Tools:     tools,
		MaxTokens: maxTokens,
		Stream:    true,
	}
}

func buildAssistantMessage(m Message) anthropicMessage {
	blocks := make([]anthropicBlock, 0, len(m.ToolCalls)+1)
	if m.Content != "" {
		blocks = append(blocks, anthropicBlock{Type: "text", Text: m.Content})
	}
	for _, tc := range m.ToolCalls {
		input := json.RawMessage("{}")
		if len(tc.Arguments) > 0 {
			input = tc.Arguments
		}
		blocks = append(blocks, anthropicBlock{
			Type:  "tool_use",
			ID:    tc.ID,
			Name:  tc.Name,
			Input: input,
		})
	}
	return anthropicMessage{Role: "assistant", Content: blocks}
}

// appendToolResult appends a tool result message, merging consecutive tool results.
func appendToolResult(out []anthropicMessage, m Message) []anthropicMessage {
	// Anthropic requires all tool_result blocks for a single
	// assistant message to be in ONE user message.
	if len(out) > 0 && out[len(out)-1].Role == "user" {
		last := &out[len(out)-1]
		if len(last.Content) > 0 && last.Content[0].Type == "tool_result" {
			last.Content = append(last.Content, anthropicBlock{
				Type: "tool_result", ToolUseID: m.ToolCallID, Content: m.Content,
			})
			return out
		}
	}
	return append(out, anthropicMessage{
		Role: "user",
		Content: []anthropicBlock{{
			Type: "tool_result", ToolUseID: m.ToolCallID, Content: m.Content,
		}},
	})
}

func convertMessages(msgs []Message) (string, []anthropicMessage) {
	var system string
	out := make([]anthropicMessage, 0, len(msgs))

	for _, m := range msgs {
		switch m.Role {
		case RoleSystem:
			system = m.Content
		case RoleUser:
			out = append(out, anthropicMessage{
				Role: "user",
				Content: []anthropicBlock{{
					Type: "text",
					Text: m.Content,
				}},
			})
		case RoleAssistant:
			out = append(out, buildAssistantMessage(m))
		case RoleTool:
			out = appendToolResult(out, m)
		}
	}
	return system, out
}

func (a *Anthropic) readStream(ctx context.Context, r io.Reader, ch chan<- Chunk) {
	scanner := NewSSEScanner(r)

	toolAcc := map[int]*ToolCall{}
	lastToolIdx := -1
	var inputTokens, outputTokens int

	flushLastTool := func() {
		if lastToolIdx < 0 {
			return
		}
		tc := toolAcc[lastToolIdx]
		if tc == nil || len(tc.Arguments) == 0 {
			return
		}
		select {
		case <-ctx.Done():
		case ch <- Chunk{ToolCalls: []ToolCall{*tc}}:
		}
	}

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := scanner.Text()
		data, ok := ParseSSELine(line)
		if !ok {
			continue
		}

		var ev anthropicStreamEvent
		if err := json.Unmarshal([]byte(data), &ev); err != nil {
			continue
		}

		sec := StreamEventContext{Ctx: ctx, Ch: ch, ToolAcc: toolAcc, LastToolIdx: &lastToolIdx, FlushLastTool: flushLastTool, InputTokens: inputTokens, OutputTokens: outputTokens}
		done, tokens := a.processStreamEvent(sec, ev)
		if tokens != nil {
			inputTokens, outputTokens = tokens.InputTokens, tokens.OutputTokens
		}
		if done {
			return
		}
	}
	flushLastTool()
}

// StreamEventContext holds state for processing Anthropic SSE events.
type StreamEventContext struct {
	Ctx           context.Context
	Ch            chan<- Chunk
	ToolAcc       map[int]*ToolCall
	LastToolIdx   *int
	FlushLastTool func()
	InputTokens   int
	OutputTokens  int
}

// processStreamEvent processes a single Anthropic SSE event. Returns (finished, tokenUpdate).
func (a *Anthropic) processStreamEvent(sec StreamEventContext, ev anthropicStreamEvent) (bool, *Chunk) {
	switch ev.Type {
	case "message_start":
		if ev.Usage != nil {
			sec.InputTokens = ev.Usage.InputTokens
		}
	case "content_block_start":
		sec.FlushLastTool()
		*sec.LastToolIdx = -1
		if ev.ContentBlock.Type == "tool_use" {
			sec.ToolAcc[ev.Index] = &ToolCall{ID: ev.ContentBlock.ID, Name: ev.ContentBlock.Name}
			*sec.LastToolIdx = ev.Index
		}
	case "content_block_delta":
		if done := handleContentBlockDelta(sec, ev); done {
			return true, nil
		}
	case "message_delta":
		if ev.Usage != nil {
			sec.OutputTokens = ev.Usage.OutputTokens
		}
		sec.FlushLastTool()
		*sec.LastToolIdx = -1
		if ev.Delta.StopReason == "end_turn" {
			sendChunk(sec.Ctx, sec.Ch, Chunk{Done: true, InputTokens: sec.InputTokens, OutputTokens: sec.OutputTokens})
			return true, nil
		}
	case "message_stop":
		sec.FlushLastTool()
		sendChunk(sec.Ctx, sec.Ch, Chunk{Done: true, InputTokens: sec.InputTokens, OutputTokens: sec.OutputTokens})
		return true, nil
	}
	return false, &Chunk{InputTokens: sec.InputTokens, OutputTokens: sec.OutputTokens}
}

func handleContentBlockDelta(sec StreamEventContext, ev anthropicStreamEvent) bool {
	switch ev.Delta.Type {
	case "text_delta":
		if ev.Delta.Text != "" {
			select {
			case <-sec.Ctx.Done():
				return true
			case sec.Ch <- Chunk{TextDelta: ev.Delta.Text}:
			}
		}
	case "input_json_delta":
		if acc := sec.ToolAcc[ev.Index]; acc != nil {
			acc.Arguments = append(acc.Arguments, []byte(ev.Delta.PartialJSON)...)
		}
	}
	return false
}

// sendChunk delegates to the shared SendChunk.
func sendChunk(ctx context.Context, ch chan<- Chunk, c Chunk) {
	SendChunk(ctx, ch, c)
}
