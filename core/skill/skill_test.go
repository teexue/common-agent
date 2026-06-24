package skill

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ─── Agent Skills Standard (SKILL.md) ────────────────────────────

func TestSkillFrontmatter_Validate(t *testing.T) {
	tests := []struct {
		name    string
		fm      SkillFrontmatter
		wantErr bool
	}{
		{"valid", SkillFrontmatter{Name: "my-skill", Description: "Does things"}, false},
		{"missing name", SkillFrontmatter{Description: "Does things"}, true},
		{"missing description", SkillFrontmatter{Name: "my-skill"}, true},
		{"uppercase", SkillFrontmatter{Name: "My-Skill", Description: "Does things"}, true},
		{"starts with hyphen", SkillFrontmatter{Name: "-my-skill", Description: "Does things"}, true},
		{"ends with hyphen", SkillFrontmatter{Name: "my-skill-", Description: "Does things"}, true},
		{"consecutive hyphens", SkillFrontmatter{Name: "my--skill", Description: "Does things"}, true},
		{"name too long", SkillFrontmatter{Name: strings.Repeat("a", 65), Description: "Does things"}, true},
		{"desc too long", SkillFrontmatter{Name: "my-skill", Description: strings.Repeat("a", 1025)}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.fm.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestLoadSkillMD(t *testing.T) {
	dir := t.TempDir()
	md := `---
name: test-skill
description: A test skill for testing
metadata:
  author: test
  version: "1.0"
---

# Test Skill

This is a test skill.

## Instructions

1. Do thing A
2. Do thing B
`
	if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(md), 0o644); err != nil {
		t.Fatal(err)
	}

	s, err := LoadSkillMD(dir)
	if err != nil {
		t.Fatal(err)
	}

	if s.Frontmatter.Name != "test-skill" {
		t.Errorf("expected name 'test-skill', got %q", s.Frontmatter.Name)
	}
	if s.Frontmatter.Description != "A test skill for testing" {
		t.Errorf("unexpected description: %q", s.Frontmatter.Description)
	}
	if s.Frontmatter.Metadata["author"] != "test" {
		t.Errorf("unexpected author: %q", s.Frontmatter.Metadata["author"])
	}
	if !strings.Contains(s.Body, "Do thing A") {
		t.Error("expected body to contain instructions")
	}
}

func TestLoadSkillMD_Minimal(t *testing.T) {
	dir := t.TempDir()
	md := `---
name: minimal
description: A minimal skill
---
`
	if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(md), 0o644); err != nil {
		t.Fatal(err)
	}

	s, err := LoadSkillMD(dir)
	if err != nil {
		t.Fatal(err)
	}
	if s.Frontmatter.Name != "minimal" {
		t.Errorf("expected name 'minimal', got %q", s.Frontmatter.Name)
	}
}

func TestLoadSkillMD_MissingFile(t *testing.T) {
	_, err := LoadSkillMD(t.TempDir())
	if err == nil {
		t.Fatal("expected error for missing SKILL.md")
	}
}

func TestLoadSkillMD_InvalidFrontmatter(t *testing.T) {
	dir := t.TempDir()
	md := `---
name: ""
description: test
---
`
	if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(md), 0o644); err != nil {
		t.Fatal(err)
	}

	_, err := LoadSkillMD(dir)
	if err == nil {
		t.Fatal("expected error for invalid frontmatter")
	}
}

// ─── Unified Load ────────────────────────────────────────────────

func TestLoad_SkillMD(t *testing.T) {
	dir := t.TempDir()
	md := `---
name: md-skill
description: An MD skill
metadata:
  version: "2.0"
---
Instructions here.
`
	os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(md), 0o644)

	s, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if s.Format != "skill.md" {
		t.Errorf("expected format 'skill.md', got %q", s.Format)
	}
	if s.Name != "md-skill" {
		t.Errorf("expected name 'md-skill', got %q", s.Name)
	}
	if s.Version != "2.0" {
		t.Errorf("expected version '2.0', got %q", s.Version)
	}
}

func TestLoad_Legacy(t *testing.T) {
	dir := t.TempDir()
	yaml := `name: legacy-skill
version: "1.0"
description: A legacy skill
tools:
  - name: hello
    description: Say hello
`
	os.WriteFile(filepath.Join(dir, "skill.yaml"), []byte(yaml), 0o644)

	s, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if s.Format != "skill.yaml" {
		t.Errorf("expected format 'skill.yaml', got %q", s.Format)
	}
	if s.Name != "legacy-skill" {
		t.Errorf("expected name 'legacy-skill', got %q", s.Name)
	}
}

