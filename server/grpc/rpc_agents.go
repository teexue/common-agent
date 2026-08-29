package grpcapi

import (
	"context"
	"errors"
	"os"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/teexue/common-agent/core/i18n"
	"github.com/teexue/common-agent/core/service"
	commonagentv1 "github.com/teexue/common-agent/proto"
)

// ListAgents returns all loaded agents.
func (s *GRPCServer) ListAgents(ctx context.Context, _ *commonagentv1.ListAgentsRequest) (*commonagentv1.ListAgentsResponse, error) {
	ctx = withRequestLocale(ctx)
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	summaries := s.svc.ListAgents()
	items := make([]*commonagentv1.AgentListItem, len(summaries))
	for i, a := range summaries {
		items[i] = &commonagentv1.AgentListItem{
			Name:     a.Name,
			Provider: a.Provider,
			Model:    a.Model,
			Tools:    a.Tools,
			MaxTurns: int32(a.MaxTurns),
		}
	}
	return &commonagentv1.ListAgentsResponse{Agents: items}, nil
}

// GetAgent returns details for a specific agent.
func (s *GRPCServer) GetAgent(ctx context.Context, req *commonagentv1.GetAgentRequest) (*commonagentv1.GetAgentResponse, error) {
	ctx = withRequestLocale(ctx)
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	a, err := s.svc.GetAgent(req.Name)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, status.Error(codes.NotFound, i18n.TCtx(ctx, "api.grpc.error.agent_not_found", "name", req.Name))
		}
		return nil, status.Error(codes.InvalidArgument, i18n.TCtx(ctx, "api.grpc.error.load_agent", "error", err.Error()))
	}

	return &commonagentv1.GetAgentResponse{
		Name:         a.Name,
		Provider:     a.Provider,
		Model:        a.Model,
		SystemPrompt: a.SystemPrompt,
		Tools:        a.Tools,
		MaxTurns:     int32(a.MaxTurns),
		MaxTokens:    int32(a.MaxTokens),
	}, nil
}

// UpdateAgent creates or updates an agent YAML.
func (s *GRPCServer) UpdateAgent(ctx context.Context, req *commonagentv1.UpdateAgentRequest) (*commonagentv1.UpdateAgentResponse, error) {
	ctx = withRequestLocale(ctx)
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	if err := s.svc.SaveAgent(req.Name, req.YamlContent); err != nil {
		return nil, status.Error(codes.InvalidArgument, i18n.TCtx(ctx, "api.grpc.error.save_agent", "error", err.Error()))
	}
	return &commonagentv1.UpdateAgentResponse{Name: service.NormalizeAgentName(req.Name)}, nil
}

// DeleteAgent deletes an agent YAML.
func (s *GRPCServer) DeleteAgent(ctx context.Context, req *commonagentv1.DeleteAgentRequest) (*commonagentv1.DeleteAgentResponse, error) {
	ctx = withRequestLocale(ctx)
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	if err := s.svc.DeleteAgent(req.Name); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, status.Error(codes.NotFound, i18n.TCtx(ctx, "api.grpc.error.agent_not_found", "name", req.Name))
		}
		return nil, status.Error(codes.Internal, i18n.TCtx(ctx, "api.grpc.error.delete_agent", "error", err.Error()))
	}
	return &commonagentv1.DeleteAgentResponse{}, nil
}
