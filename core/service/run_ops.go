package service

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/mcp"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/skill"
	"github.com/teexue/common-agent/tools/registry"
)

// RunRequest is the transport-agnostic DTO for a run request.
type RunRequest struct {
	Agent     string              `json:"agent"`
	Prompt    string              `json:"prompt"`
	SessionID string              `json:"session_id,omitempty"`
	Messages  []provider.Message  `json:"messages,omitempty"`
	WorkDir   string              `json:"workdir,omitempty"`
	Images    []provider.ContentPart `json:"images,omitempty"`
}

// RunResult holds the outcome of a run preparation.
type RunResult struct {
	Config        loop.Config
	Session       *session.Session
	TempToolNames []string // skill tools registered during preparation; caller should unregister
	MCPManager    *mcp.Manager // MCP manager connected during preparation; caller must close
	MCPToolNames  []string     // MCP tools registered during preparation; caller should unregister
}

// Cleanup unregisters temporary tools and closes the MCP manager.
// Callers should defer this once the run's events are fully consumed.
func (r *RunResult) Cleanup(reg *registry.Registry) {
	if r == nil {
		return
	}
	if len(r.TempToolNames) > 0 && reg != nil {
		reg.UnregisterBatch(r.TempToolNames)
	}
	if len(r.MCPToolNames) > 0 && reg != nil {
		reg.UnregisterBatch(r.MCPToolNames)
	}
	if r.MCPManager != nil {
		r.MCPManager.Close()
	}
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

	a, err := agent.Resolve(s.AgentsDir, NormalizeAgentName(req.Agent))
	if err != nil {
		return nil, fmt.Errorf("load agent: %w", err)
	}

	// Load context file from working directory (AGENTS.md > CLAUDE.md).
	a.ProjectContext = loadContextFile(req.WorkDir)

	// Inject skill tools into the registry.
	tempToolNames := injectSkills(a, s.AgentsDir, s.Registry, s.Logger)

	p, err := s.NewProvider(a)
	if err != nil {
		return nil, &ServerError{Message: fmt.Sprintf("create provider: %v", err)}
	}

	var sess *session.Session
	if req.SessionID != "" {
		if s.Store == nil {
			return nil, &ArgError{Field: "session_id", Message: "session persistence not configured"}
		}
		loaded, err := s.Store.Load(req.SessionID)
		if err != nil {
			return nil, fmt.Errorf("load session %s: %w", req.SessionID, err)
		}
		sess = loaded
	} else {
		sess = session.New(a.ID)
		sess.EnsureTitle(req.Prompt)
	}
	if len(req.Messages) > 0 {
		sess.SetMessages(req.Messages)
	}

	// Connect MCP servers (global + agent) last, so subprocesses only spawn
	// once the run is otherwise guaranteed to proceed.
	mcpMgr, mcpToolNames := injectMCP(ctx, a, s.AgentsDir, s.Registry, s.Logger)

	var pol permission.Policy
	if a.Permissions != nil {
		pol = permission.NewAgentPolicy(*a.Permissions)
	} else {
		pol = permission.AllowAllPolicy{}
	}

	cfg := loop.Config{
		Provider:  p,
		Registry:  s.Registry,
		Agent:     a,
		Session:   sess,
		Prompt:    req.Prompt,
		Logger:    s.Logger,
		Store:     s.Store,
		SessionID: req.SessionID,
		Policy:    pol,
		Approver:  approver,
		WorkDir:   req.WorkDir,
		Images:    req.Images,
	}

	return &RunResult{
		Config:        cfg,
		Session:       sess,
		TempToolNames: tempToolNames,
		MCPManager:    mcpMgr,
		MCPToolNames:  mcpToolNames,
	}, nil
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
		log.Warn("log.skill.load_partial", "error", err)
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
					log.Warn("log.skill.register_tool", "tool", t.Name(), "error", err)
					continue
				}
				tempToolNames = append(tempToolNames, t.Name())
			}
		}
	}

	if len(sections) > 0 {
		a.SkillsContext = "# Available Skills\n\n" + joinSections(sections)
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
			log.Warn("log.skill.not_found", "agent", a.Name, "skill", name)
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

// loadContextFile loads AGENTS.md or CLAUDE.md from the working directory.
// Priority: AGENTS.md > CLAUDE.md. Returns empty string if neither exists.
func loadContextFile(workDir string) string {
	if workDir == "" {
		return ""
	}
	candidates := []string{"AGENTS.md", "CLAUDE.md"}
	for _, name := range candidates {
		path := filepath.Join(workDir, name)
		data, err := os.ReadFile(path)
		if err == nil && len(data) > 0 {
			return string(data)
		}
	}
	return ""
}
