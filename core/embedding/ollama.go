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

// OllamaConfig configures a local Ollama embeddings endpoint.
type OllamaConfig struct {
	BaseURL string
	Model   string
	Client  *http.Client
}

// OllamaEmbedder calls POST {base}/api/embeddings (legacy) with /api/embed fallback.
type OllamaEmbedder struct {
	baseURL string
	model   string
	client  *http.Client

	mu   sync.RWMutex
	dims int
}

// NewOllama creates an Ollama embedder.
func NewOllama(cfg OllamaConfig) (*OllamaEmbedder, error) {
	if cfg.Model == "" {
		return nil, fmt.Errorf("embedding ollama: model is required")
	}
	base := strings.TrimRight(cfg.BaseURL, "/")
	if base == "" {
		base = "http://127.0.0.1:11434"
	}
	client := cfg.Client
	if client == nil {
		client = provider.DefaultHTTPClient()
	}
	return &OllamaEmbedder{baseURL: base, model: cfg.Model, client: client}, nil
}

type ollamaLegacyRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

type ollamaLegacyResponse struct {
	Embedding []float32 `json:"embedding"`
}

type ollamaEmbedRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

type ollamaEmbedResponse struct {
	Embeddings [][]float32 `json:"embeddings"`
}

// Embed implements Embedder.
func (e *OllamaEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	// Prefer batch /api/embed when available.
	vecs, err := e.embedBatch(ctx, texts)
	if err == nil {
		return vecs, nil
	}
	// Fall back to per-text /api/embeddings.
	out := make([][]float32, len(texts))
	for i, t := range texts {
		v, err := e.embedOne(ctx, t)
		if err != nil {
			return nil, err
		}
		out[i] = v
	}
	if len(out[0]) > 0 {
		e.mu.Lock()
		e.dims = len(out[0])
		e.mu.Unlock()
	}
	return out, nil
}

func (e *OllamaEmbedder) embedBatch(ctx context.Context, texts []string) ([][]float32, error) {
	body, err := json.Marshal(ollamaEmbedRequest{Model: e.model, Input: texts})
	if err != nil {
		return nil, err
	}
	raw, status, err := e.post(ctx, e.baseURL+"/api/embed", body)
	if err != nil {
		return nil, err
	}
	if status >= 300 {
		return nil, fmt.Errorf("ollama /api/embed status %d: %s", status, truncate(string(raw), 200))
	}
	var parsed ollamaEmbedResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("parse ollama embed: %w", err)
	}
	if len(parsed.Embeddings) != len(texts) {
		return nil, fmt.Errorf("ollama embed: got %d vectors for %d texts", len(parsed.Embeddings), len(texts))
	}
	if len(parsed.Embeddings) > 0 && len(parsed.Embeddings[0]) > 0 {
		e.mu.Lock()
		e.dims = len(parsed.Embeddings[0])
		e.mu.Unlock()
	}
	return parsed.Embeddings, nil
}

func (e *OllamaEmbedder) embedOne(ctx context.Context, text string) ([]float32, error) {
	body, err := json.Marshal(ollamaLegacyRequest{Model: e.model, Prompt: text})
	if err != nil {
		return nil, err
	}
	raw, status, err := e.post(ctx, e.baseURL+"/api/embeddings", body)
	if err != nil {
		return nil, err
	}
	if status >= 300 {
		return nil, fmt.Errorf("ollama /api/embeddings status %d: %s", status, truncate(string(raw), 200))
	}
	var parsed ollamaLegacyResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("parse ollama embeddings: %w", err)
	}
	if len(parsed.Embedding) == 0 {
		return nil, fmt.Errorf("ollama embeddings: empty vector")
	}
	return parsed.Embedding, nil
}

func (e *OllamaEmbedder) post(ctx context.Context, url string, body []byte) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := e.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return raw, resp.StatusCode, nil
}

// Dimensions implements Embedder.
func (e *OllamaEmbedder) Dimensions() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.dims
}
