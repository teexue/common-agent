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
	AuthStyle  AuthStyle
	Client     *http.Client
	ModelsPath string
	Vision     bool
}

// Anthropic implements Provider using Anthropic Messages API.
type Anthropic struct {
	apiKey     string
	baseURL    string
	apiVersion string
	authStyle  AuthStyle
	client     *http.Client
	modelsPath string
	vision     bool
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
	authStyle := cfg.AuthStyle
	if authStyle == "" {
		authStyle = AuthXAPIKey
	}
	modelsPath := cfg.ModelsPath
	if modelsPath == "" {
		modelsPath = APIStyleAnthropicModelsPath
	}
	client := cfg.Client
	if client == nil {
		client = DefaultHTTPClient()
	}
	return &Anthropic{
		apiKey:     cfg.APIKey,
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiVersion: apiVersion,
		authStyle:  authStyle,
		client:     client,
		modelsPath: modelsPath,
		vision:     cfg.Vision,
	}, nil
}

// setAuthHeaders applies the configured auth header to a request.
func (a *Anthropic) setAuthHeaders(req *http.Request) {
	if a.authStyle == AuthBearer {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	} else {
		req.Header.Set("x-api-key", a.apiKey)
	}
}

// Capabilities advertises this provider's optional features.
func (a *Anthropic) Capabilities() Capabilities {
	return Capabilities{Vision: a.vision}
}

// anthropicModelsResponse is the shape of GET /v1/models from the Anthropic API.
type anthropicModelsResponse struct {
	Data []catalogModelRow `json:"data"`
}

// ListModels fetches available models from the vendor's model-list endpoint.
func (a *Anthropic) ListModels(ctx context.Context) ([]ModelInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.baseURL+a.modelsPath, nil)
	if err != nil {
		return nil, fmt.Errorf("create anthropic models request: %w", err)
	}
	a.setAuthHeaders(req)
	req.Header.Set("anthropic-version", a.apiVersion)
	req.Header.Set("Accept", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anthropic models request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("anthropic models request failed: status %d: %s", resp.StatusCode, string(body))
	}

	var out anthropicModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode anthropic models: %w", err)
	}
	models := make([]ModelInfo, 0, len(out.Data))
	for _, m := range out.Data {
		models = append(models, m.toModelInfo())
	}
	return models, nil
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	System    string             `json:"system,omitempty"`
	Messages  []anthropicMessage `json:"messages"`
	Tools     []anthropicTool    `json:"tools,omitempty"`
	MaxTokens int                `json:"max_tokens"`
	Stream    bool               `json:"stream"`
}

type anthropicMessage struct {
	Role    string           `json:"role"`
	Content []anthropicBlock `json:"content"`
}

type anthropicBlock struct {
	Type      string           `json:"type"`
	Text      string           `json:"text,omitempty"`
	ID        string           `json:"id,omitempty"`
	Name      string           `json:"name,omitempty"`
	Input     json.RawMessage  `json:"input,omitempty"`
	ToolUseID string           `json:"tool_use_id,omitempty"`
	Content   string           `json:"content,omitempty"`
	Source    *anthropicSource `json:"source,omitempty"` // for type="image"
}

type anthropicSource struct {
	Type      string `json:"type"`       // "base64"
	MediaType string `json:"media_type"` // "image/png", "image/jpeg", etc.
	Data      string `json:"data"`       // base64-encoded image data
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
		// Some Anthropic-compatible vendors (e.g. DeepSeek) send the complete
		// tool input here instead of streaming input_json_delta events.
		Input json.RawMessage `json:"input,omitempty"`
	} `json:"content_block"`
	Delta struct {
		Type        string `json:"type"`
		Text        string `json:"text"`
		Thinking    string `json:"thinking"`
		PartialJSON string `json:"partial_json"`
		StopReason  string `json:"stop_reason"`
	} `json:"delta"`
	Usage *anthropicUsage `json:"usage,omitempty"`
	// message_start nests usage under "message" per the Anthropic spec.
	Message struct {
		Usage *anthropicUsage `json:"usage,omitempty"`
	} `json:"message,omitempty"`
}

type anthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
	// Prompt caching usage (Anthropic Messages API): tokens read from cache
	// and tokens written into cache for this request.
	CacheReadInputTokens     int `json:"cache_read_input_tokens,omitempty"`
	CacheCreationInputTokens int `json:"cache_creation_input_tokens,omitempty"`
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
	a.setAuthHeaders(httpReq)
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
	maxTokens := EffectiveMaxOutput(req.Model, req.MaxTokens)
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
	var systemParts []string
	out := make([]anthropicMessage, 0, len(msgs))

	for _, m := range msgs {
		switch m.Role {
		case RoleSystem:
			systemParts = append(systemParts, m.Content)
		case RoleUser:
			if len(m.ContentParts) > 0 {
				blocks := make([]anthropicBlock, 0, len(m.ContentParts))
				for _, p := range m.ContentParts {
					if p.Type == "text" {
						blocks = append(blocks, anthropicBlock{Type: "text", Text: p.Text})
					} else if p.Type == "image_url" && p.ImageURL != nil {
						mediaType, data := parseDataURI(p.ImageURL.URL)
						blocks = append(blocks, anthropicBlock{
							Type: "image",
							Source: &anthropicSource{
								Type:      "base64",
								MediaType: mediaType,
								Data:      data,
							},
						})
					}
				}
				out = append(out, anthropicMessage{Role: "user", Content: blocks})
			} else {
				out = append(out, anthropicMessage{
					Role: "user",
					Content: []anthropicBlock{{
						Type: "text",
						Text: m.Content,
					}},
				})
			}
		case RoleAssistant:
			out = append(out, buildAssistantMessage(m))
		case RoleTool:
			out = appendToolResult(out, m)
		}
	}
	return strings.Join(systemParts, "\n\n"), out
}

// parseDataURI extracts media type and base64 data from a data URI.
// Returns ("image/png", "base64data") for "data:image/png;base64,abc..."
// Falls back to ("image/png", url) if not a data URI.
func parseDataURI(url string) (string, string) {
	if strings.HasPrefix(url, "data:") {
		// data:image/png;base64,abc...
		parts := strings.SplitN(url, ",", 2)
		if len(parts) == 2 {
			header := parts[0] // data:image/png;base64
			data := parts[1]
			mediaType := strings.TrimPrefix(strings.SplitN(header, ";", 2)[0], "data:")
			return mediaType, data
		}
	}
	return "image/png", url
}
