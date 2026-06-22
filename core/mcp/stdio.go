package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os/exec"
	"sync"
	"sync/atomic"
)

// StdioClient communicates with an MCP server over stdin/stdout.
type StdioClient struct {
	command string
	args    []string
	env     []string
	name    string
	logger  *slog.Logger

	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout *bufio.Reader

	mu      sync.Mutex
	nextID  atomic.Int64
	pending map[int64]chan *Response
	closed  bool
}

// StdioConfig configures a StdioClient.
type StdioConfig struct {
	Name    string            // display name for the server
	Command string            // executable path
	Args    []string          // command arguments
	Env     map[string]string // additional environment variables
	Logger  *slog.Logger      // optional logger
}

// NewStdioClient creates a new StdioClient.
func NewStdioClient(cfg StdioConfig) *StdioClient {
	var envSlice []string
	for k, v := range cfg.Env {
		envSlice = append(envSlice, k+"="+v)
	}
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &StdioClient{
		command: cfg.Command,
		args:    cfg.Args,
		env:     envSlice,
		name:    cfg.Name,
		logger:  logger,
		pending: make(map[int64]chan *Response),
	}
}

func (c *StdioClient) Name() string { return c.name }

// Connect starts the subprocess and performs the MCP initialize handshake.
func (c *StdioClient) Connect(ctx context.Context) error {
	c.cmd = exec.CommandContext(ctx, c.command, c.args...)
	c.cmd.Env = append(c.cmd.Environ(), c.env...)

	var err error
	c.stdin, err = c.cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("stdin pipe: %w", err)
	}

	stdoutPipe, err := c.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}
	c.stdout = bufio.NewReader(stdoutPipe)

	if err := c.cmd.Start(); err != nil {
		return fmt.Errorf("start process: %w", err)
	}

	// Start response reader goroutine.
	go c.readLoop()

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

	c.logger.Info("mcp server connected", "name", c.name)
	return nil
}

// ListTools returns the tools provided by the server.
func (c *StdioClient) ListTools(ctx context.Context) ([]ToolDefinition, error) {
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
func (c *StdioClient) CallTool(ctx context.Context, name string, args map[string]any) (*CallToolResult, error) {
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

// Close shuts down the connection gracefully.
func (c *StdioClient) Close() error {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return nil
	}
	c.closed = true
	c.mu.Unlock()

	// Close stdin to signal the subprocess to exit.
	if c.stdin != nil {
		_ = c.stdin.Close()
	}
	if c.cmd != nil && c.cmd.Process != nil {
		_ = c.cmd.Wait()
	}
	c.logger.Info("mcp server disconnected", "name", c.name)
	return nil
}

// sendRequest sends a JSON-RPC request and waits for the response.
func (c *StdioClient) sendRequest(ctx context.Context, method string, params json.RawMessage) (*Response, error) {
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

	if err := c.writeMessage(req); err != nil {
		return nil, err
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case resp := <-ch:
		return resp, nil
	}
}

// sendNotification sends a JSON-RPC notification (no response expected).
func (c *StdioClient) sendNotification(_ context.Context, method string, params json.RawMessage) error {
	notif := Notification{
		JSONRPC: jsonrpcVersion,
		Method:  method,
		Params:  params,
	}
	return c.writeMessage(notif)
}

// writeMessage writes a JSON message followed by a newline to stdin.
func (c *StdioClient) writeMessage(msg any) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	data = append(data, '\n')

	c.mu.Lock()
	defer c.mu.Unlock()

	if _, err := c.stdin.Write(data); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	return nil
}

// readLoop reads JSON-RPC messages from stdout and dispatches responses.
func (c *StdioClient) readLoop() {
	for {
		line, err := c.stdout.ReadBytes('\n')
		if err != nil {
			if err != io.EOF {
				c.logger.Debug("mcp read error", "name", c.name, "error", err)
			}
			return
		}

		// Try to parse as a response (has "id" field).
		var resp Response
		if err := json.Unmarshal(line, &resp); err != nil {
			c.logger.Debug("mcp parse error", "name", c.name, "error", err)
			continue
		}

		// Dispatch to pending request.
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
