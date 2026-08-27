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
	"sync/atomic"
)

const (
	defaultOllamaBaseURL = "http://localhost:11434"
	ollamaModelsPath     = "/api/tags"
	ollamaChatPath       = "/api/chat"
)

// OllamaConfig configures a native Ollama provider (local or cloud).
type OllamaConfig struct {
	// APIKey is the Bearer token for Ollama Cloud. Empty for local Ollama
	// (no authentication is sent).
	APIKey string
	// BaseURL is the Ollama host root, e.g. http://localhost:11434 or
	// https://ollama.com. Trailing slashes are trimmed.
	BaseURL string
	// Client is the HTTP client. Defaults to DefaultHTTPClient when nil.
	Client *http.Client
	// Thinking maps to the Ollama `think` request field. Type may be
	// "enabled"/"disabled" (bool) or one of "high"/"medium"/"low"/"max"
	// (level string). nil lets the model decide.
	Thinking *ThinkingConfig
	// ModelsPath is the model-list path (default /api/tags).
	ModelsPath string
	// Vision advertises multimodal image support.
	Vision bool
	// KeepAlive is the Ollama model keep-alive duration (e.g. "5m", "0").
	// Empty omits the field (server default applies).
	KeepAlive string
}

// Ollama implements Provider against the native Ollama /api/chat protocol.
// It speaks NDJSON streaming (not SSE), supports the native `think` field,
// inline base64 `images`, `options.num_predict`, and `keep_alive`.
type Ollama struct {
	apiKey     string
	baseURL    string
	client     *http.Client
	thinking   *ThinkingConfig
	modelsPath string
	vision     bool
	keepAlive  string
}

// NewOllama creates a native Ollama provider. APIKey may be empty for local use.
func NewOllama(cfg OllamaConfig) (*Ollama, error) {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = defaultOllamaBaseURL
	}
	modelsPath := cfg.ModelsPath
	if modelsPath == "" {
		modelsPath = ollamaModelsPath
	}
	client := cfg.Client
	if client == nil {
		client = DefaultHTTPClient()
	}
	return &Ollama{
		apiKey: cfg.APIKey, baseURL: strings.TrimRight(baseURL, "/"),
		client: client, thinking: cfg.Thinking,
		modelsPath: modelsPath, vision: cfg.Vision, keepAlive: cfg.KeepAlive,
	}, nil
}

// Capabilities advertises this provider's optional features.
func (o *Ollama) Capabilities() Capabilities {
	return Capabilities{
		Vision:    o.vision,
		Reasoning: o.thinking != nil && o.thinking.Type != "" && o.thinking.Type != "disabled",
	}
}

// ollamaRequest is the body of POST /api/chat.
type ollamaRequest struct {
	Model     string          `json:"model"`
	Messages  []ollamaMessage `json:"messages"`
	Tools     []ollamaTool    `json:"tools,omitempty"`
	Stream    bool            `json:"stream"`
	Think     any             `json:"think,omitempty"`
	Options   *ollamaOptions  `json:"options,omitempty"`
	KeepAlive string          `json:"keep_alive,omitempty"`
}

type ollamaOptions struct {
	NumPredict  int     `json:"num_predict,omitempty"`
	Temperature float64 `json:"temperature,omitempty"`
}

type ollamaMessage struct {
	Role      string           `json:"role"`
	Content   string           `json:"content,omitempty"`
	Images    []string         `json:"images,omitempty"`
	ToolCalls []ollamaToolCall `json:"tool_calls,omitempty"`
}

type ollamaTool struct {
	Type     string         `json:"type"` // always "function"
	Function ollamaFunction `json:"function"`
}

type ollamaFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Parameters  map[string]any `json:"parameters"`
}

// ollamaToolCall is the request/response tool call shape. Arguments is an
// object on the wire (not a JSON string like OpenAI).
type ollamaToolCall struct {
	Function ollamaFunctionCall `json:"function"`
}

