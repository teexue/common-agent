package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

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
