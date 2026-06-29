package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
)

// SSEClient communicates with an MCP server over HTTP SSE.
type SSEClient struct {
	url    string
	name   string
	logger *slog.Logger

	mu       sync.Mutex
	nextID   atomic.Int64
	pending  map[int64]chan *Response
	client   *http.Client
	cancelFn context.CancelFunc
	closed   bool
}

// SSEConfig configures an SSEClient.
type SSEConfig struct {
	Name    string       // display name
	URL     string       // SSE endpoint URL
	Logger  *slog.Logger // optional logger
	HTTPClient *http.Client // optional HTTP client
}

// NewSSEClient creates a new SSEClient.
func NewSSEClient(cfg SSEConfig) *SSEClient {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	client := cfg.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	return &SSEClient{
		url:     cfg.URL,
		name:    cfg.Name,
		logger:  logger,
		pending: make(map[int64]chan *Response),
		client:  client,
	}
}

// Name returns the configured name of this MCP server.
func (c *SSEClient) Name() string { return c.name }

// Connect establishes the SSE connection and performs the MCP handshake.
func (c *SSEClient) Connect(ctx context.Context) error {
	ctx, c.cancelFn = context.WithCancel(ctx)

	// Start SSE listener.
	go c.listenSSE(ctx)

	// Send initialize request.
	initParams, _ := json.Marshal(InitializeParams{
		ProtocolVersion: "2024-11-05",
		Capabilities:    ClientCapabilities{Tools: &ToolsCapability{}},
		ClientInfo:      ClientInfo{Name: "common-agent", Version: "0.1.0"},
	})

	resp, err := c.sendRequest(ctx, "initialize", initParams)
	if err != nil {
		return fmt.Errorf("initialize: %w", err)
	}
	if resp.Error != nil {
		return fmt.Errorf("initialize error: %s", resp.Error.Message)
	}

	// Send initialized notification.
	if err := c.sendNotification(ctx, "notifications/initialized", nil); err != nil {
		return fmt.Errorf("initialized notification: %w", err)
	}

	c.logger.Info("mcp sse server connected", "name", c.name)
	return nil
}

// ListTools returns the tools provided by the server.
func (c *SSEClient) ListTools(ctx context.Context) ([]ToolDefinition, error) {
	resp, err := c.sendRequest(ctx, "tools/list", nil)
	if err != nil {
		return nil, fmt.Errorf("tools/list: %w", err)
	}
	if resp.Error != nil {
		return nil, fmt.Errorf("tools/list error: %s", resp.Error.Message)
	}

	var result ListToolsResult
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, fmt.Errorf("unmarshal tools/list result: %w", err)
	}
	return result.Tools, nil
}

// CallTool invokes a tool on the server.
func (c *SSEClient) CallTool(ctx context.Context, name string, args map[string]any) (*CallToolResult, error) {
	params, _ := json.Marshal(CallToolParams{Name: name, Arguments: args})

	resp, err := c.sendRequest(ctx, "tools/call", params)
	if err != nil {
		return nil, fmt.Errorf("tools/call %s: %w", name, err)
	}
	if resp.Error != nil {
		return nil, fmt.Errorf("tools/call %s error: %s", name, resp.Error.Message)
	}

	var result CallToolResult
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, fmt.Errorf("unmarshal tools/call result: %w", err)
	}
	return &result, nil
}

// Close shuts down the connection.
func (c *SSEClient) Close() error {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return nil
	}
	c.closed = true
	c.mu.Unlock()

	if c.cancelFn != nil {
		c.cancelFn()
	}
	c.logger.Info("mcp sse server disconnected", "name", c.name)
	return nil
}

// sendRequest sends a JSON-RPC request via HTTP POST and waits for the response.
func (c *SSEClient) sendRequest(ctx context.Context, method string, params json.RawMessage) (*Response, error) {
	id := c.nextID.Add(1)
	ch := make(chan *Response, 1)

	c.mu.Lock()
	c.pending[id] = ch
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
	}()

	req := Request{
		JSONRPC: jsonrpcVersion,
		ID:      id,
		Method:  method,
		Params:  params,
	}

	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.url, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case r := <-ch:
		return r, nil
	}
}

// sendNotification sends a JSON-RPC notification via HTTP POST.
func (c *SSEClient) sendNotification(ctx context.Context, method string, params json.RawMessage) error {
	notif := Notification{
		JSONRPC: jsonrpcVersion,
		Method:  method,
		Params:  params,
	}
	body, _ := json.Marshal(notif)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.url, strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// listenSSE reads the SSE stream and dispatches responses.
func (c *SSEClient) listenSSE(ctx context.Context) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.url, nil)
	if err != nil {
		c.logger.Error("mcp sse connect failed", "name", c.name, "error", err)
		return
	}
	req.Header.Set("Accept", "text/event-stream")

	resp, err := c.client.Do(req)
	if err != nil {
		c.logger.Error("mcp sse connect failed", "name", c.name, "error", err)
		return
	}
	defer resp.Body.Close()

	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err != io.EOF && ctx.Err() == nil {
				c.logger.Debug("mcp sse read error", "name", c.name, "error", err)
			}
			return
		}

		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")

		var resp Response
		if err := json.Unmarshal([]byte(data), &resp); err != nil {
			continue
		}

		c.mu.Lock()
		ch, ok := c.pending[resp.ID]
		c.mu.Unlock()

		if ok {
			select {
			case ch <- &resp:
			default:
			}
		}
	}
}
