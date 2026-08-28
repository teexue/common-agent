package provider

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
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

// ollamaShowResponse is the shape of POST /api/show. ModelInfo is a flat map
// keyed by architecture-qualified names (e.g. "llama.context_length",
// "qwen2.context_length"); we scan for any "*.context_length" entry to find
// the model's training context length regardless of architecture.
type ollamaShowResponse struct {
	Parameters   string             `json:"parameters"`
	Capabilities []string           `json:"capabilities"`
	ModelInfo    map[string]any     `json:"model_info"`
	Details      *ollamaShowDetails `json:"details"`
}

// ollamaShowDetails mirrors the high-level model details block from /api/show.
type ollamaShowDetails struct {
	Family            string   `json:"family"`
	Families          []string `json:"families"`
	ParameterSize     string   `json:"parameter_size"`
	QuantizationLevel string   `json:"quantization_level"`
}

// cachedContextLength returns the model's memoized training context length,
// or 0 when unknown (no /api/show has resolved it yet).
func (o *Ollama) cachedContextLength(model string) int {
	if v, ok := o.ctxCache.Load(model); ok {
		if n, _ := v.(int); n > 0 {
			return n
		}
	}
	return 0
}

// contextLength returns the model's training context length, fetching it from
// /api/show once per model and memoizing the result. Returns 0 on any failure.
func (o *Ollama) contextLength(ctx context.Context, model string) int {
	if n := o.cachedContextLength(model); n > 0 {
		return n
	}
	n := o.fetchContextLength(ctx, model)
	if n > 0 {
		o.ctxCache.Store(model, n)
	}
	return n
}

func (o *Ollama) fetchContextLength(ctx context.Context, model string) int {
	out, err := o.fetchShowDetail(ctx, model)
	if err != nil || out == nil {
		return 0
	}
	return contextLengthFromShow(out)
}

// fetchShowDetail calls POST /api/show with verbose=true and returns the
// parsed response. verbose=true is required for Ollama to return model_info
// (which carries context_length); without it some versions and cloud models
// omit the block entirely.
func (o *Ollama) fetchShowDetail(ctx context.Context, model string) (*ollamaShowResponse, error) {
	body, err := json.Marshal(map[string]any{"model": model, "verbose": true})
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, o.baseURL+ollamaShowPath, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	if o.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+o.apiKey)
	}
	resp, err := o.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ollama show request failed: status %d", resp.StatusCode)
	}
	var out ollamaShowResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

// contextLengthFromShow extracts the training context length from a parsed
// /api/show response, preferring the architecture-qualified key matching
// general.architecture and falling back to any *.context_length entry.
func contextLengthFromShow(out *ollamaShowResponse) int {
	if out == nil || out.ModelInfo == nil {
		return 0
	}
	if arch, ok := out.ModelInfo["general.architecture"].(string); ok && arch != "" {
		if n := contextLengthValue(out.ModelInfo[arch+".context_length"]); n > 0 {
			return n
		}
	}
	for k, v := range out.ModelInfo {
		if !strings.HasSuffix(k, ".context_length") {
			continue
		}
		if n := contextLengthValue(v); n > 0 {
			return n
		}
	}
	return 0
}

// ShowModel implements ModelDetailer. It returns the model's structured
// metadata from /api/show: training context length, architecture, family,
// parameter size, quantization, advertised capabilities, and the runtime
// num_ctx parsed from the parameters string.
func (o *Ollama) ShowModel(ctx context.Context, model string) (ModelDetail, error) {
	out, err := o.fetchShowDetail(ctx, model)
	if err != nil {
		return ModelDetail{}, fmt.Errorf("ollama show: %w", err)
	}
	d := ModelDetail{ID: model}
	d.ContextWindow = contextLengthFromShow(out)
	if d.ContextWindow > 0 {
		o.ctxCache.Store(model, d.ContextWindow)
	}
	if arch, ok := out.ModelInfo["general.architecture"].(string); ok {
		d.Architecture = arch
	}
	if out.Details != nil {
		d.Family = out.Details.Family
		d.Families = out.Details.Families
		d.ParameterSize = out.Details.ParameterSize
		d.Quantization = out.Details.QuantizationLevel
	}
	d.Capabilities = out.Capabilities
	d.RuntimeContextWindow = parseOllamaNumCtx(out.Parameters)
	return d, nil
}

// parseOllamaNumCtx extracts the runtime num_ctx value from the serialized
// parameters string (e.g. "temperature 0.7\nnum_ctx 2048"). Returns 0 when
// absent, meaning Ollama applies its own default (commonly 4096).
func parseOllamaNumCtx(parameters string) int {
	for _, line := range strings.Split(parameters, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) == 2 && fields[0] == "num_ctx" {
			if n, err := strconv.Atoi(fields[1]); err == nil {
				return n
			}
		}
	}
	return 0
}

// contextLengthValue coerces a model_info context_length entry (Ollama sends
// it as a JSON number, but tolerate a string) to int, returning 0 on failure.
func contextLengthValue(v any) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case json.Number:
		if i, err := n.Int64(); err == nil {
			return int(i)
		}
	case string:
		if i, err := strconv.Atoi(n); err == nil {
			return i
		}
	}
	return 0
}

// seedContextWindows pre-fills the /api/show cache from windows saved when
// the provider was configured, so num_ctx can be set without a live fetch.
func (o *Ollama) seedContextWindows(windows map[string]int) {
	for model, n := range windows {
		if n > 0 {
			o.ctxCache.Store(model, n)
		}
	}
}

// ResolveContextWindow implements provider.ContextResolver. It reads the
// model's real context length from /api/show so the loop's compaction
// threshold and Ollama's num_ctx agree, instead of assuming the 128K default
// which can exceed a small model's training context. A user-configured window
// is honored but capped at the model's real maximum.
func (o *Ollama) ResolveContextWindow(ctx context.Context, model string, configured int) int {
	max := o.contextLength(ctx, model)
	if configured > 0 {
		if max > 0 && configured > max {
			return max
		}
		return configured
	}
	if max > 0 {
		return max
	}
	return EffectiveContextWindow(model, 0)
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