func TestLoad_PrefersSkillMD(t *testing.T) {
	dir := t.TempDir()
	// Both files exist — SKILL.md should win.
	md := `---
name: md-wins
description: MD format preferred
---
`
	yaml := `name: yaml-loses
version: "1.0"
description: YAML format
tools:
  - name: t
    description: d
`
	os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(md), 0o644)
	os.WriteFile(filepath.Join(dir, "skill.yaml"), []byte(yaml), 0o644)

	s, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if s.Format != "skill.md" {
		t.Errorf("expected format 'skill.md', got %q", s.Format)
	}
	if s.Name != "md-wins" {
		t.Errorf("expected name 'md-wins', got %q", s.Name)
	}
}

// ─── Loader ──────────────────────────────────────────────────────

func TestLoader_LoadAll(t *testing.T) {
	dir := t.TempDir()

	// Create an Agent Skills standard skill.
	mdDir := filepath.Join(dir, "md-skill")
	os.MkdirAll(mdDir, 0o755)
	os.WriteFile(filepath.Join(mdDir, "SKILL.md"), []byte(`---
name: md-skill
description: An MD skill
---
Instructions.
`), 0o644)

	// Create a legacy skill.
	legacyDir := filepath.Join(dir, "legacy-skill")
	os.MkdirAll(legacyDir, 0o755)
	os.WriteFile(filepath.Join(legacyDir, "skill.yaml"), []byte(`name: legacy-skill
version: "1.0"
description: A legacy skill
tools:
  - name: tool1
    description: Tool 1
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
	if skills[0].Name != "legacy-skill" {
		t.Errorf("expected first skill 'legacy-skill', got %q", skills[0].Name)
	}
	if skills[1].Name != "md-skill" {
		t.Errorf("expected second skill 'md-skill', got %q", skills[1].Name)
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
	os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte(`---
name: my-skill
description: My skill
---
`), 0o644)

	loader := NewLoader(dir)
	s, err := loader.LoadByName("my-skill")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "my-skill" {
		t.Errorf("expected name 'my-skill', got %q", s.Name)
	}
}

// ─── Legacy SkillTool ────────────────────────────────────────────

func TestSkillTool_PromptType(t *testing.T) {
	legacy := &LegacySkill{
		Manifest: &LegacyManifest{Name: "test", Version: "1.0"},
		Dir:      t.TempDir(),
	}
	def := ToolDef{
		Name:        "greet",
		Description: "Greet someone",
		InputSchema: map[string]any{"type": "object"},
	}
	tl := NewSkillTool(def, legacy)

	if tl.Name() != "greet" {
		t.Errorf("expected name 'greet', got %q", tl.Name())
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
	legacy := &LegacySkill{
		Manifest: &LegacyManifest{Name: "test", Version: "1.0"},
		Dir:      t.TempDir(),
	}
	def := ToolDef{
		Name:        "run",
		Description: "Run a script",
		Type:        "script",
		Command:     "/bin/echo",
		Args:        []string{"hello"},
	}
	tl := NewSkillTool(def, legacy)

	result, err := tl.Execute(context.Background(), json.RawMessage(`{}`))
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(result.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["exit_code"].(float64) != 0 {
		t.Fatalf("expected exit_code 0, got %v", out["exit_code"])
	}
	if out["stdout"] != "hello\n" {
		t.Fatalf("expected stdout 'hello\\n', got %q", out["stdout"])
	}
}

func TestSkillTool_ScriptType_Failure(t *testing.T) {
	legacy := &LegacySkill{
		Manifest: &LegacyManifest{Name: "test", Version: "1.0"},
		Dir:      t.TempDir(),
	}
	def := ToolDef{
		Name:        "fail",
		Description: "A failing script",
		Type:        "script",
		Command:     "/bin/sh",
		Args:        []string{"-c", "exit 42"},
	}
	tl := NewSkillTool(def, legacy)

	result, err := tl.Execute(context.Background(), json.RawMessage(`{}`))
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	json.Unmarshal(result.Output, &out)
	if out["exit_code"].(float64) != 42 {
		t.Fatalf("expected exit_code 42, got %v", out["exit_code"])
	}
}

func TestSkillTool_ScriptType_NoCommand(t *testing.T) {
	legacy := &LegacySkill{
		Manifest: &LegacyManifest{Name: "test", Version: "1.0"},
		Dir:      t.TempDir(),
	}
	def := ToolDef{
		Name:        "run",
		Description: "Run a script",
		Type:        "script",
	}
	tl := NewSkillTool(def, legacy)

	_, err := tl.Execute(context.Background(), json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("expected error for script without command")
	}
}

func TestTools_Legacy(t *testing.T) {
	s := &Skill{
		Name:        "test",
		Description: "test",
		Version:     "1.0",
		Format:      "skill.yaml",
		LegacyManifest: &LegacyManifest{
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
}

func TestTools_SkillMD(t *testing.T) {
	s := &Skill{
		Name:        "test",
		Description: "test",
		Format:      "skill.md",
		MDManifest:  &SkillManifest{},
	}
	tools := Tools(s)
	if tools != nil {
		t.Fatalf("expected nil tools for SKILL.md skill, got %d", len(tools))
	}
}
