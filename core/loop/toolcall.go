package loop

import "context"

type ctxKeyToolCallID struct{}

// WithToolCallID returns a context carrying the active tool call id.
func WithToolCallID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, ctxKeyToolCallID{}, id)
}

// ToolCallIDFrom returns the active tool call id from ctx, or empty.
func ToolCallIDFrom(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKeyToolCallID{}).(string); ok {
		return v
	}
	return ""
}
