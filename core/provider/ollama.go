package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
)

const (
	defaultOllamaBaseURL = "http://localhost:11434"
	ollamaModelsPath     = "/api/tags"
	ollamaChatPath       = "/api/chat"
	ollamaShowPath       = "/api/show"
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
	// ctxCache memoizes each model's training context length (from /api/show)
	// so num_ctx is only set when it cannot exceed the model's real limit.
	ctxCache sync.Map
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
	NumCtx      int     `json:"num_ctx,omitempty"`
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
	// Ollama's runtime context window (num_ctx) defaults to 4096, which is
	// usually far smaller than the effective window the loop assumes. Size
	// Ollama's context to match so it does not silently truncate the prompt
	// before compaction triggers. Only set num_ctx when we have confirmed
	// (via /api/show) that it does not exceed the model's training context;
	// an oversized num_ctx triggers Ollama's "requested context size too
	// large for model" warning and can crash MoE models.
	if req.MaxTokens > 0 || req.ContextWindow > 0 {
		opts := ollamaOptions{}
		if req.MaxTokens > 0 {
			opts.NumPredict = EffectiveMaxOutput(req.Model, req.MaxTokens)
		}
		if req.ContextWindow > 0 {
			if mx := o.cachedContextLength(req.Model); mx > 0 && req.ContextWindow <= mx {
				opts.NumCtx = req.ContextWindow
			}
		}
		out.Options = &opts
	}
	if o.keepAlive != "" {
		out.KeepAlive = o.keepAlive
	}
	return out
}
