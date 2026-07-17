package i18n

import (
	"context"
	"log/slog"
)

// SlogHandler wraps an inner slog.Handler and translates message keys
// from the log catalog. The original key is preserved as attr "msg_key".
type SlogHandler struct {
	inner  slog.Handler
	bundle *Bundle
}

// NewSlogHandler returns a handler that localizes slog message keys.
func NewSlogHandler(inner slog.Handler, bundle *Bundle) *SlogHandler {
	if bundle == nil {
		bundle = Global()
	}
	return &SlogHandler{inner: inner, bundle: bundle}
}

// Enabled reports whether the handler handles records at the given level.
func (h *SlogHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.inner.Enabled(ctx, level)
}

// Handle translates the record message then delegates to the inner handler.
func (h *SlogHandler) Handle(ctx context.Context, r slog.Record) error {
	key := r.Message
	translated := h.bundle.TLog(key)
	nr := slog.NewRecord(r.Time, r.Level, translated, r.PC)
	r.Attrs(func(a slog.Attr) bool {
		nr.AddAttrs(a)
		return true
	})
	if key != "" && key != translated {
		nr.AddAttrs(slog.String("msg_key", key))
	} else if looksLikeKey(key) {
		nr.AddAttrs(slog.String("msg_key", key))
	}
	return h.inner.Handle(ctx, nr)
}

// WithAttrs returns a new handler with the given attributes.
func (h *SlogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &SlogHandler{inner: h.inner.WithAttrs(attrs), bundle: h.bundle}
}

// WithGroup returns a new handler with the given group name.
func (h *SlogHandler) WithGroup(name string) slog.Handler {
	return &SlogHandler{inner: h.inner.WithGroup(name), bundle: h.bundle}
}

func looksLikeKey(s string) bool {
	return len(s) > 4 && (s[:4] == "log." || containsDot(s))
}

func containsDot(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			return true
		}
	}
	return false
}
