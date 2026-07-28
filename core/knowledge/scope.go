package knowledge

import "context"

type scopeKey struct{}

// Scope limits which knowledge bases a run may search.
type Scope struct {
	Bases []string
	TopK  int
}

// WithScope attaches a knowledge scope to ctx.
func WithScope(ctx context.Context, s Scope) context.Context {
	return context.WithValue(ctx, scopeKey{}, s)
}

// ScopeFrom returns the knowledge scope from ctx, if any.
func ScopeFrom(ctx context.Context) (Scope, bool) {
	s, ok := ctx.Value(scopeKey{}).(Scope)
	return s, ok
}
