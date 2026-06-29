package provider

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// NewSSEScanner creates a bufio.Scanner with standard SSE buffer sizes.
func NewSSEScanner(r io.Reader) *bufio.Scanner {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	return scanner
}

// ParseSSELine extracts the data payload from an SSE "data: " line.
// Returns the trimmed data and true if the line is a data line.
func ParseSSELine(line string) (string, bool) {
	if strings.HasPrefix(line, "data: ") {
		return strings.TrimPrefix(line, "data: "), true
	}
	return "", false
}

// SendChunk sends a chunk to the channel, respecting context cancellation.
func SendChunk(ctx context.Context, ch chan<- Chunk, c Chunk) {
	select {
	case <-ctx.Done():
	case ch <- c:
	}
}

// ReadStreamFunc is the provider-specific function that reads an SSE stream
// from r and sends chunks to ch. It must close ch when done.
type ReadStreamFunc func(ctx context.Context, r io.Reader, ch chan<- Chunk)

// StreamHTTP executes an HTTP request and dispatches the response body
// to the provider-specific readFunc for SSE parsing.
func StreamHTTP(ctx context.Context, client *http.Client, req *http.Request, readFunc ReadStreamFunc) (<-chan Chunk, error) {
	resp, err := client.Do(req.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("api error (status %d): %s", resp.StatusCode, string(body))
	}

	ch := make(chan Chunk)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		readFunc(ctx, resp.Body, ch)
	}()

	return ch, nil
}
