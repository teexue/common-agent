package auth

// API resource scopes. An API key carries a comma-separated list of these;
// each /v1 route group requires its matching scope.
const (
	ScopeAgents    = "agents"
	ScopeSessions  = "sessions"
	ScopeKanban    = "kanban"
	ScopeKnowledge = "knowledge"
	ScopeSkills    = "skills"
	ScopeMCP       = "mcp"
	ScopeProviders = "providers"
	ScopeAudit     = "audit"
	ScopeFS        = "fs"
)

// ScopeAll grants every scope.
const ScopeAll = "*"

// HasScope reports whether the identity may access the given scope.
// Password-session JWT identities (KeyID empty or PasswordKeyID) always pass;
// scope checks only constrain API key identities, which must carry ScopeAll
// or the exact scope.
func HasScope(id Identity, scope string) bool {
	if id.KeyID == "" || id.IsPasswordSession() {
		return true
	}
	for _, s := range id.Scopes {
		if s == ScopeAll || s == scope {
			return true
		}
	}
	return false
}
