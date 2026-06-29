package loop

import (
	"context"
	"log/slog"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/hook"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/telemetry"
	"github.com/teexue/common-agent/core/tool"
)

// ToolRegistry resolves tools by name.
type ToolRegistry interface {
	Get(name string) (tool.Tool, bool)
	Definitions(names []string) ([]provider.ToolDefinition, error)
}

// workDirCtxKey is the context key for the working directory.
// Shared with tools/builtin via the same string value.
const workDirCtxKey = "workdir"

// Config configures a single agent run.
type Config struct {
	Provider provider.Provider
	Registry ToolRegistry
	Agent    *agent.Agent
	Session  *session.Session
	Prompt   string
	Logger   *slog.Logger

	// Store is an optional session persistence backend.
	// When set alongside SessionID, the loop loads the existing session
	// from the store at the start and saves it after each run.
	Store session.Store

	// SessionID, when set with Store, resumes an existing session.
	// When empty, a new session is created and its ID is stored after the run.
	SessionID string

	// Policy controls tool execution permissions.
	// When nil, all tools are allowed (AllowAllPolicy).
	Policy permission.Policy

	// Hooks are lifecycle callbacks invoked around tool execution and turns.
	// When nil, no hooks are called.
	Hooks *hook.Chain

	// Approver handles interactive tool approval when Policy returns Confirm.
	// When nil, DenyAllApprover is used (tools requiring approval are denied).
	Approver Approver

	// WorkDir overrides the working directory for file operation tools.
	// When empty, tools use their registered default.
	WorkDir string

	// Telemetry for OpenTelemetry tracing and metrics. Optional.
	Telemetry *telemetry.Telemetry
}

// GetWorkDir returns the working directory from context, or empty string.
func GetWorkDir(ctx context.Context) string {
	if v, ok := ctx.Value(workDirCtxKey).(string); ok {
		return v
	}
	return ""
}
