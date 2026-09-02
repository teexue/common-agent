package auth

import "context"

// PasswordKeyID is the JWT kid for password-based login sessions.
const PasswordKeyID = "pwd"

// Identity is the authenticated principal for a request.
type Identity struct {
	UserID string
	KeyID  string   // API key id, or PasswordKeyID for password login
	Role   string   // RBAC role ("admin"/"member"); empty for API key identities
	Scopes []string // API key scopes; empty for password sessions (full access)
}

type ctxKey struct{}

// WithIdentity attaches identity to ctx.
func WithIdentity(ctx context.Context, id Identity) context.Context {
	return context.WithValue(ctx, ctxKey{}, id)
}

// IdentityFromContext returns the identity stored on ctx, or a zero value.
func IdentityFromContext(ctx context.Context) Identity {
	if ctx == nil {
		return Identity{}
	}
	if v, ok := ctx.Value(ctxKey{}).(Identity); ok {
		return v
	}
	return Identity{}
}

// IsPasswordSession reports whether the identity came from password login.
func (id Identity) IsPasswordSession() bool {
	return id.KeyID == PasswordKeyID
}
