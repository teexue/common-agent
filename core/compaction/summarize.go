package compaction

import (
	"context"
	"fmt"
	"strings"

	"github.com/teexue/common-agent/core/provider"
)

// SummarizeConfig configures LLM-based summarization compaction.
type SummarizeConfig struct {
	Provider   provider.Provider
	Model      string
	TokenLimit int
	// MaxOutput caps the generated summary length in tokens. 0 uses the default.
	MaxOutput int
	// KeepRecent preserves this many of the most recent conversation messages
	// verbatim; everything older is summarized by the model.
	KeepRecent int
	// KeepHead preserves this many of the oldest conversation messages
	// verbatim, keeping the prompt prefix stable for prompt caching.
	KeepHead int
}

const (
	defaultSummaryMaxOutput = 2048
	// summaryMarker prefixes the summary message so later compaction passes
	// can find it, reuse it, and only summarize the delta since.
	summaryMarker = "[对话摘要]"
)

// summarizeSystemPrompt instructs the model to compress a conversation while
// preserving task-relevant facts. Keep it compact — it is sent on every
// compaction request.
const summarizeSystemPrompt = `你是对话压缩器。把用户与 AI 助手的对话（含工具调用）压缩成一段简洁中文摘要，保留：用户的意图与需求、关键事实与决定、已完成事项、进行中的任务、重要约束与偏好。直接输出摘要正文，不要寒暄、不要序号前缀。`

// SummarizingCompactor compresses older turns with an LLM call instead of
// dropping them, so long conversations keep their information while staying
// inside the context window. It summarizes incrementally: an existing summary
// message is reused and only the messages appended since are sent to the model.
// On provider failure it falls back to truncation so the loop never breaks.
type SummarizingCompactor struct {
	provider      provider.Provider
	model         string
	tokenLimit    int
	maxOutput     int
	keepRecent    int
	keepHead      int
	currentTokens int
}

// NewSummarizingCompactor creates a SummarizingCompactor.
func NewSummarizingCompactor(cfg SummarizeConfig) *SummarizingCompactor {
	if cfg.MaxOutput <= 0 {
		cfg.MaxOutput = defaultSummaryMaxOutput
	}
	if cfg.KeepHead < 0 {
		cfg.KeepHead = 0
	}
	return &SummarizingCompactor{
		provider:   cfg.Provider,
		model:      cfg.Model,
		tokenLimit: cfg.TokenLimit,
		maxOutput:  cfg.MaxOutput,
		keepRecent: cfg.KeepRecent,
		keepHead:   cfg.KeepHead,
	}
}

// currentUsage returns the known token usage when available, falling back to
// the estimate.
func (c *SummarizingCompactor) currentUsage(messages []provider.Message) int {
	if c.currentTokens > 0 {
		return c.currentTokens
	}
	return EstimateTokens(messages)
}

// Compact summarizes older turns when the estimated token count exceeds the
// limit. Returns nil when no compaction is needed.
func (c *SummarizingCompactor) Compact(ctx context.Context, messages []provider.Message) (*Result, error) {
	if !NeedsCompactionByTokensCount(c.currentUsage(messages), c.tokenLimit) && !NeedsCompaction(messages, 0) {
		return nil, nil
	}

	var systemMsgs, convMsgs []provider.Message
	for _, m := range messages {
		if m.Role == provider.RoleSystem {
			systemMsgs = append(systemMsgs, m)
		} else {
			convMsgs = append(convMsgs, m)
		}
	}

	keepHead := c.keepHead
	if keepHead <= 0 {
		keepHead = defaultKeepHead
	}
	if keepHead > len(convMsgs) {
		keepHead = len(convMsgs)
	}
	keep := c.keepRecent
	if keep <= 0 {
		keep = defaultKeepRecent
	}
	if keep > len(convMsgs)-keepHead {
		keep = len(convMsgs) - keepHead
	}
	if keep < 0 {
		keep = 0
	}

	head := convMsgs[:keepHead]
	recent := ensureToolPairs(convMsgs[len(convMsgs)-keep:])

	// Find an existing summary message to reuse.
	summaryIdx := -1
	lastSummary := ""
	searchEnd := len(convMsgs) - keep
	for i := keepHead; i < searchEnd; i++ {
		m := convMsgs[i]
		if m.Role == provider.RoleUser && strings.HasPrefix(m.Content, summaryMarker) {
			summaryIdx = i
			lastSummary = strings.TrimPrefix(m.Content, summaryMarker)
			break
		}
	}

	var old []provider.Message
	if summaryIdx >= 0 {
		// Incremental: only the messages after the existing summary and before
		// the recent tail are new history.
		from, to := summaryIdx+1, searchEnd
		if from > to {
			from = to
		}
		old = convMsgs[from:to]
		if len(old) == 0 {
			// Nothing new to summarize; reuse the existing summary verbatim.
			return c.buildResult(len(messages), systemMsgs, head, recent, lastSummary)
		}
	} else {
		old = convMsgs[keepHead:searchEnd]
		if len(old) == 0 {
			return nil, nil
		}
	}

	summary, err := c.summarize(ctx, lastSummary, old)
	if err != nil {
		// Fall back to a placeholder so compaction still happens even when
		// the summarization call fails.
		summary = fmt.Sprintf("[Context compacted: %d older messages removed; summarization unavailable]", len(old))
	}
	return c.buildResult(len(messages), systemMsgs, head, recent, summary)
}

