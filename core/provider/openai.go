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

const defaultOpenAIBaseURL = "https://api.openai.com/v1"

// OpenAIConfig configures an OpenAI-compatible provider.
type OpenAIConfig struct {
	APIKey   string
	BaseURL  string
	Client   *http.Client
	Thinking *ThinkingConfig
}

// OpenAI implements Provider against OpenAI-compatible chat completions APIs.
type OpenAI struct {
	apiKey   string
	baseURL  string
	client   *http.Client
	thinking *ThinkingConfig
}

// NewOpenAI creates an OpenAI-compatible provider.
func NewOpenAI(cfg OpenAIConfig) (*OpenAI, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("openai api key is required")
	}
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = defaultOpenAIBaseURL
	}
	client := cfg.Client
	if client == nil {
		client = DefaultHTTPClient()
	}
	return &OpenAI{apiKey: cfg.APIKey, baseURL: strings.TrimRight(baseURL, "/"), client: client, thinking: cfg.Thinking}, nil
}

type openAIThinking struct {
	Type string  `json:"type"`
	Keep *string `json:"keep,omitempty"`
}

type openAIStreamOptions struct {
	IncludeUsage bool `json:"include_usage"`
}

type openAIRequest struct {
	Model         string              `json:"model"`
	Messages      []openAIMessage     `json:"messages"`
	Tools         []openAITool        `json:"tools,omitempty"`
	Stream        bool                `json:"stream"`
	StreamOptions *openAIStreamOptions `json:"stream_options,omitempty"`
	MaxTokens     int                 `json:"max_tokens,omitempty"`
	Thinking      *openAIThinking     `json:"thinking,omitempty"`
}

type openAIMessage struct {
	Role             string           `json:"role"`
	Content          string           `json:"content,omitempty"`
	ReasoningContent string           `json:"reasoning_content,omitempty"`
	ToolCalls        []openAIToolCall `json:"tool_calls,omitempty"`
	ToolCallID       string           `json:"tool_call_id,omitempty"`
	Name             string           `json:"name,omitempty"`
}

type openAITool struct {
	Type     string         `json:"type"`
	Function openAIFunction `json:"function"`
}

type openAIFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

type openAIToolCall struct {
	Index    int                `json:"index"`
	ID       string             `json:"id"`
	Type     string             `json:"type"`
	Function openAIFunctionCall `json:"function"`
}

type openAIFunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type openAIStreamResponse struct {
	Choices []struct {
		Delta struct {
			Content          string           `json:"content"`
			ReasoningContent string           `json:"reasoning_content"`
			ToolCalls        []openAIToolCall `json:"tool_calls"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
	Usage *openAIUsage `json:"usage,omitempty"`
}

type openAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
}

// Stream implements Provider.
func (o *OpenAI) Stream(ctx context.Context, req Request) (<-chan Chunk, error) {
	body, err := json.Marshal(o.buildRequest(req))
	if err != nil {
		return nil, fmt.Errorf("marshal openai request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, o.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create openai request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+o.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	return StreamHTTP(ctx, o.client, httpReq, o.readStream)
}

func convertOpenAIMessages(msgs []Message) []openAIMessage {
	result := make([]openAIMessage, 0, len(msgs))
	for _, m := range msgs {
		msg := openAIMessage{
			Role:             string(m.Role),
			Content:          m.Content,
			ReasoningContent: m.ReasoningContent,
			ToolCallID:       m.ToolCallID,
			Name:             m.Name,
		}
		if len(m.ToolCalls) > 0 {
			msg.ToolCalls = make([]openAIToolCall, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				msg.ToolCalls = append(msg.ToolCalls, openAIToolCall{
					ID:   tc.ID,
					Type: "function",
					Function: openAIFunctionCall{
						Name:      tc.Name,
						Arguments: string(tc.Arguments),
					},
				})
			}
		}
		result = append(result, msg)
	}
	return result
}

func convertTools(tools []ToolDefinition) []openAITool {
	result := make([]openAITool, 0, len(tools))
	for _, t := range tools {
		result = append(result, openAITool{
			Type: "function",
			Function: openAIFunction{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			},
		})
	}
	return result
}

func (o *OpenAI) buildRequest(req Request) openAIRequest {
	maxTokens := req.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 4096
	}
	out := openAIRequest{
		Model:         req.Model,
		Messages:      convertOpenAIMessages(req.Messages),
		Tools:         convertTools(req.Tools),
		Stream:        true,
		StreamOptions: &openAIStreamOptions{IncludeUsage: true},
		MaxTokens:     maxTokens,
	}
	if o.thinking != nil && o.thinking.Type != "" {
		th := openAIThinking{Type: o.thinking.Type}
		if o.thinking.Keep != "" {
			keep := o.thinking.Keep
			th.Keep = &keep
		}
		out.Thinking = &th
	}
	return out
}

func flushToolCalls(toolAcc map[int]*ToolCall, ch chan<- Chunk, ctx context.Context) {
	if len(toolAcc) == 0 {
		return
	}
	calls := make([]ToolCall, 0, len(toolAcc))
	for i := 0; i < len(toolAcc); i++ {
		if acc, ok := toolAcc[i]; ok {
			calls = append(calls, *acc)
		}
	}
	if len(calls) > 0 {
		select {
		case <-ctx.Done():
		case ch <- Chunk{ToolCalls: calls}:
		}
	}
}

func (o *OpenAI) readStream(ctx context.Context, r io.Reader, ch chan<- Chunk) {
	scanner := NewSSEScanner(r)

	toolAcc := map[int]*ToolCall{}
	var lastUsage *openAIUsage

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
		if data == "[DONE]" {
			doneChunk := Chunk{Done: true}
			if lastUsage != nil {
				doneChunk.InputTokens = lastUsage.PromptTokens
				doneChunk.OutputTokens = lastUsage.CompletionTokens
			}
			ch <- doneChunk
			return
		}

		var stream openAIStreamResponse
		if err := json.Unmarshal([]byte(data), &stream); err != nil {
			continue
		}
		if stream.Usage != nil {
			lastUsage = stream.Usage
		}
		if len(stream.Choices) == 0 {
			continue
		}

		choice := stream.Choices[0]
		emitChoiceDeltas(ctx, ch, choice)
		accumulateToolCalls(toolAcc, choice.Delta.ToolCalls)

		if choice.FinishReason != nil {
			switch *choice.FinishReason {
			case "tool_calls":
				flushToolCalls(toolAcc, ch, ctx)
				toolAcc = map[int]*ToolCall{}
			case "stop":
				flushToolCalls(toolAcc, ch, ctx)
				ch <- Chunk{Done: true}
				return
			}
		}
	}
	flushToolCalls(toolAcc, ch, ctx)
}

// openAIStreamChoice represents a single choice in an OpenAI stream response.
type openAIStreamChoice = struct {
	Delta struct {
		Content          string          `json:"content"`
		ReasoningContent string          `json:"reasoning_content"`
		ToolCalls        []openAIToolCall `json:"tool_calls"`
	} `json:"delta"`
	FinishReason *string `json:"finish_reason"`
}

// emitChoiceDeltas sends reasoning and text deltas from a choice to the channel.
func emitChoiceDeltas(ctx context.Context, ch chan<- Chunk, choice openAIStreamChoice) {
	if choice.Delta.ReasoningContent != "" {
		select {
		case <-ctx.Done():
			return
		case ch <- Chunk{ReasoningDelta: choice.Delta.ReasoningContent}:
		}
	}
	if choice.Delta.Content != "" {
		select {
		case <-ctx.Done():
			return
		case ch <- Chunk{TextDelta: choice.Delta.Content}:
		}
	}
}

// accumulateToolCalls merges incremental tool call deltas into the accumulator.
func accumulateToolCalls(toolAcc map[int]*ToolCall, calls []openAIToolCall) {
	for _, tc := range calls {
		acc, ok := toolAcc[tc.Index]
		if !ok {
			acc = &ToolCall{}
			toolAcc[tc.Index] = acc
		}
		if tc.ID != "" {
			acc.ID = tc.ID
		}
		if tc.Function.Name != "" {
			acc.Name = tc.Function.Name
		}
		if tc.Function.Arguments != "" {
			acc.Arguments = append(acc.Arguments, []byte(tc.Function.Arguments)...)
		}
	}
}
