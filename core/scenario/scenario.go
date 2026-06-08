package scenario

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// ToolExecution configures tool execution strategy.
type ToolExecution struct {
	Mode        string `yaml:"mode"`         // "parallel" | "serial"
	MaxParallel int    `yaml:"max_parallel"` // max concurrent tools, default 4
}

// Scenario configures agent behavior for a production use case.
type Scenario struct {
	Version       int            `yaml:"version"`
	Name          string         `yaml:"name"`
	Provider      string         `yaml:"provider"`
	SystemPrompt  string         `yaml:"system_prompt"`
	Tools         []string       `yaml:"tools"`
	Model         string         `yaml:"model"`
	MaxTurns      int            `yaml:"max_turns"`
	MaxTokens     int            `yaml:"max_tokens"`
	ToolExecution *ToolExecution `yaml:"tool_execution,omitempty"`
}

const (
	defaultMaxTurns        = 10
	defaultMaxTokens       = 4096
	defaultMaxParallel     = 4
	defaultToolExecMode    = "parallel"
)

// ToolExecMode returns the configured tool execution mode with defaults.
func (s *Scenario) ToolExecMode() string {
	if s.ToolExecution == nil || s.ToolExecution.Mode == "" {
		return defaultToolExecMode
	}
	return s.ToolExecution.Mode
}

// ToolMaxParallel returns the max parallel tools with defaults.
func (s *Scenario) ToolMaxParallel() int {
	if s.ToolExecution == nil || s.ToolExecution.MaxParallel <= 0 {
		return defaultMaxParallel
	}
	return s.ToolExecution.MaxParallel
}

// Load reads and validates a scenario YAML file.
func Load(path string) (*Scenario, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read scenario %q: %w", path, err)
	}
	var s Scenario
	if err := yaml.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("parse scenario %q: %w", path, err)
	}
	if err := s.validate(); err != nil {
		return nil, fmt.Errorf("validate scenario %q: %w", path, err)
	}
	return &s, nil
}

// LoadByName loads scenarios/{name}.yaml from dir.
func LoadByName(dir, name string) (*Scenario, error) {
	path := filepath.Join(dir, name+".yaml")
	return Load(path)
}

func (s *Scenario) validate() error {
	if s.Version == 0 {
		s.Version = 1
	}
	if s.Version != 1 {
		return fmt.Errorf("unsupported scenario version %d", s.Version)
	}
	if s.Name == "" {
		return fmt.Errorf("name is required")
	}
	if s.Provider == "" {
		return fmt.Errorf("provider is required")
	}
	if s.SystemPrompt == "" {
		return fmt.Errorf("system_prompt is required")
	}
	if s.Model == "" {
		return fmt.Errorf("model is required")
	}
	if s.MaxTurns <= 0 {
		s.MaxTurns = defaultMaxTurns
	}
	if s.MaxTokens <= 0 {
		s.MaxTokens = defaultMaxTokens
	}
	if len(s.Tools) == 0 {
		return fmt.Errorf("tools must not be empty")
	}
	if s.ToolExecution != nil {
		switch s.ToolExecution.Mode {
		case "", "parallel":
			s.ToolExecution.Mode = "parallel"
		case "serial":
		default:
			return fmt.Errorf("tool_execution.mode must be 'parallel' or 'serial', got %q", s.ToolExecution.Mode)
		}
		if s.ToolExecution.MaxParallel <= 0 {
			s.ToolExecution.MaxParallel = 4
		}
	} else {
		s.ToolExecution = &ToolExecution{Mode: "parallel", MaxParallel: 4}
	}
	return nil
}

// ListAvailable returns the names of all scenario YAML files in dir.
// Each name is the filename without the .yaml extension.
func ListAvailable(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read scenarios dir %q: %w", dir, err)
	}
	var names []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if strings.HasSuffix(e.Name(), ".yaml") {
			names = append(names, strings.TrimSuffix(e.Name(), ".yaml"))
		}
	}
	sort.Strings(names)
	return names, nil
}

// LoadAndValidate loads a scenario and validates that all referenced tools
// exist in the provided toolNames list. This is an optional enhanced validation
// step; callers decide whether to use it.
func LoadAndValidate(path string, toolNames []string) (*Scenario, error) {
	sc, err := Load(path)
	if err != nil {
		return nil, err
	}
	nameSet := make(map[string]bool, len(toolNames))
	for _, n := range toolNames {
		nameSet[n] = true
	}
	var missing []string
	for _, t := range sc.Tools {
		if !nameSet[t] {
			missing = append(missing, t)
		}
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("scenario %q references unregistered tools: %v", sc.Name, missing)
	}
	return sc, nil
}

// LoadByNameAndValidate loads a scenario by name and validates tools.
func LoadByNameAndValidate(dir, name string, toolNames []string) (*Scenario, error) {
	path := filepath.Join(dir, name+".yaml")
	return LoadAndValidate(path, toolNames)
}
