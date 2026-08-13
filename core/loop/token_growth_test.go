package loop

import (
	"context"
	"strings"
	"testing"

	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
)

// TestTokenGrowthSimulated simulates a long multi-turn run to show how much
// input traffic the truncation + compaction fixes save versus the old
// "unbounded history" behavior. It is a regression guard: if either fix is
// removed, cumulative input balloons.
func TestTokenGrowthSimulated(t *testing.T) {
	// A chatty tool that returns a large output each call, like a build log.
	bigOutput := strings.Repeat("build output line with some details\n", 4000) // ~120KB

	mk := func() *session.Session {
		s := session.New("a")
		s.SetMessages([]provider.Message{
			{Role: provider.RoleSystem, Content: "You are an agent."},
		})
		return s
	}

	// Old behavior: tool outputs stored verbatim, compaction disabled.
	oldSession := mk()
	// New behavior: truncated tool outputs + compaction active.
	newSession := mk()

	const turns = 30
	var oldCum, newCum int
	for i := 0; i < turns; i++ {
		// Simulate one turn: assistant tool call + tool result + assistant text.
		oldSession.AddMessages(provider.Message{Role: provider.RoleAssistant, Content: "using tool"})
		oldSession.AddMessages(provider.Message{Role: provider.RoleTool, ToolCallID: "c1", Name: "run_command", Content: bigOutput})
		oldSession.AddMessages(provider.Message{Role: provider.RoleAssistant, Content: "done"})

		newSession.AddMessages(provider.Message{Role: provider.RoleAssistant, Content: "using tool"})
		newSession.AddMessages(provider.Message{Role: provider.RoleTool, ToolCallID: "c1", Name: "run_command", Content: truncateToolOutput(bigOutput)})
		newSession.AddMessages(provider.Message{Role: provider.RoleAssistant, Content: "done"})

		// Each turn re-sends the full history accumulated so far.
		oldCum += estimateMsgTokens(oldSession.GetMessages())
		newCum += estimateMsgTokens(newSession.GetMessages())

		// Apply compaction on the new session every turn (as compactIfNeeded does).
		window := provider.EffectiveContextWindow("unknown-model", 0)
		reserve := provider.EffectiveMaxOutput("unknown-model", 0)
		limit := compactionTokenLimit(window, reserve, 0)
		if limit > 0 {
			if msgs := compactMessages(context.Background(), newSession.GetMessages(), limit, 0, 20); msgs != nil {
				newSession.SetMessages(msgs)
			}
		}
	}

	t.Logf("old cumulative input (unbounded): %d", oldCum)
	t.Logf("new cumulative input (truncated+compacted): %d", newCum)

	// The retained stable head (keep_head) keeps a few early messages, so the
	// reduction is slightly less than the old pure-tail truncation; 8x is
	// still a strong guard against unbounded growth.
	if newCum >= oldCum/8 {
		t.Errorf("expected truncation+compaction to cut cumulative input by >8x: old=%d new=%d", oldCum, newCum)
	}
}

// estimateMsgTokens approximates what the provider would count for a message list.
func estimateMsgTokens(msgs []provider.Message) int {
	n := 0
	for _, m := range msgs {
		n += len(m.Content)/3 + 4
	}
	return n
}