type ollamaFunctionCall struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments,omitempty"`
}

// ollamaStreamEvent is one NDJSON line from /api/chat.
type ollamaStreamEvent struct {
	Message ollamaStreamMessage `json:"message"`
	Done    bool                `json:"done"`
	// usage fields on the terminal event
	PromptEvalCount int `json:"prompt_eval_count"`
	EvalCount       int `json:"eval_count"`
}

type ollamaStreamMessage struct {
	Role      string           `json:"role"`
	Content   string           `json:"content"`
	Thinking  string           `json:"thinking"`
	ToolCalls []ollamaToolCall `json:"tool_calls"`
}

// ollamaTagsResponse is the shape of GET /api/tags.
type ollamaTagsResponse struct {
	Models []struct {
		Name    string `json:"name"`
		Details struct {
			ParameterSize string   `json:"parameter_size"`
			Families      []string `json:"families"`
		} `json:"details"`
	} `json:"models"`
}

// Stream implements Provider.
func (o *Ollama) Stream(ctx context.Context, req Request) (<-chan Chunk, error) {
	body, err := json.Marshal(o.buildRequest(req))
	if err != nil {
		return nil, fmt.Errorf("marshal ollama request: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, o.baseURL+ollamaChatPath, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create ollama request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/x-ndjson")
	if o.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+o.apiKey)
	}
	return StreamHTTP(ctx, o.client, httpReq, o.readStream)
}

func (o *Ollama) buildRequest(req Request) ollamaRequest {
	out := ollamaRequest{
		Model:    req.Model,
		Messages: convertOllamaMessages(req.Messages),
		Tools:    convertOllamaTools(req.Tools),
		Stream:   true,
		Think:    ollamaThinkValue(o.thinking),
	}
	if req.MaxTokens > 0 {
		out.Options = &ollamaOptions{NumPredict: EffectiveMaxOutput(req.Model, req.MaxTokens)}
	}
	if o.keepAlive != "" {
		out.KeepAlive = o.keepAlive
	}
	return out
}

// ollamaThinkValue maps a ThinkingConfig to the Ollama `think` field.
// "enabled" -> true, "disabled" -> false, "high"/"medium"/"low"/"max" -> level.
// nil (no thinking config) omits the field so the model default applies.
func ollamaThinkValue(th *ThinkingConfig) any {
	if th == nil || th.Type == "" {
		return nil
	}
	switch th.Type {
	case "enabled":
		return true
	case "disabled":
		return false
	case "high", "medium", "low", "max":
		return th.Type
	default:
		return nil
	}
}

func convertOllamaMessages(msgs []Message) []ollamaMessage {
	out := make([]ollamaMessage, 0, len(msgs))
	for _, m := range msgs {
		msg := ollamaMessage{Role: string(m.Role), Content: m.Content}
		if len(m.ContentParts) > 0 {
			// Ollama native API keeps text in `content` and images in a separate
			// `images` array. Concatenate text parts into content; inline base64
			// image parts go to images. HTTP image URLs are unsupported (skipped).
			var textParts []string
			for _, p := range m.ContentParts {
				if p.Type == "text" && p.Text != "" {
					textParts = append(textParts, p.Text)
				}
			}
			if len(textParts) > 0 {
				msg.Content = strings.Join(textParts, "")
			}
			msg.Images = extractOllamaImages(m.ContentParts)
		}
		if len(m.ToolCalls) > 0 {
			msg.ToolCalls = make([]ollamaToolCall, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				msg.ToolCalls = append(msg.ToolCalls, ollamaToolCall{
					Function: ollamaFunctionCall{Name: tc.Name, Arguments: tc.Arguments},
				})
			}
		}
		out = append(out, msg)
	}
	return out
}

