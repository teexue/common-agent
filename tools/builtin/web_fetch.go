package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/teexue/common-agent/core/tool"
)

const (
	defaultFetchTimeout  = 15 * time.Second
	defaultMaxFetchBytes = 512 * 1024 // 512KB
)

// WebFetch makes an HTTP GET request.
type WebFetch struct{}

func (WebFetch) Name() string { return "web_fetch" }
func (WebFetch) Description() string {
	return "Fetch content from a URL via HTTP GET. Returns the response status, headers, and body."
}
func (WebFetch) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"url": map[string]any{
				"type":        "string",
				"description": "The URL to fetch",
			},
			"headers": map[string]any{
				"type":        "object",
				"description": "Optional HTTP headers as key-value pairs",
				"additionalProperties": map[string]any{
					"type": "string",
				},
			},
			"max_bytes": map[string]any{
				"type":        "integer",
				"description": "Maximum response body bytes to read (default 524288 = 512KB)",
			},
		},
		"required": []string{"url"},
	}
}

func (WebFetch) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		URL      string            `json:"url"`
		Headers  map[string]string `json:"headers"`
		MaxBytes int               `json:"max_bytes"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse web_fetch input: %w", err)
	}

	if args.URL == "" {
		return tool.Result{}, fmt.Errorf("url is required")
	}

	timeout := defaultFetchTimeout
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, args.URL, nil)
	if err != nil {
		return tool.Result{}, fmt.Errorf("create request: %w", err)
	}

	for k, v := range args.Headers {
		req.Header.Set(k, v)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return tool.Result{}, fmt.Errorf("fetch url: %w", err)
	}
	defer resp.Body.Close()

	maxBytes := args.MaxBytes
	if maxBytes <= 0 {
		maxBytes = defaultMaxFetchBytes
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, int64(maxBytes)))
	if err != nil {
		return tool.Result{}, fmt.Errorf("read response: %w", err)
	}

	// Collect response headers
	respHeaders := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			respHeaders[k] = v[0]
		}
	}

	out, _ := json.Marshal(map[string]any{
		"url":         args.URL,
		"status":      resp.StatusCode,
		"headers":     respHeaders,
		"body":        string(body),
		"body_bytes":  len(body),
		"truncated":   len(body) >= maxBytes,
	})
	return tool.Result{Output: out}, nil
}
