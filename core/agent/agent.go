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

// MCPServerConfig describes an MCP server connection in agent YAML.
type MCPServerConfig struct {
	Name    string            `yaml:"name"`
	Type    string            `yaml:"type"` // "stdio" | "sse"
	Command string            `yaml:"command,omitempty"`
	Args    []string          `yaml:"args,omitempty"`
	Env     map[string]string `yaml:"env,omitempty"`
	URL     string            `yaml:"url,omitempty"`
}

// CompactionConfig configures context window compaction.
// Compaction is driven by estimated token usage vs the model context window,
// not by raw message count.
type CompactionConfig struct {
	Strategy      string  `yaml:"strategy"`                 // "truncation" (default) | "sliding_window"
	ContextWindow int     `yaml:"context_window,omitempty"` // model context size in tokens; 0 = use runtime/provider
	TriggerRatio  float64 `yaml:"trigger_ratio,omitempty"`  // compact when usage exceeds window*ratio (default 0.85)
	KeepRecent    int     `yaml:"keep_recent"`              // recent conversation messages to preserve when truncating
	MaxMessages   int     `yaml:"max_messages,omitempty"`   // optional legacy secondary trigger; 0 = disabled
}

// KnowledgeConfig scopes RAG retrieval for an agent.
type KnowledgeConfig struct {
	Bases []string `yaml:"bases,omitempty" json:"bases,omitempty"` // empty = all bases
	TopK  int      `yaml:"top_k,omitempty" json:"top_k,omitempty"`
}

// OptimizeConfig enables in-pipeline prompt optimization for an agent.
// Optimization runs at assembly time (before loop.Run) via an extra LLM call.
type OptimizeConfig struct {
	SystemPrompt bool `yaml:"system_prompt,omitempty" json:"system_prompt,omitempty"` // optimize system prompt once per content (cached)
	UserPrompt   bool `yaml:"user_prompt,omitempty" json:"user_prompt,omitempty"`     // optimize each user prompt before the run
}

// Agent configures agent behavior for a production use case.
type Agent struct {
	Version       int                     `yaml:"version" json:"version"`
	ID            string                  `yaml:"id,omitempty" json:"id"`
	Name          string                  `yaml:"name" json:"name"`
	Provider      string                  `yaml:"provider" json:"provider"`
	SystemPrompt  string                  `yaml:"system_prompt" json:"system_prompt"`
	Tools         []string                `yaml:"tools" json:"tools"`
	Skills        []string                `yaml:"skills,omitempty" json:"skills,omitempty"`
	Model         string                  `yaml:"model" json:"model"`
	MaxTurns      int                     `yaml:"max_turns" json:"max_turns"` // 0 = unlimited until model stops
	MaxTokens     int                     `yaml:"max_tokens" json:"max_tokens"`
	ToolExecution *ToolExecution          `yaml:"tool_execution,omitempty" json:"tool_execution,omitempty"`
	Permissions   *permission.Permissions `yaml:"permissions,omitempty" json:"permissions,omitempty"`
	MCPServers    []MCPServerConfig       `yaml:"mcp_servers,omitempty" json:"mcp_servers,omitempty"`
	Compaction    *CompactionConfig       `yaml:"compaction,omitempty" json:"compaction,omitempty"`
	Knowledge     *KnowledgeConfig        `yaml:"knowledge,omitempty" json:"knowledge,omitempty"`
	Optimize      *OptimizeConfig         `yaml:"optimize,omitempty" json:"optimize,omitempty"`

	// Runtime-only context parts (not persisted in YAML).
	// These are kept separate for prompt caching optimization.
	ProjectContext string `yaml:"-"`
	SkillsContext  string `yaml:"-"`
}

const (
	// MaxTurns 0 means unlimited (run until the model returns without tool calls).
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
// Legacy files without an id field use the filename stem as the id.
func Load(path string) (*Agent, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read agent %q: %w", path, err)
	}
	a, err := LoadFromBytes(data)
	if err != nil {
		return nil, err
	}
	stem := strings.TrimSuffix(filepath.Base(path), ".yaml")
	if a.ID == "" {
		a.ID = stem
	}
	return a, nil
}

// LoadFromBytes parses and validates an agent from raw YAML bytes.
// ID may be empty (assigned on save / from filename on Load).
func LoadFromBytes(data []byte) (*Agent, error) {
	var a Agent
	if err := yaml.Unmarshal(data, &a); err != nil {
		return nil, fmt.Errorf("parse agent: %w", err)
	}
	if err := a.validate(); err != nil {
		return nil, fmt.Errorf("validate agent: %w", err)
	}
	return &a, nil
}

