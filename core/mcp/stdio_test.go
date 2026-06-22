package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

// TestStdioClient_JSONRPC tests the JSON-RPC message format.
func TestStdioClient_JSONRPC(t *testing.T) {
	// Verify Request marshaling.
	req := Request{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "initialize",
		Params:  json.RawMessage(`{"protocolVersion":"2024-11-05"}`),
	}
	data, err := json.Marshal(req)
	if err != nil {
		t.Fatal(err)
	}

	var parsed Request
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatal(err)
	}
	if parsed.ID != 1 || parsed.Method != "initialize" {
		t.Errorf("unexpected parsed request: %+v", parsed)
	}
}

// TestStdioClient_ResponseDispatch tests that responses are dispatched to the correct pending request.
func TestStdioClient_ResponseDispatch(t *testing.T) {
	client := &StdioClient{
		name:    "test",
		pending: make(map[int64]chan *Response),
	}

	ch := make(chan *Response, 1)
	client.pending[42] = ch

	resp := &Response{JSONRPC: "2.0", ID: 42, Result: json.RawMessage(`"ok"`)}

	// Simulate dispatch.
	client.mu.Lock()
	pendingCh, ok := client.pending[resp.ID]
	client.mu.Unlock()

	if ok {
		pendingCh <- resp
	}

	got := <-ch
	if got.ID != 42 {
		t.Errorf("expected ID 42, got %d", got.ID)
	}
}

// TestStdioClient_WriteMessage tests message writing.
func TestStdioClient_WriteMessage(t *testing.T) {
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()

	client := &StdioClient{name: "test"}
	client.stdin = w

	msg := Request{JSONRPC: "2.0", ID: 1, Method: "test"}
	if err := client.writeMessage(msg); err != nil {
		t.Fatal(err)
	}
	w.Close()

	scanner := bufio.NewScanner(r)
	if !scanner.Scan() {
		t.Fatal("expected a line")
	}

	var parsed Request
	if err := json.Unmarshal(scanner.Bytes(), &parsed); err != nil {
		t.Fatal(err)
	}
	if parsed.Method != "test" {
		t.Errorf("expected method 'test', got %q", parsed.Method)
	}
}

// TestStdioClient_WithMockServer tests the full lifecycle with a mock MCP server script.
func TestStdioClient_WithMockServer(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("skipping on windows")
	}

	// Create a mock MCP server script that speaks JSON-RPC over stdin/stdout.
	dir := t.TempDir()
	script := filepath.Join(dir, "mock-mcp.sh")

	scriptContent := `#!/bin/sh
# Read lines from stdin, respond to JSON-RPC requests.
while IFS= read -r line; do
  # Parse the method from the JSON line.
  method=$(echo "$line" | python3 -c "import sys,json; print(json.load(sys.stdin).get('method',''))" 2>/dev/null)
  id=$(echo "$line" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',0))" 2>/dev/null)

  case "$method" in
    initialize)
      echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"result\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{\"tools\":{}},\"serverInfo\":{\"name\":\"mock\",\"version\":\"0.1\"}}}"
      ;;
    notifications/initialized)
      # No response for notifications.
      ;;
    tools/list)
      echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"result\":{\"tools\":[{\"name\":\"echo\",\"description\":\"Echo tool\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"msg\":{\"type\":\"string\"}}}}]}}"
      ;;
    tools/call)
      echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"echo result\"}]}}"
      ;;
    *)
      echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"error\":{\"code\":-32601,\"message\":\"method not found\"}}"
      ;;
  esac
done
`
	if err := os.WriteFile(script, []byte(scriptContent), 0o755); err != nil {
		t.Fatal(err)
	}

	// Check if python3 is available (needed by the mock script).
	if _, err := exec.LookPath("python3"); err != nil {
		t.Skip("python3 not available for mock MCP server")
	}

	client := NewStdioClient(StdioConfig{
		Name:    "mock",
		Command: "/bin/sh",
		Args:    []string{script},
	})

	ctx := context.Background()
	if err := client.Connect(ctx); err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer client.Close()

	// Test ListTools.
	tools, err := client.ListTools(ctx)
	if err != nil {
		t.Fatalf("list tools: %v", err)
	}
	if len(tools) != 1 {
		t.Fatalf("expected 1 tool, got %d", len(tools))
	}
	if tools[0].Name != "echo" {
		t.Errorf("expected tool name 'echo', got %q", tools[0].Name)
	}
	if tools[0].Description != "Echo tool" {
		t.Errorf("expected description 'Echo tool', got %q", tools[0].Description)
	}

	// Test CallTool.
	result, err := client.CallTool(ctx, "echo", map[string]any{"msg": "hello"})
	if err != nil {
		t.Fatalf("call tool: %v", err)
	}
	if len(result.Content) != 1 {
		t.Fatalf("expected 1 content item, got %d", len(result.Content))
	}
	if result.Content[0].Text != "echo result" {
		t.Errorf("expected 'echo result', got %q", result.Content[0].Text)
	}

	// Test Close.
	if err := client.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
}

// TestStdioClient_ConnectFailure tests that Connect fails gracefully with a bad command.
func TestStdioClient_ConnectFailure(t *testing.T) {
	client := NewStdioClient(StdioConfig{
		Name:    "bad",
		Command: "/nonexistent/binary",
	})

	err := client.Connect(context.Background())
	if err == nil {
		t.Fatal("expected error for nonexistent command")
	}
}

// suppress unused import
var _ = fmt.Sprintf
