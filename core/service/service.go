// Package service provides shared business logic for HTTP and gRPC transports.
// It eliminates duplication between server/http and server/grpc handlers
// by extracting common agent, session, and run operations.
package service

import (
	"log/slog"
	"sync"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/embedding"
	"github.com/teexue/common-agent/core/job"
	"github.com/teexue/common-agent/core/knowledge"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/tools/registry"
)

// Service provides shared operations used by both HTTP and gRPC handlers.
type Service struct {
	AgentsDir   string
	HomeDir     string
	Registry    *registry.Registry
	NewProvider func(a *agent.Agent) (provider.Provider, error)
	Logger      *slog.Logger
	Store       session.Store
	Jobs        job.Store
	Creds       *config.CredentialStore

	Knowledge        *knowledge.Manager
	Ingester         *knowledge.Ingester
	Retriever        *knowledge.Retriever
	Embedder         embedding.Embedder
	KnowledgeRuntime *knowledge.Runtime

	// optimizeCache memoizes system prompt optimization results keyed by
	// content hash, so the same raw prompt is only optimized once per process.
	optimizeCache sync.Map
}

// New creates a Service instance.
func New(cfg ServiceConfig) *Service {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &Service{
		AgentsDir:        cfg.AgentsDir,
		HomeDir:          cfg.HomeDir,
		Registry:         cfg.Registry,
		NewProvider:      cfg.NewProvider,
		Logger:           logger,
		Store:            cfg.Store,
		Jobs:             cfg.Jobs,
		Creds:            cfg.Creds,
		Knowledge:        cfg.Knowledge,
		Ingester:         cfg.Ingester,
		Retriever:        cfg.Retriever,
		Embedder:         cfg.Embedder,
		KnowledgeRuntime: cfg.KnowledgeRuntime,
	}
}

// ServiceConfig holds configuration for creating a Service.
type ServiceConfig struct {
	AgentsDir        string
	HomeDir          string
	Registry         *registry.Registry
	NewProvider      func(a *agent.Agent) (provider.Provider, error)
	Logger           *slog.Logger
	Store            session.Store
	Jobs             job.Store
	Creds            *config.CredentialStore
	Knowledge        *knowledge.Manager
	Ingester         *knowledge.Ingester
	Retriever        *knowledge.Retriever
	Embedder         embedding.Embedder
	KnowledgeRuntime *knowledge.Runtime
}
