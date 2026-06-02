package provider

import (
	"bufio"
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

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("anthropic request: %w", err)
	}
	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("anthropic status %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}

	ch := make(chan Chunk)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		a.readStream(ctx, resp.Body, ch)
	}()
	return ch, nil
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
			out = append(out, anthropicMessage{Role: "assistant", Content: blocks})
		case RoleTool:
			out = append(out, anthropicMessage{
				Role: "user",
				Content: []anthropicBlock{{
					Type:      "tool_result",
					ToolUseID: m.ToolCallID,
					Content:   m.Content,
				}},
			})
		}
	}
	return system, out
}

func (a *Anthropic) readStream(ctx context.Context, r io.Reader, ch chan<- Chunk) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)

	toolAcc := map[int]*ToolCall{}
	lastToolIdx := -1

	// flushLastTool emits the tool call at lastToolIdx if it has arguments.
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
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		var ev anthropicStreamEvent
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &ev); err != nil {
			continue
		}

		switch ev.Type {
		case "content_block_start":
			// A new content block means the previous one (if it was a tool_use) is complete.
			flushLastTool()
			lastToolIdx = -1
			if ev.ContentBlock.Type == "tool_use" {
				toolAcc[ev.Index] = &ToolCall{
					ID:   ev.ContentBlock.ID,
					Name: ev.ContentBlock.Name,
				}
				lastToolIdx = ev.Index
			}
		case "content_block_delta":
			switch ev.Delta.Type {
			case "text_delta":
				if ev.Delta.Text != "" {
					select {
					case <-ctx.Done():
						return
					case ch <- Chunk{TextDelta: ev.Delta.Text}:
					}
				}
			case "input_json_delta":
				acc := toolAcc[ev.Index]
				if acc != nil {
					acc.Arguments = append(acc.Arguments, []byte(ev.Delta.PartialJSON)...)
				}
			}
		case "message_delta":
			// Flush the last tool call before handling stop reason.
			flushLastTool()
			lastToolIdx = -1
			if ev.Delta.StopReason == "tool_use" {
				// Already flushed above.
			}
			if ev.Delta.StopReason == "end_turn" {
				select {
				case <-ctx.Done():
					return
				case ch <- Chunk{Done: true}:
				}
				return
			}
		case "message_stop":
			flushLastTool()
			select {
			case <-ctx.Done():
				return
			case ch <- Chunk{Done: true}:
			}
			return
		}
	}
	flushLastTool()
}
