package service

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/auth"
	"github.com/teexue/common-agent/core/config"
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

	// In-pipeline prompt optimization (agent-driven, non-fatal).
	// The system prompt is optimized once per content (memoized); the user
	// prompt is optimized per run. The session title keeps the raw prompt.
	OptimizeSystemPrompt(ctx, &s.optimizeCache, a, p, s.Logger)
	prompt := OptimizeUserPrompt(ctx, a, p, req.Prompt, s.Logger)

	userID := auth.IdentityFromContext(ctx).UserID
	var sess *session.Session
	if req.SessionID != "" {
		if s.Store == nil {
			return nil, &ArgError{Field: "session_id", Message: "session persistence not configured"}
		}
		loaded, err := s.LoadSession(req.SessionID, userID)
		if err != nil {
			return nil, fmt.Errorf("load session %s: %w", req.SessionID, err)
		}
		sess = loaded
	} else {
		sess = session.NewForUser(a.ID, userID)
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
		Prompt:    prompt,
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

// injectSkills loads skills available to the agent (global + agent-scoped),
// registers the progressive-disclosure load_skill tool plus any legacy skill
// tools, and appends the metadata listing to the agent's system prompt.
// Returns the names of temporarily registered tools for caller cleanup.
func injectSkills(a *agent.Agent, agentsDir string, reg *registry.Registry, log *slog.Logger) []string {
	home := filepath.Dir(agentsDir)
	allSkills, err := skill.LoadScoped(config.SkillsDir(home), config.AgentSkillsDir(home, a.Name), a.Name)
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

	var lines []string
	var tempToolNames []string
	hasMD := false
	for _, sk := range selected {
		if sk.MDManifest != nil {
			hasMD = true
			lines = append(lines, skillListingLine(sk))
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

	if hasMD {
		loader := skill.LoadSkillTool(selected)
		if err := reg.Register(loader); err != nil {
			log.Warn("log.skill.register_tool", "tool", loader.Name(), "error", err)
		} else {
			tempToolNames = append(tempToolNames, loader.Name())
		}
	}

	if len(lines) > 0 {
		a.SkillsContext = "# Available Skills\n\n" +
			"When a task matches a skill's description, call the `load_skill` tool with its name to load the full instructions. " +
			"File references inside instructions are relative to the skill's base directory.\n\n" +
			strings.Join(lines, "\n")
	}

	return tempToolNames
}

// skillListingLine renders one metadata line for the skills system prompt
// (discovery stage of progressive disclosure: name + description only).
func skillListingLine(sk *skill.Skill) string {
	line := fmt.Sprintf("- %s: %s (base_dir: %s)", sk.Name, sk.Description, sk.Dir)
	if sk.MDManifest != nil && sk.MDManifest.Frontmatter.AllowedTools != "" {
		line += fmt.Sprintf(" [allowed-tools: %s]", sk.MDManifest.Frontmatter.AllowedTools)
	}
	return line
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
