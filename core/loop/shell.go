package loop

import "context"

type ctxKeyShell struct{}

// GetShell returns the preferred shell id from context, or empty for auto.
func GetShell(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKeyShell{}).(string); ok {
		return v
	}
	return ""
}

// WithShell returns a context with the preferred shell id set.
func WithShell(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, ctxKeyShell{}, id)
}
