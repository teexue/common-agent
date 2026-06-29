package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/teexue/common-agent/core/agent"
)

// AgentSummary is the lightweight representation of an agent for list endpoints.
type AgentSummary struct {
	Name      string   `json:"name"`
	Provider  string   `json:"provider"`
	Model     string   `json:"model"`
	Tools     []string `json:"tools"`
	MaxTurns  int      `json:"max_turns"`
}

// ListAgents loads all agents and returns summaries. Errors per-agent are logged
// but do not fail the entire request.
func (s *Service) ListAgents() []AgentSummary {
	result, err := agent.LoadAll(s.AgentsDir)
	if err != nil {
		s.Logger.Warn("load all agents", "error", err)
		return nil
	}
	for _, e := range result.Errors {
		s.Logger.Warn("agent load error", "error", e)
	}
	out := make([]AgentSummary, len(result.Agents))
	for i, a := range result.Agents {
		out[i] = AgentSummary{
			Name:     a.Name,
			Provider: a.Provider,
			Model:    a.Model,
			Tools:    a.Tools,
			MaxTurns: a.MaxTurns,
		}
	}
	return out
}

// GetAgent loads a single agent by name. Returns os.ErrNotExist if not found.
func (s *Service) GetAgent(name string) (*agent.Agent, error) {
	name = NormalizeAgentName(name)
	if name == "" {
		return nil, fmt.Errorf("agent name is required")
	}
	return agent.LoadByName(s.AgentsDir, name)
}

// SaveAgent validates and persists an agent YAML file.
func (s *Service) SaveAgent(name string, yamlContent []byte) error {
	name = NormalizeAgentName(name)
	if name == "" {
		return fmt.Errorf("agent name is required")
	}
	if len(yamlContent) == 0 {
		return fmt.Errorf("agent YAML content is required")
	}
	a, err := agent.LoadFromBytes(yamlContent)
	if err != nil {
		return fmt.Errorf("invalid agent YAML: %w", err)
	}
	if a.Name != name {
		return fmt.Errorf("agent name %q does not match URL %q", a.Name, name)
	}
	path := filepath.Join(s.AgentsDir, name+".yaml")
	if err := os.WriteFile(path, yamlContent, 0o644); err != nil {
		return fmt.Errorf("write agent file: %w", err)
	}
	s.Logger.Info("agent saved", "name", name)
	return nil
}

// DeleteAgent removes an agent YAML file. Returns os.ErrNotExist if not found.
func (s *Service) DeleteAgent(name string) error {
	name = NormalizeAgentName(name)
	if name == "" {
		return fmt.Errorf("agent name is required")
	}
	path := filepath.Join(s.AgentsDir, name+".yaml")
	if err := os.Remove(path); err != nil {
		return err
	}
	s.Logger.Info("agent deleted", "name", name)
	return nil
}

// NormalizeAgentName strips .yaml suffix and normalizes the agent name.
func NormalizeAgentName(name string) string {
	return strings.TrimSuffix(strings.TrimSpace(name), ".yaml")
}
