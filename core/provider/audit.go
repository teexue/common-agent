package provider

import (
	"context"
	"encoding/json"
	"time"

	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/auth"
)

// RunMeta describes the run an LLM request belongs to, carried via context
// so the provider layer can attribute requests without knowing the caller.
type RunMeta struct {
	Agent     string
	SessionID string
	Source    string // chat | http | kanban | cli | optimize
}

type runMetaKey struct{}

// WithRunMeta attaches run metadata to ctx.
func WithRunMeta(ctx context.Context, meta RunMeta) context.Context {
	return context.WithValue(ctx, runMetaKey{}, meta)
}

// RunMetaFrom extracts run metadata from ctx; zero value when absent.
func RunMetaFrom(ctx context.Context) RunMeta {
	if m, ok := ctx.Value(runMetaKey{}).(RunMeta); ok {
		return m
	}
	return RunMeta{}
}

// textTruncateLimit caps aggregated text/reasoning stored per record.
const textTruncateLimit = 16 * 1024

// auditedResponse is the aggregated response stored in a RequestRecord.
type auditedResponse struct {
	Text      string     `json:"text,omitempty"`
	Reasoning string     `json:"reasoning,omitempty"`
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
}

// auditedProvider wraps a Provider and logs every request/response pair.
type auditedProvider struct {
	inner  Provider
	logger *audit.RequestLogger
}

// WrapAudited returns a Provider that logs each Stream call to logger.
// A nil logger returns the inner provider unchanged.
func WrapAudited(p Provider, logger *audit.RequestLogger) Provider {
	if logger == nil || p == nil {
		return p
	}
	return &auditedProvider{inner: p, logger: logger}
}

// Stream delegates to the inner provider, draining the chunk stream and
// persisting one audit record per call.
func (a *auditedProvider) Stream(ctx context.Context, req Request) (<-chan Chunk, error) {
	start := time.Now()
	meta := RunMetaFrom(ctx)
	out, err := a.inner.Stream(ctx, req)
	if err != nil {
		a.record(ctx, meta, req, nil, err, start)
		return nil, err
	}

	// Tee the chunk stream: forward chunks while aggregating a summary.
	tee := make(chan Chunk, 16)
	go func() {
		defer close(tee)
		var resp auditedResponse
		var inTok, outTok, cacheRead, cacheCreation int
		for c := range out {
			resp.Text += c.TextDelta
			resp.Reasoning += c.ReasoningDelta
			resp.ToolCalls = append(resp.ToolCalls, c.ToolCalls...)
			if c.InputTokens > 0 {
				inTok = c.InputTokens
			}
			if c.OutputTokens > 0 {
				outTok = c.OutputTokens
			}
			if c.CacheReadInputTokens > 0 {
				cacheRead = c.CacheReadInputTokens
			}
			if c.CacheCreationInputTokens > 0 {
				cacheCreation = c.CacheCreationInputTokens
			}
			select {
			case tee <- c:
			case <-ctx.Done():
				// Record the aborted call too — timeouts/cancellations are
				// exactly what the audit log is for.
				a.record(ctx, meta, req, nil, ctx.Err(), start, inTok, outTok, cacheRead, cacheCreation)
				return
			}
		}
		resp.Text = truncateRunes(resp.Text, textTruncateLimit)
		resp.Reasoning = truncateRunes(resp.Reasoning, textTruncateLimit)
		data, _ := json.Marshal(resp)
		a.record(ctx, meta, req, data, nil, start, inTok, outTok, cacheRead, cacheCreation)
	}()
	return tee, nil
}

func (a *auditedProvider) record(ctx context.Context, meta RunMeta, req Request, resp json.RawMessage, callErr error, start time.Time, tokens ...int) {
	reqData, _ := json.Marshal(req)
	id := auth.IdentityFromContext(ctx)
	rec := audit.RequestRecord{
		Timestamp:  start,
		SessionID:  meta.SessionID,
		UserID:     id.UserID,
		KeyID:      id.KeyID,
		Agent:      meta.Agent,
		Source:     meta.Source,
		Model:      req.Model,
		DurationMs: time.Since(start).Milliseconds(),
		Request:    reqData,
		Response:   resp,
	}
	switch len(tokens) {
	case 2:
		rec.InputTokens, rec.OutputTokens = tokens[0], tokens[1]
	case 4:
		rec.InputTokens, rec.OutputTokens = tokens[0], tokens[1]
		rec.CacheReadInputTokens, rec.CacheCreationInputTokens = tokens[2], tokens[3]
	}
	if callErr != nil {
		rec.Error = callErr.Error()
	}
	_ = a.logger.Log(rec)
}

// truncateRunes truncates s to at most n bytes on a UTF-8 boundary.
func truncateRunes(s string, n int) string {
	if len(s) <= n {
		return s
	}
	for n > 0 && (s[n]&0xC0) == 0x80 {
		n--
	}
	return s[:n] + "…"
}
