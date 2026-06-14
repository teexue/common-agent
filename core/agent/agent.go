package agent

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/teexue/common-agent/core/permission"
	"gopkg.in/yaml.v3"
)

// ToolExecution configures tool execution strategy.
type ToolExecution struct {
	Mode        string `yaml:"mode"`         // "parallel" | "serial"
	MaxParallel int    `yaml:"max_parallel"` // max concurrent tools, default 4
}

// Agent configures agent behavior for a production use case.
type Agent struct {
	Version       int                     `yaml:"version"`
	Name          string                  `yaml:"name"`
	Provider      string                  `yaml:"provider"`
	SystemPrompt  string                  `yaml:"system_prompt"`
	Tools         []string                `yaml:"tools"`
	Model         string                  `yaml:"model"`
	MaxTurns      int                     `yaml:"max_turns"`
	MaxTokens     int                     `yaml:"max_tokens"`
	ToolExecution *ToolExecution          `yaml:"tool_execution,omitempty"`
	Permissions   *permission.Permissions `yaml:"permissions,omitempty"`
}

const (
	defaultMaxTurns     = 10
	defaultMaxTokens    = 4096
	defaultMaxParallel  = 4
	defaultToolExecMode = "parallel"
)

// ToolExecMode returns the configured tool execution mode with defaults.
func (a *Agent) ToolExecMode() string {
	if a.ToolExecution == nil || a.ToolExecution.Mode == "" {
		return defaultToolExecMode
	}
	return a.ToolExecution.Mode
}

// ToolMaxParallel returns the max parallel tools with defaults.
func (a *Agent) ToolMaxParallel() int {
	if a.ToolExecution == nil || a.ToolExecution.MaxParallel <= 0 {
		return defaultMaxParallel
	}
	return a.ToolExecution.MaxParallel
}

// Load reads and validates an agent YAML file.
func Load(path string) (*Agent, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read agent %q: %w", path, err)
	}
	var a Agent
	if err := yaml.Unmarshal(data, &a); err != nil {
		return nil, fmt.Errorf("parse agent %q: %w", path, err)
	}
	if err := a.validate(); err != nil {
		return nil, fmt.Errorf("validate agent %q: %w", path, err)
	}
	return &a, nil
}

// LoadByName loads agents/{name}.yaml from dir.
func LoadByName(dir, name string) (*Agent, error) {
	path := filepath.Join(dir, name+".yaml")
	return Load(path)
}

func (a *Agent) validate() error {
	if a.Version == 0 {
		a.Version = 1
	}
	if a.Version != 1 {
		return fmt.Errorf("unsupported agent version %d", a.Version)
	}
	if a.Name == "" {
		return fmt.Errorf("name is required")
	}
	if a.Provider == "" {
		return fmt.Errorf("provider is required")
	}
	if a.SystemPrompt == "" {
		return fmt.Errorf("system_prompt is required")
	}
	if a.Model == "" {
		return fmt.Errorf("model is required")
	}
	if a.MaxTurns <= 0 {
		a.MaxTurns = defaultMaxTurns
	}
	if a.MaxTokens <= 0 {
		a.MaxTokens = defaultMaxTokens
	}
	if len(a.Tools) == 0 {
		return fmt.Errorf("tools must not be empty")
	}
	if a.ToolExecution != nil {
		switch a.ToolExecution.Mode {
		case "", "parallel":
			a.ToolExecution.Mode = "parallel"
		case "serial":
		default:
			return fmt.Errorf("tool_execution.mode must be 'parallel' or 'serial', got %q", a.ToolExecution.Mode)
		}
		if a.ToolExecution.MaxParallel <= 0 {
			a.ToolExecution.MaxParallel = 4
		}
	} else {
		a.ToolExecution = &ToolExecution{Mode: "parallel", MaxParallel: 4}
	}
	return nil
}

// ListAvailable returns the names of all agent YAML files in dir.
// Each name is the filename without the .yaml extension.
func ListAvailable(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read agents dir %q: %w", dir, err)
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

// LoadAndValidate loads an agent and validates that all referenced tools
// exist in the provided toolNames list. This is an optional enhanced validation
// step; callers decide whether to use it.
func LoadAndValidate(path string, toolNames []string) (*Agent, error) {
	a, err := Load(path)
	if err != nil {
		return nil, err
	}
	nameSet := make(map[string]bool, len(toolNames))
	for _, n := range toolNames {
		nameSet[n] = true
	}
	var missing []string
	for _, t := range a.Tools {
		if !nameSet[t] {
			missing = append(missing, t)
		}
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("agent %q references unregistered tools: %v", a.Name, missing)
	}
	return a, nil
}

// LoadByNameAndValidate loads an agent by name and validates tools.
func LoadByNameAndValidate(dir, name string, toolNames []string) (*Agent, error) {
	path := filepath.Join(dir, name+".yaml")
	return LoadAndValidate(path, toolNames)
}

// AgentLoadError records a single agent YAML file that failed to load.
type AgentLoadError struct {
	Name string // filename without .yaml
	Path string // full file path
	Err  error  // the underlying error
}

// Error implements the error interface.
func (e AgentLoadError) Error() string {
	return fmt.Sprintf("agent %q (%s): %v", e.Name, e.Path, e.Err)
}

// LoadAllResult is the outcome of bulk-loading all agents in a directory.
type LoadAllResult struct {
	Agents []*Agent
	Errors []AgentLoadError
}

// LoadAll loads every .yaml file in dir, validates each agent, and returns
// both successes and failures. It never fails fast: every file is attempted.
// The returned agents are sorted by Name ascending. Directory-level errors
// (e.g. the agents directory cannot be read) are returned as the outer error.
func LoadAll(dir string) (*LoadAllResult, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read agents dir %q: %w", dir, err)
	}

	var result LoadAllResult
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".yaml")
		path := filepath.Join(dir, e.Name())

		a, err := Load(path)
		if err != nil {
			result.Errors = append(result.Errors, AgentLoadError{
				Name: name,
				Path: path,
				Err:  err,
			})
			continue
		}
		result.Agents = append(result.Agents, a)
	}

	sort.Slice(result.Agents, func(i, j int) bool {
		return result.Agents[i].Name < result.Agents[j].Name
	})
	return &result, nil
}

// LoadAllAndValidate loads all agents and validates their tools against the
// provided toolNames list. It mirrors the Load/LoadAndValidate pattern.
func LoadAllAndValidate(dir string, toolNames []string) (*LoadAllResult, error) {
	result, err := LoadAll(dir)
	if err != nil {
		return nil, err
	}

	nameSet := make(map[string]bool, len(toolNames))
	for _, n := range toolNames {
		nameSet[n] = true
	}

	var validated []*Agent
	for _, a := range result.Agents {
		var missing []string
		for _, t := range a.Tools {
			if !nameSet[t] {
				missing = append(missing, t)
			}
		}
		if len(missing) > 0 {
			result.Errors = append(result.Errors, AgentLoadError{
				Name: a.Name,
				Path: filepath.Join(dir, a.Name+".yaml"),
				Err:  fmt.Errorf("references unregistered tools: %v", missing),
			})
			continue
		}
		validated = append(validated, a)
	}
	result.Agents = validated
	return result, nil
}
