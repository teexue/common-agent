package mcp

import (
	"context"
	"encoding/json"
	"testing"
)

// mockClient implements Client for testing.
type mockClient struct {
	name      string
	tools     []ToolDefinition
	callResult *CallToolResult
	callErr    error
	closed     bool
}

func (m *mockClient) Connect(_ context.Context) error        { return nil }
func (m *mockClient) Close() error                           { m.closed = true; return nil }
func (m *mockClient) Name() string                           { return m.name }
func (m *mockClient) ListTools(_ context.Context) ([]ToolDefinition, error) {
	return m.tools, nil
}
func (m *mockClient) CallTool(_ context.Context, _ string, _ map[string]any) (*CallToolResult, error) {
	return m.callResult, m.callErr
}

func TestExternalTool_Name(t *testing.T) {
	def := ToolDefinition{Name: "my_tool", Description: "A tool", InputSchema: map[string]any{"type": "object"}}
	client := &mockClient{name: "test"}
	tool := NewExternalTool(def, client)

	if tool.Name() != "my_tool" {
		t.Errorf("expected 'my_tool', got %q", tool.Name())
	}
}

func TestExternalTool_Description(t *testing.T) {
	def := ToolDefinition{Name: "t", Description: "desc", InputSchema: map[string]any{}}
	tool := NewExternalTool(def, &mockClient{})

	if tool.Description() != "desc" {
		t.Errorf("expected 'desc', got %q", tool.Description())
	}
}

func TestExternalTool_InputSchema(t *testing.T) {
	schema := map[string]any{"type": "object", "properties": map[string]any{"x": map[string]any{"type": "string"}}}
	def := ToolDefinition{Name: "t", InputSchema: schema}
	tool := NewExternalTool(def, &mockClient{})

	got := tool.InputSchema()
	if got["type"] != "object" {
		t.Errorf("expected type 'object', got %v", got["type"])
	}
}

func TestExternalTool_Execute(t *testing.T) {
	client := &mockClient{
		name: "test",
		callResult: &CallToolResult{
			Content: []Content{{Type: "text", Text: "hello world"}},
		},
	}
	def := ToolDefinition{Name: "echo", InputSchema: map[string]any{}}
	tool := NewExternalTool(def, client)

	result, err := tool.Execute(context.Background(), json.RawMessage(`{"msg":"hi"}`))
	if err != nil {
		t.Fatal(err)
	}

	var output string
	if err := json.Unmarshal(result.Output, &output); err != nil {
		t.Fatal(err)
	}
	if output != "hello world" {
		t.Errorf("expected 'hello world', got %q", output)
	}
}

func TestExternalTool_Execute_EmptyInput(t *testing.T) {
	client := &mockClient{
		callResult: &CallToolResult{
			Content: []Content{{Type: "text", Text: "ok"}},
		},
	}
	def := ToolDefinition{Name: "t", InputSchema: map[string]any{}}
	tool := NewExternalTool(def, client)

	result, err := tool.Execute(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if result.Output == nil {
		t.Error("expected non-nil output")
	}
}

func TestExternalTool_Execute_Error(t *testing.T) {
	client := &mockClient{
		callErr: &RPCError{Code: -1, Message: "tool failed"},
	}
	def := ToolDefinition{Name: "t", InputSchema: map[string]any{}}
	tool := NewExternalTool(def, client)

	_, err := tool.Execute(context.Background(), nil)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestExternalTools(t *testing.T) {
	defs := []ToolDefinition{
		{Name: "a", Description: "A", InputSchema: map[string]any{}},
		{Name: "b", Description: "B", InputSchema: map[string]any{}},
	}
	client := &mockClient{name: "test"}
	tools := ExternalTools(defs, client)

	if len(tools) != 2 {
		t.Fatalf("expected 2 tools, got %d", len(tools))
	}
	if tools[0].Name() != "a" || tools[1].Name() != "b" {
		t.Errorf("unexpected tool names: %s, %s", tools[0].Name(), tools[1].Name())
	}
}

func TestCallToolResult_MarshalText(t *testing.T) {
	result := &CallToolResult{
		Content: []Content{
			{Type: "text", Text: "hello "},
			{Type: "text", Text: "world"},
			{Type: "image", Text: "ignored"},
		},
	}
	text := result.MarshalText()
	if text != "hello world" {
		t.Errorf("expected 'hello world', got %q", text)
	}
}
