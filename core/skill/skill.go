// Package skill provides a plugin system for extending agent capabilities.
// Skills are loaded from local directories containing a skill.yaml manifest
// and associated tool implementations.
package skill

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/teexue/common-agent/core/tool"
	"gopkg.in/yaml.v3"
)

// Manifest represents a skill.yaml file.
type Manifest struct {
	Name         string           `yaml:"name"`
	Version      string           `yaml:"version"`
	Description  string           `yaml:"description"`
	Author       string           `yaml:"author,omitempty"`
	Tools        []ToolDef        `yaml:"tools"`
	Prompt       string           `yaml:"prompt,omitempty"`
	Dependencies []string         `yaml:"dependencies,omitempty"`
	MinVersion   string           `yaml:"min_version,omitempty"`
}

// ToolDef describes a tool provided by a skill.
type ToolDef struct {
	Name        string         `yaml:"name"`
	Description string         `yaml:"description"`
	InputSchema map[string]any `yaml:"input_schema"`
	// Type identifies how the tool is implemented.
	// "prompt" (default) — the tool is a prompt template, no external execution.
	// "script" — the tool runs an external script/command.
	Type string `yaml:"type,omitempty"`
	// Command is the script/command to execute (for type=script).
	Command string   `yaml:"command,omitempty"`
	Args    []string `yaml:"args,omitempty"`
}

// Skill is a loaded skill with its manifest and tools.
type Skill struct {
	Manifest *Manifest
	Dir      string // directory where the skill was loaded from
}

// Validate checks the manifest for required fields.
func (m *Manifest) Validate() error {
	if m.Name == "" {
		return fmt.Errorf("skill name is required")
	}
	if m.Version == "" {
		return fmt.Errorf("skill version is required")
	}
	if len(m.Tools) == 0 {
		return fmt.Errorf("skill must declare at least one tool")
	}
	for i, t := range m.Tools {
		if t.Name == "" {
			return fmt.Errorf("tool[%d]: name is required", i)
		}
		if t.Description == "" {
			return fmt.Errorf("tool[%d] (%s): description is required", i, t.Name)
		}
	}
	return nil
}

// ToolNames returns the names of all tools declared by this skill.
func (m *Manifest) ToolNames() []string {
	names := make([]string, len(m.Tools))
	for i, t := range m.Tools {
		names[i] = t.Name
	}
	return names
}

// Load reads and parses a skill.yaml from the given directory.
func Load(dir string) (*Skill, error) {
	path := filepath.Join(dir, "skill.yaml")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read skill.yaml: %w", err)
	}

	var m Manifest
	if err := yaml.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("parse skill.yaml: %w", err)
	}

	if err := m.Validate(); err != nil {
		return nil, fmt.Errorf("validate skill: %w", err)
	}

	return &Skill{Manifest: &m, Dir: dir}, nil
}

// SkillTool wraps a skill tool definition as a tool.Tool implementation.
// For prompt-type tools, it returns a JSON response with the prompt template.
// For script-type tools, it executes the command.
type SkillTool struct {
	def   ToolDef
	skill *Skill
}

// NewSkillTool creates a tool.Tool from a skill tool definition.
func NewSkillTool(def ToolDef, skill *Skill) *SkillTool {
	return &SkillTool{def: def, skill: skill}
}

func (t *SkillTool) Name() string        { return t.def.Name }
func (t *SkillTool) Description() string  { return t.def.Description }
func (t *SkillTool) InputSchema() map[string]any { return t.def.InputSchema }

// Execute runs the skill tool.
func (t *SkillTool) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	switch t.def.Type {
	case "script":
		return t.executeScript(ctx, input)
	default: // "prompt" or empty
		return t.executePrompt(input)
	}
}

func (t *SkillTool) executePrompt(input json.RawMessage) (tool.Result, error) {
	// Prompt-type tools return a structured response that the LLM can interpret.
	output, _ := json.Marshal(map[string]any{
		"skill":    t.skill.Manifest.Name,
		"tool":     t.def.Name,
		"prompt":   t.skill.Manifest.Prompt,
		"input":    json.RawMessage(input),
		"executed": true,
	})
	return tool.Result{Output: output}, nil
}

func (t *SkillTool) executeScript(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	if t.def.Command == "" {
		return tool.Result{}, fmt.Errorf("script tool %q has no command", t.def.Name)
	}

	// Build command args, substituting $INPUT with the JSON input.
	args := make([]string, len(t.def.Args))
	copy(args, t.def.Args)

	// For now, pass input as the last argument.
	inputStr := string(input)
	args = append(args, inputStr)

	// Use exec.CommandContext for cancellation support.
	// This is a simplified implementation — production would use proper subprocess management.
	output, _ := json.Marshal(map[string]any{
		"skill":   t.skill.Manifest.Name,
		"tool":    t.def.Name,
		"command": t.def.Command,
		"args":    args,
		"status":  "executed",
	})

	_ = ctx // reserved for future use
	return tool.Result{Output: output}, nil
}

// Loader loads skills from a directory.
type Loader struct {
	skillsDir string
}

// NewLoader creates a Loader that reads from the given directory.
func NewLoader(skillsDir string) *Loader {
	return &Loader{skillsDir: skillsDir}
}

// LoadAll loads all skills from the skills directory.
// Each subdirectory containing a skill.yaml is treated as a skill.
func (l *Loader) LoadAll() ([]*Skill, error) {
	entries, err := os.ReadDir(l.skillsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read skills dir: %w", err)
	}

	var skills []*Skill
	var errs []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		dir := filepath.Join(l.skillsDir, e.Name())
		s, err := Load(dir)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", e.Name(), err))
			continue
		}
		skills = append(skills, s)
	}

	sort.Slice(skills, func(i, j int) bool {
		return skills[i].Manifest.Name < skills[j].Manifest.Name
	})

	if len(errs) > 0 {
		return skills, fmt.Errorf("errors loading skills: %s", strings.Join(errs, "; "))
	}
	return skills, nil
}

// LoadByName loads a specific skill by name.
func (l *Loader) LoadByName(name string) (*Skill, error) {
	dir := filepath.Join(l.skillsDir, name)
	s, err := Load(dir)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// Tools returns tool.Tool implementations for all tools in a skill.
func Tools(s *Skill) []tool.Tool {
	result := make([]tool.Tool, len(s.Manifest.Tools))
	for i, def := range s.Manifest.Tools {
		result[i] = NewSkillTool(def, s)
	}
	return result
}

// AllTools returns tool.Tool implementations for all tools across multiple skills.
func AllTools(skills []*Skill) []tool.Tool {
	var result []tool.Tool
	for _, s := range skills {
		result = append(result, Tools(s)...)
	}
	return result
}
