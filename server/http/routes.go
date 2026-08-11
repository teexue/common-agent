package httpapi

import (
	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/auth"
)

// mountAPIRoutes registers /v1 routes on r.
// requireScope constrains API key identities only; password sessions
// (member/admin) pass all scope checks. Admin-only routes use requireAdmin.
func (s *Server) mountAPIRoutes(r *gin.Engine) {
	v1 := r.Group("/v1", s.authMiddleware())

	// Key management is admin-only; /auth/me is available to any identity.
	v1.GET("/auth/keys", requireAdmin(), s.handleAuthKeysList)
	v1.POST("/auth/keys", requireAdmin(), s.handleAuthKeysCreate)
	v1.PATCH("/auth/keys/:id", requireAdmin(), s.handleAuthKeysPatch)
	v1.DELETE("/auth/keys/:id", requireAdmin(), s.handleAuthKeysDelete)
	v1.GET("/auth/me", s.handleAuthMe)

	// Admin-only: user management, registration setting, provider/embedding
	// writes, audit export.
	admin := v1.Group("", requireAdmin())
	admin.GET("/admin/users", s.handleAdminUsersList)
	admin.POST("/admin/users", s.handleAdminUserCreate)
	admin.PATCH("/admin/users/:id", s.handleAdminUserPatch)
	admin.DELETE("/admin/users/:id", s.handleAdminUserDelete)
	admin.GET("/admin/settings/registration", s.handleAdminRegistrationGet)
	admin.PUT("/admin/settings/registration", s.handleAdminRegistrationPut)
	admin.POST("/providers", s.handleProviderUpsert)
	admin.DELETE("/providers/:name", s.handleProviderDelete)
	admin.POST("/providers/models", s.handleProviderModelsTest)
	admin.PUT("/embedding", s.handleEmbeddingPut)
	if s.auditStore != nil {
		admin.GET("/audit/export", s.handleAuditExport)
	}
	if s.requestLogger != nil {
		admin.GET("/audit/requests", s.handleAuditRequests)
	}

	// Agents scope: runs, agent CRUD, tools, events, background assets.
	agents := v1.Group("", requireScope(auth.ScopeAgents))
	agents.POST("/agents/run", s.handleRun)
	agents.POST("/agents/approve", s.handleApprove)
	agents.POST("/agents/optimize", s.handleOptimizePrompt)
	agents.GET("/tools", s.handleTools)
	agents.GET("/agents", s.handleAgents)
	agents.POST("/agents", s.handleAgentCreate)
	agents.GET("/agents/:id", s.handleAgentGet)
	agents.PUT("/agents/:id", s.handleAgentPut)
	agents.DELETE("/agents/:id", s.handleAgentDelete)
	agents.POST("/agents/validate", s.handleAgentValidate)
	agents.GET("/events", s.handleEvents)
	agents.GET("/background", s.handleBackgroundGet)
	agents.HEAD("/background", s.handleBackgroundGet)
	agents.POST("/background", s.handleBackgroundUpload)
	agents.DELETE("/background", s.handleBackgroundDelete)

	mcp := v1.Group("", requireScope(auth.ScopeMCP))
	mcp.GET("/mcp", s.handleMCPList)
	mcp.POST("/mcp/global", s.handleMCPGlobalUpsert)
	mcp.DELETE("/mcp/global/:name", s.handleMCPGlobalDelete)

	knowledge := v1.Group("", requireScope(auth.ScopeKnowledge))
	knowledge.GET("/knowledge", s.handleKnowledgeList)
	knowledge.POST("/knowledge", s.handleKnowledgeCreate)
	knowledge.POST("/knowledge/search", s.handleKnowledgeSearch)
	knowledge.GET("/knowledge/:id", s.handleKnowledgeGet)
	knowledge.PATCH("/knowledge/:id", s.handleKnowledgeUpdate)
	knowledge.DELETE("/knowledge/:id", s.handleKnowledgeDelete)
	knowledge.GET("/knowledge/:id/documents", s.handleKnowledgeDocsList)
	knowledge.POST("/knowledge/:id/documents", s.handleKnowledgeDocUpload)
	knowledge.DELETE("/knowledge/:id/documents/:docId", s.handleKnowledgeDocDelete)
	knowledge.POST("/knowledge/:id/reindex", s.handleKnowledgeReindex)

	providers := v1.Group("", requireScope(auth.ScopeProviders))
	providers.GET("/vendors", s.handleVendors)
	providers.GET("/providers", s.handleProvidersList)
	providers.GET("/providers/:name/models", s.handleProviderModels)
	providers.GET("/embedding", s.handleEmbeddingGet)
	providers.GET("/embedding/vendors", s.handleEmbeddingVendors)

	skills := v1.Group("", requireScope(auth.ScopeSkills))
	skills.GET("/skills", s.handleSkillsList)
	skills.POST("/skills", s.handleSkillCreate)
	skills.POST("/skills/install", s.handleSkillsInstall)
	skills.GET("/skills/:name", s.handleSkillGet)
	skills.PUT("/skills/:name", s.handleSkillUpdate)
	skills.DELETE("/skills/:name", s.handleSkillDelete)

	v1.GET("/fs/list", requireScope(auth.ScopeFS), s.handleFSList)

	// Conditional endpoints (auth middleware applies via group).
	if s.store != nil {
		sessions := v1.Group("", requireScope(auth.ScopeSessions))
		sessions.GET("/sessions", s.handleSessionsList)
		sessions.GET("/sessions/:id", s.handleSessionsGet)
		sessions.PATCH("/sessions/:id", s.handleSessionPatch)
		sessions.DELETE("/sessions/:id", s.handleSessionsDelete)
		if s.eventLogger != nil {
			sessions.GET("/sessions/:id/replay", s.handleSessionReplay)
		}
	}

	// Kanban endpoints (when the state DB is configured).
	if s.stateDB != nil {
		kanban := v1.Group("", requireScope(auth.ScopeKanban))
		kanban.GET("/kanban", s.handleKanbanList)
		kanban.POST("/kanban", s.handleKanbanCreate)
		kanban.PATCH("/kanban/:id", s.handleKanbanPatch)
		kanban.DELETE("/kanban/:id", s.handleKanbanDelete)
		kanban.POST("/kanban/:id/approve", s.handleKanbanApprove)
		kanban.POST("/kanban/:id/reject", s.handleKanbanReject)
		kanban.POST("/kanban/:id/requeue", s.handleKanbanRequeue)
	}
}
