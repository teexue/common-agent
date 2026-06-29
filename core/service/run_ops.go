package service

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/skill"
	"github.com/teexue/common-agent/tools/registry"
)

// RunRequest is the transport-agnostic DTO for a run request.
type RunRequest struct {
	Agent     string             `json:"agent"`
	Prompt    string             `json:"prompt"`
	SessionID string             `json:"session_id,omitempty"`
	Messages  []provider.Message `json:"messages,omitempty"`
	WorkDir   string             `json:"workdir,omitempty"`
}

// RunResult holds the outcome of a run preparation.
type RunResult struct {
	Config        loop.Config
	Session       *session.Session
	TempToolNames []string // skill tools registered during preparation; caller should unregister
}

// PrepareRun validates the request, loads the agent, resolves the provider,
// and constructs the loop.Config. The caller is responsible for calling
// loop.Run with the returned config and streaming the events.
func (s *Service) PrepareRun(ctx context.Context, req RunRequest, approver loop.Approver) (*RunResult, error) {
	if req.Agent == "" {
		return nil, &ArgError{Field: "agent", Message: "agent is required"}
	}
	if req.Prompt == "" {
		return nil, &ArgError{Field: "prompt", Message: "prompt is required"}
	}

	a, err := agent.LoadByName(s.AgentsDir, NormalizeAgentName(req.Agent))
	if err != nil {
		return nil, fmt.Errorf("load agent: %w", err)
	}

	// Inject skill tools into the registry.
	tempToolNames := injectSkills(a, s.AgentsDir, s.Registry, s.Logger)

	p, err := s.NewProvider(a)
	if err != nil {
		return nil, &ServerError{Message: fmt.Sprintf("create provider: %v", err)}
	}

	sess := session.New(a.Name)
	if len(req.Messages) > 0 {
		sess.SetMessages(req.Messages)
	}

	var pol permission.Policy
	if a.Permissions != nil {
		pol = permission.NewAgentPolicy(*a.Permissions)
	} else {
		pol = permission.AllowAllPolicy{}
	}

	cfg := loop.Config{
		Provider: p,
		Registry: s.Registry,
		Agent:    a,
		Session:  sess,
		Prompt:   req.Prompt,
		Logger:   s.Logger,
		Store:    s.Store,
		Policy:   pol,
		Approver: approver,
		WorkDir:  req.WorkDir,
	}

	if req.SessionID != "" {
		if s.Store == nil {
			return nil, &ArgError{Field: "session_id", Message: "session persistence not configured"}
		}
		if _, err := s.Store.Load(req.SessionID); err != nil {
			return nil, fmt.Errorf("load session: %w", err)
		}
		cfg.SessionID = req.SessionID
	}

	return &RunResult{Config: cfg, Session: sess, TempToolNames: tempToolNames}, nil
}

// ToolSummary is the lightweight representation of a tool for list endpoints.
type ToolSummary struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters,omitempty"`
}

// ListToolSummaries returns summaries of all registered tools.
func (s *Service) ListToolSummaries() []ToolSummary {
	defs := s.Registry.List()
	out := make([]ToolSummary, len(defs))
	for i, d := range defs {
		out[i] = ToolSummary{
			Name:        d.Name(),
			Description: d.Description(),
			Parameters:  d.InputSchema(),
		}
	}
	return out
}

// ArgError represents a client argument error (400-level).
type ArgError struct {
	Field   string
	Message string
}

func (e *ArgError) Error() string { return e.Message }

// ServerError represents a server-side error (500-level).
type ServerError struct {
	Message string
}

func (e *ServerError) Error() string { return e.Message }

// injectSkills loads skills referenced by the agent, registers their tools,
// and appends skill instructions to the agent's system prompt.
// Returns the names of temporarily registered tools for caller cleanup.
func injectSkills(a *agent.Agent, agentsDir string, reg *registry.Registry, log *slog.Logger) []string {
	skillsDir := filepath.Join(filepath.Dir(agentsDir), "skills")
	loader := skill.NewLoader(skillsDir)
	allSkills, err := loader.LoadAll()
	if err != nil {
		log.Warn("some skills failed to load", "error", err)
	}
	if len(allSkills) == 0 {
		return nil
	}

	selected := filterSkills(a, allSkills, log)
	if len(selected) == 0 {
		return nil
	}

	var sections []string
	var tempToolNames []string
	for _, sk := range selected {
		if body := sk.Body(); body != "" {
			sections = append(sections, fmt.Sprintf("[[skill:%s]]\n%s", sk.Name, body))
		}
		if sk.LegacyManifest != nil {
			for _, t := range skill.Tools(sk) {
				if err := reg.Register(t); err != nil {
					log.Warn("register skill tool", "tool", t.Name(), "error", err)
					continue
				}
				tempToolNames = append(tempToolNames, t.Name())
			}
		}
	}

	if len(sections) > 0 {
		a.SystemPrompt += "\n\n# Available Skills\n\n" + joinSections(sections)
	}

	return tempToolNames
}

func filterSkills(a *agent.Agent, all []*skill.Skill, log *slog.Logger) []*skill.Skill {
	if len(a.Skills) == 0 {
		return all
	}
	byName := make(map[string]*skill.Skill, len(all))
	for _, sk := range all {
		byName[sk.Name] = sk
	}
	var selected []*skill.Skill
	for _, name := range a.Skills {
		if sk, ok := byName[name]; ok {
			selected = append(selected, sk)
		} else {
			log.Warn("skill not found", "agent", a.Name, "skill", name)
		}
	}
	return selected
}

func joinSections(sections []string) string {
	result := ""
	for i, s := range sections {
		if i > 0 {
			result += "\n\n"
		}
		result += s
	}
	return result
}
