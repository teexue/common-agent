package auth

import "context"

// DefaultUserID is used for open/unauthenticated mode and CLI ephemeral keys.
const DefaultUserID = "usr_local"

// PasswordKeyID is the JWT kid for password-based login sessions.
const PasswordKeyID = "pwd"

// Identity is the authenticated principal for a request.
type Identity struct {
	UserID string
	KeyID  string // API key id, or PasswordKeyID for password login
}

type ctxKey struct{}

// WithIdentity attaches identity to ctx.
func WithIdentity(ctx context.Context, id Identity) context.Context {
	return context.WithValue(ctx, ctxKey{}, id)
}

// IdentityFromContext returns the identity, or DefaultUserID when unset.
func IdentityFromContext(ctx context.Context) Identity {
	if ctx == nil {
		return Identity{UserID: DefaultUserID}
	}
	if v, ok := ctx.Value(ctxKey{}).(Identity); ok && v.UserID != "" {
		return v
	}
	return Identity{UserID: DefaultUserID}
}

// IsPasswordSession reports whether the identity came from password login.
func (id Identity) IsPasswordSession() bool {
	return id.KeyID == PasswordKeyID
}
