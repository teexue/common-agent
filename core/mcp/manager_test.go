package mcp

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/teexue/common-agent/core/tool"
	"github.com/teexue/common-agent/tools/registry"
)

func TestManager_NoServers(t *testing.T) {
	m := NewManager(nil, nil)
	tools := m.ConnectAll(context.Background())
	if len(tools) != 0 {
		t.Errorf("expected 0 tools, got %d", len(tools))
	}
}

func TestManager_ConnectAll_FailedServer(t *testing.T) {
	// A server with an invalid command should fail gracefully.
	servers := []ServerConfig{
		{Name: "bad", Type: "stdio", Command: "/nonexistent/binary"},
	}
	m := NewManager(servers, nil)
	tools := m.ConnectAll(context.Background())

	if len(tools) != 0 {
		t.Errorf("expected 0 tools from failed server, got %d", len(tools))
	}
	if len(m.Names()) != 0 {
		t.Errorf("expected 0 connected servers, got %d", len(m.Names()))
	}
}

func TestManager_GetTool_NotFound(t *testing.T) {
	m := NewManager(nil, nil)
	_, ok := m.GetTool("nonexistent")
	if ok {
		t.Error("expected false for nonexistent tool")
	}
}

func TestManager_Close(t *testing.T) {
	m := NewManager(nil, nil)
	m.Close() // should not panic
}

func TestManager_ToolNames_Empty(t *testing.T) {
	m := NewManager(nil, nil)
	names := m.ToolNames()
	if len(names) != 0 {
		t.Errorf("expected empty, got %v", names)
	}
}

func TestManager_createClient_UnknownType(t *testing.T) {
	m := NewManager(nil, nil)
	client := m.createClient(ServerConfig{Name: "x", Type: "unknown"})
	if client != nil {
		t.Error("expected nil for unknown type")
	}
}

// TestRegistry_Unregister tests the new Unregister method.
func TestRegistry_Unregister(t *testing.T) {
	reg := createTestRegistry()

	ok := reg.Unregister("echo")
	if !ok {
		t.Error("expected true for existing tool")
	}

	_, found := reg.Get("echo")
	if found {
		t.Error("expected echo to be unregistered")
	}

	ok = reg.Unregister("nonexistent")
	if ok {
		t.Error("expected false for nonexistent tool")
	}
}

func TestRegistry_UnregisterBatch(t *testing.T) {
	reg := createTestRegistry()

	count := reg.UnregisterBatch([]string{"echo", "time", "nonexistent"})
	if count != 2 {
		t.Errorf("expected 2 removed, got %d", count)
	}

	if len(reg.Names()) != 0 {
		t.Errorf("expected 0 tools, got %d", len(reg.Names()))
	}
}

func TestRegistry_RegisterBatch(t *testing.T) {
	reg := createTestRegistry()

	newTools := []tool.Tool{
		&simpleTool{name: "new1", desc: "New 1"},
		&simpleTool{name: "new2", desc: "New 2"},
	}

	err := reg.RegisterBatch(newTools)
	if err != nil {
		t.Fatal(err)
	}

	if len(reg.Names()) != 4 {
		t.Errorf("expected 4 tools, got %d", len(reg.Names()))
	}
}

func TestRegistry_RegisterBatch_Duplicate(t *testing.T) {
	reg := createTestRegistry()

	newTools := []tool.Tool{
		&simpleTool{name: "echo", desc: "Duplicate"},
	}

	err := reg.RegisterBatch(newTools)
	if err == nil {
		t.Fatal("expected error for duplicate")
	}
}

// helpers

type simpleTool struct {
	name string
	desc string
}

func (t *simpleTool) Name() string                             { return t.name }
func (t *simpleTool) Description() string                      { return t.desc }
func (t *simpleTool) InputSchema() map[string]any              { return map[string]any{"type": "object"} }
func (t *simpleTool) Execute(_ context.Context, _ json.RawMessage) (tool.Result, error) {
	return tool.Result{}, nil
}

func createTestRegistry() *registry.Registry {
	reg := registry.New()
	reg.MustRegister(&simpleTool{name: "echo", desc: "Echo"})
	reg.MustRegister(&simpleTool{name: "time", desc: "Time"})
	return reg
}
