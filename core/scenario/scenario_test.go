package scenario_test

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/teexue/common-agent/core/scenario"
)

func TestLoadDemoScenario(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "demo.yaml")
	content := `name: demo
provider: moonshot
model: kimi-k2.6
system_prompt: test
tools: [echo, get_time]
`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	sc, err := scenario.Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if sc.Name != "demo" {
		t.Fatalf("name = %q, want demo", sc.Name)
	}
	if sc.Provider != "moonshot" {
		t.Fatalf("provider = %q, want moonshot", sc.Provider)
	}
	if len(sc.Tools) != 2 {
		t.Fatalf("tools = %v, want 2", sc.Tools)
	}
}

func TestDefaults(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "minimal.yaml")
	content := `name: minimal
provider: test
model: gpt-4
system_prompt: hello
tools: [echo]
version: 1
`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	sc, err := scenario.Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if sc.MaxTurns != 10 {
		t.Fatalf("MaxTurns = %d, want 10", sc.MaxTurns)
	}
	if sc.MaxTokens != 4096 {
		t.Fatalf("MaxTokens = %d, want 4096", sc.MaxTokens)
	}
	if sc.ToolExecMode() != "parallel" {
		t.Fatalf("ToolExecMode = %q, want parallel", sc.ToolExecMode())
	}
	if sc.ToolMaxParallel() != 4 {
		t.Fatalf("ToolMaxParallel = %d, want 4", sc.ToolMaxParallel())
	}
}

func TestSerializeToolExecution(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "serial.yaml")
	content := `name: serial-test
provider: test
model: gpt-4
system_prompt: hello
tools: [echo]
max_tokens: 8192
tool_execution:
  mode: serial
  max_parallel: 1
`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	sc, err := scenario.Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if sc.ToolExecMode() != "serial" {
		t.Fatalf("ToolExecMode = %q, want serial", sc.ToolExecMode())
	}
	if sc.MaxTokens != 8192 {
		t.Fatalf("MaxTokens = %d, want 8192", sc.MaxTokens)
	}
}

func TestLoadWithDefaults(t *testing.T) {
	// Test constructing a Scenario directly (without Load) and using accessors.
	sc := &scenario.Scenario{
		Name:    "direct",
		MaxTurns: 0,
	}
	if sc.ToolExecMode() != "parallel" {
		t.Fatalf("ToolExecMode = %q, want parallel", sc.ToolExecMode())
	}
	if sc.ToolMaxParallel() != 4 {
		t.Fatalf("ToolMaxParallel = %d, want 4", sc.ToolMaxParallel())
	}
}

func TestLoadInvalidScenario(t *testing.T) {
	tests := []struct {
		name    string
		content string
	}{
		{"missing name", "system_prompt: x\ntools: [echo]\nmodel: m\nprovider: p\n"},
		{"missing provider", "name: x\nsystem_prompt: x\nmodel: m\ntools: [echo]\n"},
		{"missing tools", "name: x\nsystem_prompt: x\nmodel: m\nprovider: p\n"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, "bad.yaml")
			if err := os.WriteFile(path, []byte(tt.content), 0o644); err != nil {
				t.Fatal(err)
			}
			if _, err := scenario.Load(path); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestListAvailable(t *testing.T) {
	dir := t.TempDir()
	// Create multiple scenario files.
	for _, name := range []string{"alpha", "beta", "gamma"} {
		path := filepath.Join(dir, name+".yaml")
		content := fmt.Sprintf("name: %s\nprovider: p\nmodel: m\nsystem_prompt: hi\ntools: [echo]\n", name)
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	// Create a non-yaml file that should be ignored.
	if err := os.WriteFile(filepath.Join(dir, "readme.txt"), []byte("ignore"), 0o644); err != nil {
		t.Fatal(err)
	}

	names, err := scenario.ListAvailable(dir)
	if err != nil {
		t.Fatalf("ListAvailable: %v", err)
	}
	if len(names) != 3 {
		t.Fatalf("got %d names, want 3: %v", len(names), names)
	}
	// Should be sorted.
	expected := []string{"alpha", "beta", "gamma"}
	for i, want := range expected {
		if names[i] != want {
			t.Fatalf("names[%d] = %q, want %q", i, names[i], want)
		}
	}
}

func TestListAvailableEmpty(t *testing.T) {
	dir := t.TempDir()
	names, err := scenario.ListAvailable(dir)
	if err != nil {
		t.Fatalf("ListAvailable: %v", err)
	}
	if len(names) != 0 {
		t.Fatalf("got %d names, want 0", len(names))
	}
}

func TestListAvailableNotExist(t *testing.T) {
	_, err := scenario.ListAvailable("/nonexistent/path")
	if err == nil {
		t.Fatal("expected error for nonexistent dir")
	}
}

func TestLoadAndValidate(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.yaml")
	content := `name: test
provider: p
model: m
system_prompt: hi
tools: [echo, get_time]
`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	sc, err := scenario.LoadAndValidate(path, []string{"echo", "get_time", "extra_tool"})
	if err != nil {
		t.Fatalf("LoadAndValidate: %v", err)
	}
	if sc.Name != "test" {
		t.Fatalf("name = %q, want test", sc.Name)
	}
}

func TestLoadAndValidateMissingTool(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.yaml")
	content := `name: test
provider: p
model: m
system_prompt: hi
tools: [echo, nonexistent]
`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	_, err := scenario.LoadAndValidate(path, []string{"echo", "get_time"})
	if err == nil {
		t.Fatal("expected error for missing tool")
	}
	if !strings.Contains(err.Error(), "nonexistent") {
		t.Errorf("error %q should mention nonexistent", err.Error())
	}
}

func TestLoadByNameAndValidate(t *testing.T) {
	dir := t.TempDir()
	content := `name: demo
provider: p
model: m
system_prompt: hi
tools: [echo]
`
	if err := os.WriteFile(filepath.Join(dir, "demo.yaml"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	sc, err := scenario.LoadByNameAndValidate(dir, "demo", []string{"echo", "get_time"})
	if err != nil {
		t.Fatalf("LoadByNameAndValidate: %v", err)
	}
	if sc.Name != "demo" {
		t.Fatalf("name = %q, want demo", sc.Name)
	}
}
