package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// Role identifies a message author.
type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

// ToolCall is a model-requested tool invocation.
type ToolCall struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// Message is a conversation turn.
type Message struct {
	Role              Role       `json:"role"`
	Content           string     `json:"content,omitempty"`
	ReasoningContent  string     `json:"reasoning_content,omitempty"`
	ToolCalls         []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID        string     `json:"tool_call_id,omitempty"`
	Name              string     `json:"name,omitempty"`
}

// ToolDefinition describes a tool for the LLM.
type ToolDefinition struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

// Request is sent to an LLM provider.
type Request struct {
	Model     string
	Messages  []Message
	Tools     []ToolDefinition
	MaxTokens int
}

// Chunk is a streaming response fragment.
// Tool calls in a Chunk are ready to execute immediately.
type Chunk struct {
	TextDelta      string
	ReasoningDelta string
	ToolCalls      []ToolCall
	Done           bool
}

// ThinkingConfig controls Kimi-style reasoning mode (OpenAI-compatible extensions).
type ThinkingConfig struct {
	Type string `yaml:"type"` // enabled | disabled
	Keep string `yaml:"keep"` // all (optional, for multi-turn tool loops)
}

// Provider streams LLM responses.
type Provider interface {
	Stream(ctx context.Context, req Request) (<-chan Chunk, error)
}

// DefaultHTTPClient returns an *http.Client with a sensible timeout.
func DefaultHTTPClient() *http.Client {
	return &http.Client{Timeout: 120 * time.Second}
}
