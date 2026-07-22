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

// ContentPart represents a multimodal content block (text or image).
type ContentPart struct {
	Type     string `json:"type"`                // "text" | "image_url"
	Text     string `json:"text,omitempty"`      // for type="text"
	ImageURL *ImageURL `json:"image_url,omitempty"` // for type="image_url"
}

// ImageURL holds an image reference (data URL or HTTP URL).
type ImageURL struct {
	URL    string `json:"url"`
	Detail string `json:"detail,omitempty"` // "low" | "high" | "auto"
}

// Message is a conversation turn.
type Message struct {
	Role              Role          `json:"role"`
	Content           string        `json:"content,omitempty"`
	ContentParts      []ContentPart `json:"content_parts,omitempty"` // multimodal; when set, takes precedence over Content
	ReasoningContent  string        `json:"reasoning_content,omitempty"`
	ToolCalls         []ToolCall    `json:"tool_calls,omitempty"`
	ToolCallID        string        `json:"tool_call_id,omitempty"`
	Name              string        `json:"name,omitempty"`
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

	// Usage is populated on the final chunk when the provider reports token counts.
	InputTokens  int `json:"input_tokens,omitempty"`
	OutputTokens int `json:"output_tokens,omitempty"`
}

// ThinkingConfig controls Kimi-style reasoning mode (OpenAI-compatible extensions).
type ThinkingConfig struct {
	Type string `yaml:"type"` // enabled | disabled
	Keep string `yaml:"keep"` // all (optional, for multi-turn tool loops)
}

// APIStyle identifies the wire protocol family used to talk to a vendor.
// Most regional vendors are OpenAI-compatible; a few follow the Anthropic
// Messages API. Some gateways support both, letting the user choose.
type APIStyle string

const (
	// StyleOpenAI selects the OpenAI-compatible chat completions protocol.
	StyleOpenAI APIStyle = "openai"
	// StyleAnthropic selects the Anthropic Messages API protocol.
	StyleAnthropic APIStyle = "anthropic"
)

// AuthStyle identifies how the API key is sent on the wire.
// Anthropic's native API uses x-api-key; some Anthropic-compatible vendors
// (e.g. Moonshot) require Authorization: Bearer instead.
type AuthStyle string

const (
	// AuthXAPIKey sends the key via the x-api-key header (Anthropic default).
	AuthXAPIKey AuthStyle = "x-api-key"
	// AuthBearer sends the key via Authorization: Bearer.
	AuthBearer AuthStyle = "bearer"
)

// ModelInfo describes a model offered by a vendor's model-list endpoint.
type ModelInfo struct {
	ID            string `json:"id"`
	Vision        bool   `json:"vision,omitempty"`
	ContextWindow int    `json:"context_window,omitempty"`
}

// Capabilities advertises optional features of a provider implementation.
type Capabilities struct {
	Vision    bool `json:"vision"`
	Reasoning bool `json:"reasoning"`
}

// ModelLister lists models available to a provider (requires a valid API key).
type ModelLister interface {
	ListModels(ctx context.Context) ([]ModelInfo, error)
}

// Capabler exposes a provider's advertised capabilities.
type Capabler interface {
	Capabilities() Capabilities
}

// Provider streams LLM responses.
type Provider interface {
	Stream(ctx context.Context, req Request) (<-chan Chunk, error)
}

// DefaultMaxTokens is the fallback when agent configuration omits max_tokens.
const DefaultMaxTokens = 4096

// DefaultHTTPClient returns an *http.Client with a sensible timeout.
func DefaultHTTPClient() *http.Client {
	return &http.Client{Timeout: 120 * time.Second}
}
