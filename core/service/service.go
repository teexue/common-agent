// Package service provides shared business logic for HTTP and gRPC transports.
// It eliminates duplication between server/http and server/grpc handlers
// by extracting common agent, session, and run operations.
package service

import (
	"log/slog"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/job"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/tools/registry"
)

// Service provides shared operations used by both HTTP and gRPC handlers.
type Service struct {
	AgentsDir   string
	Registry    *registry.Registry
	NewProvider func(a *agent.Agent) (provider.Provider, error)
	Logger      *slog.Logger
	Store       session.Store
	Jobs        job.Store
}

// New creates a Service instance.
func New(cfg ServiceConfig) *Service {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &Service{
		AgentsDir:   cfg.AgentsDir,
		Registry:    cfg.Registry,
		NewProvider: cfg.NewProvider,
		Logger:      logger,
		Store:       cfg.Store,
		Jobs:        cfg.Jobs,
	}
}

// ServiceConfig holds configuration for creating a Service.
type ServiceConfig struct {
	AgentsDir   string
	Registry    *registry.Registry
	NewProvider func(a *agent.Agent) (provider.Provider, error)
	Logger      *slog.Logger
	Store       session.Store
	Jobs        job.Store
}