// extractOllamaImages pulls raw base64 payloads from image content parts.
// Ollama native API takes an `images` array of base64 strings (no data: prefix).
// HTTP image URLs are not supported by the native API and are skipped.
func extractOllamaImages(parts []ContentPart) []string {
	if len(parts) == 0 {
		return nil
	}
	var images []string
	for _, p := range parts {
		if p.Type != "image_url" || p.ImageURL == nil {
			continue
		}
		if b64, ok := dataURLToBase64(p.ImageURL.URL); ok {
			images = append(images, b64)
		}
	}
	return images
}

// dataURLToBase64 returns the base64 payload of a data: URL, true.
// Non-data URLs return ("", false).
func dataURLToBase64(s string) (string, bool) {
	const prefix = "data:"
	if !strings.HasPrefix(s, prefix) {
		return "", false
	}
	// data:image/png;base64,XXXX
	rest := strings.TrimPrefix(s, prefix)
	semi := strings.IndexByte(rest, ';')
	if semi < 0 {
		return "", false
	}
	rest = rest[semi+1:]
	comma := strings.IndexByte(rest, ',')
	if comma < 0 {
		return "", false
	}
	return rest[comma+1:], true
}

func convertOllamaTools(tools []ToolDefinition) []ollamaTool {
	if len(tools) == 0 {
		return nil
	}
	out := make([]ollamaTool, 0, len(tools))
	for _, t := range tools {
		out = append(out, ollamaTool{
			Type: "function",
			Function: ollamaFunction{
				Name: t.Name, Description: t.Description, Parameters: t.Parameters,
			},
		})
	}
	return out
}

// toolCallCounter generates stable IDs for Ollama tool calls, which do not
// carry an ID on the wire.
var toolCallCounter uint64

func (o *Ollama) readStream(ctx context.Context, r io.Reader, ch chan<- Chunk) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var ev ollamaStreamEvent
		if err := json.Unmarshal([]byte(line), &ev); err != nil {
			continue
		}

		if ev.Message.Thinking != "" {
			SendChunk(ctx, ch, Chunk{ReasoningDelta: ev.Message.Thinking})
		}
		if ev.Message.Content != "" {
			SendChunk(ctx, ch, Chunk{TextDelta: ev.Message.Content})
		}
		if len(ev.Message.ToolCalls) > 0 {
			calls := make([]ToolCall, 0, len(ev.Message.ToolCalls))
			for _, tc := range ev.Message.ToolCalls {
				args := tc.Function.Arguments
				if len(args) == 0 {
					args = json.RawMessage("{}")
				}
				calls = append(calls, ToolCall{
					ID:        fmt.Sprintf("call_%d", atomic.AddUint64(&toolCallCounter, 1)),
					Name:      tc.Function.Name,
					Arguments: args,
				})
			}
			SendChunk(ctx, ch, Chunk{ToolCalls: calls})
		}

		if ev.Done {
			SendChunk(ctx, ch, Chunk{
				Done:         true,
				InputTokens:  ev.PromptEvalCount,
				OutputTokens: ev.EvalCount,
			})
			return
		}
	}
	// Stream ended without an explicit done event; signal completion so the
	// loop does not wait forever.
	SendChunk(ctx, ch, Chunk{Done: true})
}

// ListModels fetches available models from GET /api/tags.
func (o *Ollama) ListModels(ctx context.Context) ([]ModelInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, o.baseURL+o.modelsPath, nil)
	if err != nil {
		return nil, fmt.Errorf("create ollama tags request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if o.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+o.apiKey)
	}
	resp, err := o.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ollama tags request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ollama tags request failed: status %d: %s", resp.StatusCode, string(body))
	}
	var out ollamaTagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode ollama tags: %w", err)
	}
	models := make([]ModelInfo, 0, len(out.Models))
	for _, m := range out.Models {
		mi := ModelInfo{ID: m.Name}
		for _, fam := range m.Details.Families {
			if fam == "clip" || fam == "vision" {
				mi.Vision = true
			}
		}
		models = append(models, mi)
	}
	return models, nil
}