// LoadByID loads agents/{id}.yaml from dir.
func LoadByID(dir, id string) (*Agent, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, fmt.Errorf("agent id is required")
	}
	path := filepath.Join(dir, id+".yaml")
	return Load(path)
}

// LoadByName resolves an agent by id or display name (legacy compatibility).
func LoadByName(dir, ref string) (*Agent, error) {
	return Resolve(dir, ref)
}

// Resolve loads an agent by stable id (filename) or display name.
// Id match takes priority; name match scans all agents.
func Resolve(dir, ref string) (*Agent, error) {
	ref = strings.TrimSuffix(strings.TrimSpace(ref), ".yaml")
	if ref == "" {
		return nil, fmt.Errorf("agent ref is required")
	}
	path := filepath.Join(dir, ref+".yaml")
	if _, err := os.Stat(path); err == nil {
		return Load(path)
	}
	result, err := LoadAll(dir)
	if err != nil {
		return nil, err
	}
	var byName *Agent
	for _, a := range result.Agents {
		if a.ID == ref {
			return a, nil
		}
		if a.Name == ref && byName == nil {
			byName = a
		}
	}
	if byName != nil {
		return byName, nil
	}
	return nil, fmt.Errorf("agent %q: %w", ref, os.ErrNotExist)
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
	// MaxTurns 0 = unlimited (loop until the model stops calling tools).
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
	for i, mcp := range a.MCPServers {
		if mcp.Name == "" {
			return fmt.Errorf("mcp_servers[%d]: name is required", i)
		}
		switch mcp.Type {
		case "stdio":
			if mcp.Command == "" {
				return fmt.Errorf("mcp_servers[%d] (%s): command is required for stdio type", i, mcp.Name)
			}
		case "sse":
			if mcp.URL == "" {
				return fmt.Errorf("mcp_servers[%d] (%s): url is required for sse type", i, mcp.Name)
			}
		default:
			return fmt.Errorf("mcp_servers[%d] (%s): type must be 'stdio' or 'sse', got %q", i, mcp.Name, mcp.Type)
		}
	}
	if a.Compaction != nil {
		switch a.Compaction.Strategy {
		case "", "truncation":
			a.Compaction.Strategy = "truncation"
		case "sliding_window":
		default:
			return fmt.Errorf("compaction.strategy must be 'truncation' or 'sliding_window', got %q", a.Compaction.Strategy)
		}
		if a.Compaction.KeepRecent <= 0 {
			a.Compaction.KeepRecent = 20
		}
		if a.Compaction.TriggerRatio != 0 && (a.Compaction.TriggerRatio < 0 || a.Compaction.TriggerRatio >= 1) {
			return fmt.Errorf("compaction.trigger_ratio must be in (0, 1)")
		}
	}
	if a.Knowledge != nil {
		if a.Knowledge.TopK < 0 {
			return fmt.Errorf("knowledge.top_k must be >= 0")
		}
		if a.Knowledge.TopK == 0 {
			a.Knowledge.TopK = 5
		}
	}
	return nil
}

// ListAvailable returns the ids of all agent YAML files in dir
// (filename without the .yaml extension).
func ListAvailable(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read agents dir %q: %w", dir, err)
	}
	var ids []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if strings.HasSuffix(e.Name(), ".yaml") {
			ids = append(ids, strings.TrimSuffix(e.Name(), ".yaml"))
		}
	}
	sort.Strings(ids)
	return ids, nil
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

// LoadByNameAndValidate loads an agent by id or name and validates tools.
func LoadByNameAndValidate(dir, ref string, toolNames []string) (*Agent, error) {
	a, err := Resolve(dir, ref)
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

// AgentLoadError records a single agent YAML file that failed to load.
type AgentLoadError struct {
	ID   string // filename without .yaml (stable id)
	Name string // display name when known
	Path string // full file path
	Err  error  // the underlying error
}

// Error implements the error interface.
func (e AgentLoadError) Error() string {
	label := e.ID
	if e.Name != "" {
		label = e.Name
	}
	return fmt.Sprintf("agent %q (%s): %v", label, e.Path, e.Err)
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
		id := strings.TrimSuffix(e.Name(), ".yaml")
		path := filepath.Join(dir, e.Name())

		a, err := Load(path)
		if err != nil {
			result.Errors = append(result.Errors, AgentLoadError{
				ID:   id,
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
				ID:   a.ID,
				Name: a.Name,
				Path: filepath.Join(dir, a.ID+".yaml"),
				Err:  fmt.Errorf("references unregistered tools: %v", missing),
			})
			continue
		}
		validated = append(validated, a)
	}
	result.Agents = validated
	return result, nil
}
