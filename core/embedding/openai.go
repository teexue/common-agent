package embedding

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/teexue/common-agent/core/provider"
)

// OpenAIConfig configures an OpenAI-compatible embeddings API.
type OpenAIConfig struct {
	APIKey     string
	BaseURL    string
	Model      string
	Dimensions int // 0 = omit (provider default)
	MaxBatch   int // 0 = send all texts in one request
	Client     *http.Client
}

// OpenAIEmbedder calls POST {base}/embeddings.
type OpenAIEmbedder struct {
	apiKey     string
	baseURL    string
	model      string
	dimensions int
	maxBatch   int
	client     *http.Client

	mu   sync.RWMutex
	dims int
}

// NewOpenAI creates an OpenAI-compatible embedder.
func NewOpenAI(cfg OpenAIConfig) (*OpenAIEmbedder, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("embedding openai: api key is required")
	}
	if cfg.Model == "" {
		return nil, fmt.Errorf("embedding openai: model is required")
	}
	base := strings.TrimRight(cfg.BaseURL, "/")
	if base == "" {
		base = provider.DefaultBaseURLFor(provider.StyleOpenAI)
	}
	client := cfg.Client
	if client == nil {
		client = provider.DefaultHTTPClient()
	}
	return &OpenAIEmbedder{
		apiKey:     cfg.APIKey,
		baseURL:    base,
		model:      cfg.Model,
		dimensions: cfg.Dimensions,
		maxBatch:   cfg.MaxBatch,
		client:     client,
	}, nil
}

type openAIEmbedRequest struct {
	Model           string   `json:"model"`
	Input           []string `json:"input"`
	Dimensions      int      `json:"dimensions,omitempty"`
	EncodingFormat  string   `json:"encoding_format,omitempty"`
}

type openAIEmbedResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Embed implements Embedder.
func (e *OpenAIEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	batch := e.maxBatch
	if batch <= 0 || batch >= len(texts) {
		return e.embedBatch(ctx, texts)
	}
	out := make([][]float32, len(texts))
	for start := 0; start < len(texts); start += batch {
		end := start + batch
		if end > len(texts) {
			end = len(texts)
		}
		part, err := e.embedBatch(ctx, texts[start:end])
		if err != nil {
			return nil, err
		}
		copy(out[start:end], part)
	}
	return out, nil
}

func (e *OpenAIEmbedder) embedBatch(ctx context.Context, texts []string) ([][]float32, error) {
	reqBody := openAIEmbedRequest{
		Model:          e.model,
		Input:          texts,
		EncodingFormat: "float",
	}
	if e.dimensions > 0 {
		reqBody.Dimensions = e.dimensions
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal embed request: %w", err)
	}
	url := e.baseURL + "/embeddings"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create embed request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.apiKey)

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("embed request: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read embed response: %w", err)
	}
	var parsed openAIEmbedResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("parse embed response: %w", err)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return nil, fmt.Errorf("embed api: %s", parsed.Error.Message)
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("embed api status %d: %s", resp.StatusCode, truncate(string(raw), 200))
	}
	if len(parsed.Data) != len(texts) {
		return nil, fmt.Errorf("embed api: got %d vectors for %d texts", len(parsed.Data), len(texts))
	}
	out := make([][]float32, len(texts))
	for _, d := range parsed.Data {
		if d.Index < 0 || d.Index >= len(out) {
			return nil, fmt.Errorf("embed api: invalid index %d", d.Index)
		}
		out[d.Index] = d.Embedding
	}
	for i, v := range out {
		if v == nil {
			return nil, fmt.Errorf("embed api: missing vector for index %d", i)
		}
	}
	if len(out[0]) > 0 {
		e.mu.Lock()
		e.dims = len(out[0])
		e.mu.Unlock()
	}
	return out, nil
}

// Dimensions implements Embedder.
func (e *OpenAIEmbedder) Dimensions() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	if e.dims > 0 {
		return e.dims
	}
	return e.dimensions
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