// buildResult assembles the compacted message list: system prompt + stable
// head + summary message (user role, so it does not pollute the system
// prefix) + recent turns.
func (c *SummarizingCompactor) buildResult(oldCount int, systemMsgs, head, recent []provider.Message, summary string) (*Result, error) {
	compacted := make([]provider.Message, 0, len(systemMsgs)+len(head)+1+len(recent))
	compacted = append(compacted, systemMsgs...)
	compacted = append(compacted, head...)
	compacted = append(compacted, provider.Message{
		Role:    provider.RoleUser,
		Content: summaryMarker + summary,
	})
	compacted = append(compacted, recent...)
	return &Result{
		Compacted: compacted,
		OldCount:  oldCount,
		NewCount:  len(compacted),
		Summary:   summary,
	}, nil
}

// summarize merges an existing summary with newly seen conversation turns and
// asks the model to produce the next summary.
func (c *SummarizingCompactor) summarize(ctx context.Context, lastSummary string, old []provider.Message) (string, error) {
	var sb strings.Builder
	if lastSummary != "" {
		sb.WriteString("已有摘要：\n")
		sb.WriteString(lastSummary)
		sb.WriteString("\n\n新增对话：\n")
	}
	for _, m := range old {
		sb.WriteString(renderMessage(m))
		sb.WriteString("\n")
	}

	req := provider.Request{
		Model: c.model,
		Messages: []provider.Message{
			{Role: provider.RoleSystem, Content: summarizeSystemPrompt},
			{Role: provider.RoleUser, Content: sb.String()},
		},
		MaxTokens: c.maxOutput,
	}

	chunks, err := c.provider.Stream(ctx, req)
	if err != nil {
		return "", fmt.Errorf("summarize: %w", err)
	}
	var text strings.Builder
	for ch := range chunks {
		text.WriteString(ch.TextDelta)
	}
	summary := strings.TrimSpace(text.String())
	if summary == "" {
		return "", fmt.Errorf("summarize: empty summary")
	}
	return summary, nil
}

// renderMessage turns a message into a readable transcript line for the
// summarizer, including tool calls and results.
func renderMessage(m provider.Message) string {
	var sb strings.Builder
	switch m.Role {
	case provider.RoleUser:
		sb.WriteString("用户: ")
	case provider.RoleAssistant:
		sb.WriteString("助手: ")
	case provider.RoleTool:
		sb.WriteString(fmt.Sprintf("工具 %s 返回: ", m.Name))
	default:
		sb.WriteString("系统: ")
	}
	if m.Content != "" {
		sb.WriteString(m.Content)
	}
	if len(m.ToolCalls) > 0 {
		for _, tc := range m.ToolCalls {
			sb.WriteString(fmt.Sprintf("\n  [调用工具 %s 参数 %s]", tc.Name, string(tc.Arguments)))
		}
	}
	return sb.String()
}
