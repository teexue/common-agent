package skill

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestManifest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		m       Manifest
		wantErr bool
	}{
		{"valid", Manifest{Name: "test", Version: "1.0", Tools: []ToolDef{{Name: "t", Description: "d"}}}, false},
		{"missing name", Manifest{Version: "1.0", Tools: []ToolDef{{Name: "t", Description: "d"}}}, true},
		{"missing version", Manifest{Name: "test", Tools: []ToolDef{{Name: "t", Description: "d"}}}, true},
		{"no tools", Manifest{Name: "test", Version: "1.0"}, true},
		{"tool missing name", Manifest{Name: "test", Version: "1.0", Tools: []ToolDef{{Description: "d"}}}, true},
		{"tool missing desc", Manifest{Name: "test", Version: "1.0", Tools: []ToolDef{{Name: "t"}}}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.m.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestManifest_ToolNames(t *testing.T) {
	m := Manifest{
		Tools: []ToolDef{
			{Name: "alpha", Description: "a"},
			{Name: "beta", Description: "b"},
		},
	}
	names := m.ToolNames()
	if len(names) != 2 || names[0] != "alpha" || names[1] != "beta" {
		t.Errorf("unexpected tool names: %v", names)
	}
}

func TestLoad(t *testing.T) {
	dir := t.TempDir()
	yaml := `name: test-skill
version: "1.0"
description: A test skill
author: test
tools:
  - name: hello
    description: Say hello
    input_schema:
      type: object
      properties:
        name:
          type: string
  - name: goodbye
    description: Say goodbye
prompt: "You are a greeting assistant."
dependencies:
  - other-skill
`
	if err := os.WriteFile(filepath.Join(dir, "skill.yaml"), []byte(yaml), 0o644); err != nil {
		t.Fatal(err)
	}

	s, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}

	if s.Manifest.Name != "test-skill" {
		t.Errorf("expected name 'test-skill', got %q", s.Manifest.Name)
	}
	if s.Manifest.Version != "1.0" {
		t.Errorf("expected version '1.0', got %q", s.Manifest.Version)
	}
	if len(s.Manifest.Tools) != 2 {
		t.Errorf("expected 2 tools, got %d", len(s.Manifest.Tools))
	}
	if s.Manifest.Tools[0].Name != "hello" {
		t.Errorf("expected tool name 'hello', got %q", s.Manifest.Tools[0].Name)
	}
	if s.Manifest.Prompt != "You are a greeting assistant." {
		t.Errorf("unexpected prompt: %q", s.Manifest.Prompt)
	}
	if len(s.Manifest.Dependencies) != 1 || s.Manifest.Dependencies[0] != "other-skill" {
		t.Errorf("unexpected dependencies: %v", s.Manifest.Dependencies)
	}
}

func TestLoad_MissingFile(t *testing.T) {
	dir := t.TempDir()
	_, err := Load(dir)
	if err == nil {
		t.Fatal("expected error for missing skill.yaml")
	}
}

func TestLoad_InvalidYAML(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "skill.yaml"), []byte("invalid: [yaml"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err := Load(dir)
	if err == nil {
		t.Fatal("expected error for invalid YAML")
	}
}

func TestLoad_InvalidManifest(t *testing.T) {
	dir := t.TempDir()
	yaml := `name: ""
version: "1.0"
tools: []
`
	if err := os.WriteFile(filepath.Join(dir, "skill.yaml"), []byte(yaml), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err := Load(dir)
	if err == nil {
		t.Fatal("expected error for invalid manifest")
	}
}

func TestSkillTool_PromptType(t *testing.T) {
	s := &Skill{
		Manifest: &Manifest{Name: "test", Version: "1.0"},
		Dir:      "/tmp",
	}
	def := ToolDef{
		Name:        "greet",
		Description: "Greet someone",
		InputSchema: map[string]any{"type": "object"},
	}
	tl := NewSkillTool(def, s)

	if tl.Name() != "greet" {
		t.Errorf("expected name 'greet', got %q", tl.Name())
	}
	if tl.Description() != "Greet someone" {
		t.Errorf("expected description 'Greet someone', got %q", tl.Description())
	}

	result, err := tl.Execute(context.Background(), json.RawMessage(`{"name":"world"}`))
	if err != nil {
		t.Fatal(err)
	}
	if result.Output == nil {
		t.Error("expected non-nil output")
	}
}

func TestSkillTool_ScriptType(t *testing.T) {
	s := &Skill{
		Manifest: &Manifest{Name: "test", Version: "1.0"},
		Dir:      "/tmp",
	}
	def := ToolDef{
		Name:        "run",
		Description: "Run a script",
		Type:        "script",
		Command:     "/bin/echo",
		Args:        []string{"hello"},
	}
	tl := NewSkillTool(def, s)

	result, err := tl.Execute(context.Background(), json.RawMessage(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	if result.Output == nil {
		t.Error("expected non-nil output")
	}
}

func TestSkillTool_ScriptType_NoCommand(t *testing.T) {
	s := &Skill{
		Manifest: &Manifest{Name: "test", Version: "1.0"},
		Dir:      "/tmp",
	}
	def := ToolDef{
		Name:        "run",
		Description: "Run a script",
		Type:        "script",
	}
	tl := NewSkillTool(def, s)

	_, err := tl.Execute(context.Background(), json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("expected error for script without command")
	}
}

func TestLoader_LoadAll(t *testing.T) {
	dir := t.TempDir()

	// Create two skills.
	skill1Dir := filepath.Join(dir, "skill-1")
	os.MkdirAll(skill1Dir, 0o755)
	os.WriteFile(filepath.Join(skill1Dir, "skill.yaml"), []byte(`name: skill-1
version: "1.0"
description: First skill
tools:
  - name: tool1
    description: Tool 1
`), 0o644)

	skill2Dir := filepath.Join(dir, "skill-2")
	os.MkdirAll(skill2Dir, 0o755)
	os.WriteFile(filepath.Join(skill2Dir, "skill.yaml"), []byte(`name: skill-2
version: "2.0"
description: Second skill
tools:
  - name: tool2
    description: Tool 2
`), 0o644)

	loader := NewLoader(dir)
	skills, err := loader.LoadAll()
	if err != nil {
		t.Fatal(err)
	}

	if len(skills) != 2 {
		t.Fatalf("expected 2 skills, got %d", len(skills))
	}

	// Should be sorted by name.
	if skills[0].Manifest.Name != "skill-1" {
		t.Errorf("expected first skill 'skill-1', got %q", skills[0].Manifest.Name)
	}
	if skills[1].Manifest.Name != "skill-2" {
		t.Errorf("expected second skill 'skill-2', got %q", skills[1].Manifest.Name)
	}
}

func TestLoader_LoadAll_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	loader := NewLoader(dir)
	skills, err := loader.LoadAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(skills) != 0 {
		t.Errorf("expected 0 skills, got %d", len(skills))
	}
}

func TestLoader_LoadAll_NonexistentDir(t *testing.T) {
	loader := NewLoader("/nonexistent/path")
	skills, err := loader.LoadAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(skills) != 0 {
		t.Errorf("expected 0 skills, got %d", len(skills))
	}
}

func TestLoader_LoadByName(t *testing.T) {
	dir := t.TempDir()
	skillDir := filepath.Join(dir, "my-skill")
	os.MkdirAll(skillDir, 0o755)
	os.WriteFile(filepath.Join(skillDir, "skill.yaml"), []byte(`name: my-skill
version: "1.0"
description: My skill
tools:
  - name: tool1
    description: Tool 1
`), 0o644)

	loader := NewLoader(dir)
	s, err := loader.LoadByName("my-skill")
	if err != nil {
		t.Fatal(err)
	}
	if s.Manifest.Name != "my-skill" {
		t.Errorf("expected name 'my-skill', got %q", s.Manifest.Name)
	}
}

func TestLoader_LoadByName_NotFound(t *testing.T) {
	dir := t.TempDir()
	loader := NewLoader(dir)
	_, err := loader.LoadByName("nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent skill")
	}
}

func TestTools(t *testing.T) {
	s := &Skill{
		Manifest: &Manifest{
			Name:    "test",
			Version: "1.0",
			Tools: []ToolDef{
				{Name: "a", Description: "A"},
				{Name: "b", Description: "B"},
			},
		},
	}
	tools := Tools(s)
	if len(tools) != 2 {
		t.Fatalf("expected 2 tools, got %d", len(tools))
	}
	if tools[0].Name() != "a" || tools[1].Name() != "b" {
		t.Errorf("unexpected tool names: %s, %s", tools[0].Name(), tools[1].Name())
	}
}

func TestAllTools(t *testing.T) {
	skills := []*Skill{
		{Manifest: &Manifest{Name: "s1", Version: "1.0", Tools: []ToolDef{{Name: "a", Description: "A"}}}},
		{Manifest: &Manifest{Name: "s2", Version: "1.0", Tools: []ToolDef{{Name: "b", Description: "B"}, {Name: "c", Description: "C"}}}},
	}
	tools := AllTools(skills)
	if len(tools) != 3 {
		t.Fatalf("expected 3 tools, got %d", len(tools))
	}
}
