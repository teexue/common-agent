package loop

import (
	"context"
	"fmt"

	"github.com/teexue/common-agent/core/knowledge"
	"github.com/teexue/common-agent/core/provider"
)

func validateRunConfig(cfg Config) error {
	if cfg.Provider == nil {
		return fmt.Errorf("provider is required")
	}
	if cfg.Registry == nil {
		return fmt.Errorf("registry is required")
	}
	if cfg.Agent == nil {
		return fmt.Errorf("agent is required")
	}
	if cfg.Session == nil {
		return fmt.Errorf("session is required")
	}
	return nil
}

func prepareSession(cfg Config) (Config, error) {
	// Reload from store only when the in-memory session is a placeholder
	// (different ID). PrepareRun already loads the real session and may have
	// written model-lock metadata that must not be wiped by a second Load.
	if cfg.Store != nil && cfg.SessionID != "" && cfg.Session.ID != cfg.SessionID {
		loaded, err := cfg.Store.Load(cfg.SessionID)
		if err != nil {
			return cfg, fmt.Errorf("load session %s: %w", cfg.SessionID, err)
		}
		cfg.Session = loaded
	}
	if cfg.Prompt == "" && len(cfg.Session.GetMessages()) == 0 {
		return cfg, fmt.Errorf("prompt is required for a new session")
	}
	// Persist up front so a brand-new session appears in the session list
	// while its first turn is still running (otherwise the row only exists
	// after the first LLM response completes).
	persistSession(cfg)
	return cfg, nil
}

func seedMessages(cfg Config) {
	msgs := cfg.Session.GetMessages()
	if len(msgs) == 0 {
		msgs = []provider.Message{
			{Role: provider.RoleSystem, Content: cfg.Agent.SystemPrompt},
		}
		if cfg.Agent.ProjectContext != "" {
			msgs = append(msgs, provider.Message{Role: provider.RoleSystem, Content: "# Project Context\n\n" + cfg.Agent.ProjectContext})
		}
		if cfg.Agent.SkillsContext != "" {
			msgs = append(msgs, provider.Message{Role: provider.RoleSystem, Content: cfg.Agent.SkillsContext})
		}
		cfg.Session.SetMessages(msgs)
	}
	if cfg.Prompt != "" || len(cfg.Images) > 0 {
		msg := provider.Message{
			Role:    provider.RoleUser,
			Content: cfg.Prompt,
		}
		if len(cfg.Images) > 0 {
			msg.ContentParts = append([]provider.ContentPart{{Type: "text", Text: cfg.Prompt}}, cfg.Images...)
		}
		cfg.Session.AddMessages(msg)
	}
}

// imageKeepFromAfterSeed returns the first message index that may carry
// image payloads for this run: the newly seeded user turn (attachments) and
// any messages appended later (tool reads). Prior-turn images are dropped
// only on the outbound model request.
func imageKeepFromAfterSeed(cfg Config) int {
	n := len(cfg.Session.GetMessages())
	if cfg.Prompt != "" || len(cfg.Images) > 0 {
		if n == 0 {
			return 0
		}
		return n - 1
	}
	return n
}

func attachRunContext(ctx context.Context, cfg Config) context.Context {
	if cfg.WorkDir != "" {
		ctx = WithWorkDir(ctx, cfg.WorkDir)
	}
	if cfg.Shell != "" {
		ctx = WithShell(ctx, cfg.Shell)
	}
	ctx = provider.WithRunMeta(ctx, provider.RunMeta{
		Agent:     cfg.Agent.Name,
		SessionID: cfg.Session.ID,
		Source:    cfg.Source,
	})
	ctx = WithSpawn(ctx, spawnFromConfig(cfg))
	if cfg.Agent.Knowledge != nil {
		ctx = knowledge.WithScope(ctx, knowledge.Scope{
			Bases: cfg.Agent.Knowledge.Bases,
			TopK:  cfg.Agent.Knowledge.TopK,
		})
	}
	return ctx
}
