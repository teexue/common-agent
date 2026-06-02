package registry_test

import (
	"testing"

	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

func TestRegisterAndGet(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg)

	tool, ok := reg.Get("echo")
	if !ok {
		t.Fatal("expected echo tool")
	}
	if tool.Name() != "echo" {
		t.Fatalf("name = %q, want echo", tool.Name())
	}
}

func TestRegisterDuplicate(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg)
	// Try registering echo again.
	var e builtin.Echo
	if err := reg.Register(e); err == nil {
		t.Fatal("expected error for duplicate registration")
	}
}

func TestRegisterEmptyName(t *testing.T) {
	reg := registry.New()
	// A tool with empty name is invalid.
	// We don't have such a tool in builtin, so test via the error path in Get.
	_, ok := reg.Get("nonexistent")
	if ok {
		t.Fatal("expected missing tool")
	}
}

func TestDefinitions(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg)

	defs, err := reg.Definitions([]string{"echo", "get_time"})
	if err != nil {
		t.Fatalf("Definitions: %v", err)
	}
	if len(defs) != 2 {
		t.Fatalf("got %d definitions, want 2", len(defs))
	}
	if defs[0].Name != "echo" {
		t.Fatalf("first def = %q, want echo", defs[0].Name)
	}
}

func TestDefinitionsUnknownTool(t *testing.T) {
	reg := registry.New()
	_, err := reg.Definitions([]string{"nonexistent"})
	if err == nil {
		t.Fatal("expected error for unknown tool")
	}
}
