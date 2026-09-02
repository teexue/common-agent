package loop

import (
	"context"
	"log/slog"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
)

type ctxKeySpawn struct{}

// Spawn is the nested-run wiring copied onto context so tools can start a
// child loop.Run without holding a shared mutable tool instance.
type Spawn struct {
	AgentsDir   string
	NewProvider func(a *agent.Agent) (provider.Provider, error)
	Registry    ToolRegistry
	Logger      *slog.Logger
	Policy      permission.Policy
	Approver    Approver
	Store       session.Store
	WorkDir     string
	Shell       string
	Depth       int
	UserID      string
	SessionID   string
	Agent       *agent.Agent
	Subagent    SubagentLimits
}

// WithSpawn returns a context carrying nested-run wiring.
func WithSpawn(ctx context.Context, spawn Spawn) context.Context {
	return context.WithValue(ctx, ctxKeySpawn{}, spawn)
}

// SpawnFrom returns nested-run wiring from ctx.
func SpawnFrom(ctx context.Context) (Spawn, bool) {
	spawn, ok := ctx.Value(ctxKeySpawn{}).(Spawn)
	return spawn, ok
}

func spawnFromConfig(cfg Config) Spawn {
	userID, sessID := "", ""
	if cfg.Session != nil {
		userID = cfg.Session.UserID
		sessID = cfg.Session.ID
	}
	return Spawn{
		AgentsDir:   cfg.AgentsDir,
		NewProvider: cfg.NewProvider,
		Registry:    cfg.Registry,
		Logger:      cfg.Logger,
		Policy:      cfg.Policy,
		Approver:    cfg.Approver,
		Store:       cfg.Store,
		WorkDir:     cfg.WorkDir,
		Shell:       cfg.Shell,
		Depth:       cfg.Depth,
		UserID:      userID,
		SessionID:   sessID,
		Agent:       cfg.Agent,
		Subagent:    cfg.Subagent,
	}
}
