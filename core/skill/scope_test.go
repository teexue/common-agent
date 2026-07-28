package skill

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeTestSkill(t *testing.T, root, name, desc string) string {
	t.Helper()
	dir := filepath.Join(root, name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	content := []byte("---\nname: " + name + "\ndescription: " + desc + "\n---\n\n# Instructions\n")
	if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), content, 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestLoadScopedOverride(t *testing.T) {
	home := t.TempDir()
	globalDir := filepath.Join(home, "skills")
	agentDir := filepath.Join(home, "agent-skills", "demo")

	writeTestSkill(t, globalDir, "shared", "global version")
	writeTestSkill(t, globalDir, "global-only", "only in global")
	writeTestSkill(t, agentDir, "shared", "agent version")
	writeTestSkill(t, agentDir, "agent-only", "only for agent")

	skills, err := LoadScoped(globalDir, agentDir, "demo")
	if err != nil {
		t.Fatalf("LoadScoped: %v", err)
	}
	if len(skills) != 3 {
		t.Fatalf("expected 3 skills, got %d", len(skills))
	}

	byName := make(map[string]*Skill, len(skills))
	for _, s := range skills {
		byName[s.Name] = s
	}
	if got := byName["shared"].Description; got != "agent version" {
		t.Errorf("agent scope should override global, got %q", got)
	}
	if byName["shared"].Scope != ScopeAgent || byName["shared"].Agent != "demo" {
		t.Errorf("shared should be tagged agent/demo, got %s/%s", byName["shared"].Scope, byName["shared"].Agent)
	}
	if byName["global-only"].Scope != ScopeGlobal {
		t.Errorf("global-only should be global scope, got %s", byName["global-only"].Scope)
	}
}

func TestLoadAllScoped(t *testing.T) {
	home := t.TempDir()
	globalDir := filepath.Join(home, "skills")
	root := filepath.Join(home, "agent-skills")

	writeTestSkill(t, globalDir, "g1", "global one")
	writeTestSkill(t, filepath.Join(root, "a1"), "s1", "agent a1 skill")
	writeTestSkill(t, filepath.Join(root, "a2"), "s1", "agent a2 skill")

	skills, err := LoadAllScoped(globalDir, root)
	if err != nil {
		t.Fatalf("LoadAllScoped: %v", err)
	}
	if len(skills) != 3 {
		t.Fatalf("expected 3 skills (duplicates across agents kept), got %d", len(skills))
	}
	var a1, a2 int
	for _, s := range skills {
		if s.Scope == ScopeAgent && s.Agent == "a1" {
			a1++
		}
		if s.Scope == ScopeAgent && s.Agent == "a2" {
			a2++
		}
	}
	if a1 != 1 || a2 != 1 {
		t.Errorf("expected one skill per agent, got a1=%d a2=%d", a1, a2)
	}
}

func TestWriteSkillRoundTrip(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "pdf-tools")
	fm := &SkillFrontmatter{
		Name:         "pdf-tools",
		Description:  "Extract PDF text.",
		License:      "Apache-2.0",
		AllowedTools: "Read Bash(pdf:*)",
		Metadata:     map[string]string{"author": "tester"},
	}
	if err := WriteSkill(dir, fm, "# PDF\n\nDo PDF things."); err != nil {
		t.Fatalf("WriteSkill: %v", err)
	}

	md, err := LoadSkillMD(dir)
	if err != nil {
		t.Fatalf("LoadSkillMD after write: %v", err)
	}
	if md.Frontmatter.Name != fm.Name || md.Frontmatter.License != fm.License ||
		md.Frontmatter.AllowedTools != fm.AllowedTools || md.Frontmatter.Metadata["author"] != "tester" {
		t.Errorf("frontmatter round-trip mismatch: %+v", md.Frontmatter)
	}
	if md.Body != "# PDF\n\nDo PDF things." {
		t.Errorf("body mismatch: %q", md.Body)
	}
}

func TestWriteSkillErrors(t *testing.T) {
	tests := []struct {
		name    string
		dir     string
		fm      *SkillFrontmatter
		wantErr string
	}{
		{
			name:    "dir name mismatch",
			dir:     filepath.Join(t.TempDir(), "other-dir"),
			fm:      &SkillFrontmatter{Name: "pdf-tools", Description: "d"},
			wantErr: "must match",
		},
		{
			name:    "invalid name",
			dir:     filepath.Join(t.TempDir(), "PDF-Tools"),
			fm:      &SkillFrontmatter{Name: "PDF-Tools", Description: "d"},
			wantErr: "invalid character",
		},
		{
			name:    "missing description",
			dir:     filepath.Join(t.TempDir(), "pdf-tools"),
			fm:      &SkillFrontmatter{Name: "pdf-tools"},
			wantErr: "description is required",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := WriteSkill(tt.dir, tt.fm, "body")
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("expected error containing %q, got %v", tt.wantErr, err)
			}
		})
	}
}

func TestRemoveSkill(t *testing.T) {
	root := t.TempDir()
	dir := writeTestSkill(t, root, "doomed", "to be removed")

	if err := RemoveSkill(dir); err != nil {
		t.Fatalf("RemoveSkill: %v", err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Errorf("dir should be gone, stat err = %v", err)
	}
	if err := RemoveSkill(dir); err == nil {
		t.Errorf("second remove should fail")
	}
}
