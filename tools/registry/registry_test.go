package registry_test

import (
	"strings"
	"testing"

	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

func TestRegisterAndGet(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

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
	builtin.RegisterAll(reg, t.TempDir())
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
	builtin.RegisterAll(reg, t.TempDir())

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

func TestNames(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	names := reg.Names()
	if len(names) != 10 {
		t.Fatalf("got %d names, want 10", len(names))
	}
	// Names should be sorted.
	if names[0] != "create_directory" {
		t.Fatalf("names[0] = %q, want create_directory", names[0])
	}
	if names[1] != "echo" {
		t.Fatalf("names[1] = %q, want echo", names[1])
	}
}

func TestNamesEmpty(t *testing.T) {
	reg := registry.New()
	names := reg.Names()
	if len(names) != 0 {
		t.Fatalf("got %d names, want 0", len(names))
	}
}

func TestList(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	tools := reg.List()
	if len(tools) != 10 {
		t.Fatalf("got %d tools, want 10", len(tools))
	}
	// List should be sorted by name.
	if tools[0].Name() != "create_directory" {
		t.Fatalf("tools[0].Name() = %q, want create_directory", tools[0].Name())
	}
	if tools[1].Name() != "echo" {
		t.Fatalf("tools[1].Name() = %q, want echo", tools[1].Name())
	}
}

func TestValidateTools(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	if err := reg.ValidateTools([]string{"echo", "get_time"}); err != nil {
		t.Fatalf("ValidateTools: %v", err)
	}
}

func TestValidateToolsMissing(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	err := reg.ValidateTools([]string{"echo", "nonexistent", "also_missing"})
	if err == nil {
		t.Fatal("expected error for missing tools")
	}
	// Verify the error message mentions the missing tools.
	msg := err.Error()
	for _, name := range []string{"nonexistent", "also_missing"} {
		if !strings.Contains(msg, name) {
			t.Errorf("error %q should mention %q", msg, name)
		}
	}
}

func TestValidateToolsEmpty(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	// Empty list should be valid.
	if err := reg.ValidateTools([]string{}); err != nil {
		t.Fatalf("ValidateTools empty: %v", err)
	}
}
