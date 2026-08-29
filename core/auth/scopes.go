package auth

// API resource scopes. An API key carries a comma-separated list of these;
// each /v1 route group requires its matching scope.
const (
	// ScopeAgents authorizes agent CRUD, runs, tools, events, and background assets.
	ScopeAgents = "agents"
	// ScopeSessions authorizes listing, reading, patching, and deleting conversation sessions.
	ScopeSessions = "sessions"
	// ScopeKanban authorizes kanban item CRUD plus approve, reject, and requeue.
	ScopeKanban = "kanban"
	// ScopeKnowledge authorizes knowledge-base CRUD, document ingest, search, and reindex.
	ScopeKnowledge = "knowledge"
	// ScopeSkills authorizes skill install, CRUD, and listing.
	ScopeSkills = "skills"
	// ScopeMCP authorizes listing and mutating global MCP server registrations.
	ScopeMCP = "mcp"
	// ScopeProviders authorizes read access to provider catalogs, models, and embedding config.
	ScopeProviders = "providers"
	// ScopeAudit authorizes request-log and usage audit endpoints when granted on an API key.
	ScopeAudit = "audit"
	// ScopeFS authorizes directory listing under the configured workspace via /v1/fs/list.
	ScopeFS = "fs"
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
