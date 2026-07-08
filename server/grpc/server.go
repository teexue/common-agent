package grpcapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"strings"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/telemetry"
	commonagentv1 "github.com/teexue/common-agent/proto"
	"github.com/teexue/common-agent/tools/registry"
)


// GRPCServer implements commonagentv1.AgentServiceServer.
type GRPCServer struct {
	commonagentv1.UnimplementedAgentServiceServer

	agentsDir   string
	registry    *registry.Registry
	newProvider func(a *agent.Agent) (provider.Provider, error)
	logger      *slog.Logger
	store       session.Store
	svc         *service.Service
	approver    *GRPCApprover
	apiKey      string                            // when non-empty, all methods require this key
	healthSrv   grpc_health_v1.HealthServer       // the registered health service
	health      *telemetry.HealthServer           // optional; nil disables component checks
	healthMu    sync.RWMutex
}

// NewGRPCServer creates a GRPCServer.
func NewGRPCServer(
	agentsDir string,
	reg *registry.Registry,
	newProvider func(a *agent.Agent) (provider.Provider, error),
	logger *slog.Logger,
	store session.Store,
) *GRPCServer {
	svc := service.New(service.ServiceConfig{
		AgentsDir:   agentsDir,
		Registry:    reg,
		NewProvider: newProvider,
		Logger:      logger,
		Store:       store,
	})
	return &GRPCServer{
		agentsDir:   agentsDir,
		registry:    reg,
		newProvider: newProvider,
		logger:      logger,
		store:       store,
		svc:         svc,
		approver:    NewGRPCApprover(),
	}
}

// SetHealth sets the health server for component-level readiness checks.
// When set, Check() reports SERVING only when all registered components are healthy.
func (s *GRPCServer) SetHealth(h *telemetry.HealthServer) {
	s.healthMu.Lock()
	defer s.healthMu.Unlock()
	s.health = h
}

// SetAPIKey enables API key authentication for all gRPC methods.
// When set to a non-empty value, clients must send the key via
// the "authorization" metadata key as "bearer <key>" or the
// "x-api-key" metadata key.
func (s *GRPCServer) SetAPIKey(key string) {
	s.apiKey = key
}

// checkAuth validates the API key from gRPC metadata.
// Returns nil if auth is disabled or the key is valid.
func (s *GRPCServer) checkAuth(ctx context.Context) error {
	if s.apiKey == "" {
		return nil
	}
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return status.Error(codes.Unauthenticated, "missing metadata")
	}

	// Check authorization: bearer <key>.
	for _, val := range md.Get("authorization") {
		if strings.HasPrefix(val, "bearer ") {
			if strings.TrimPrefix(val, "bearer ") == s.apiKey {
				return nil
			}
		}
	}

	// Check x-api-key.
	for _, val := range md.Get("x-api-key") {
		if val == s.apiKey {
			return nil
		}
	}

	return status.Error(codes.Unauthenticated, "invalid or missing API key")
}

// RegisterServer registers the GRPCServer on the given gRPC server.
func (s *GRPCServer) RegisterServer(srv *grpc.Server) {
	commonagentv1.RegisterAgentServiceServer(srv, s)

	hs := &grpcHealthService{
		grpcSrv:  s,
		statuses: make(map[string]grpc_health_v1.HealthCheckResponse_ServingStatus),
	}
	hs.statuses[""] = grpc_health_v1.HealthCheckResponse_SERVING
	hs.statuses[commonagentv1.AgentService_ServiceDesc.ServiceName] = grpc_health_v1.HealthCheckResponse_SERVING
	s.healthSrv = hs

	grpc_health_v1.RegisterHealthServer(srv, hs)
}

// Run executes an agent and streams events back to the client.
func (s *GRPCServer) Run(req *commonagentv1.RunRequest, stream grpc.ServerStreamingServer[commonagentv1.AgentEvent]) error {
	ctx := stream.Context()

	if err := s.checkAuth(ctx); err != nil {
		return err
	}

	if req.Agent == "" || req.Prompt == "" {
		return status.Error(codes.InvalidArgument, "agent and prompt are required")
	}

	a, err := agent.LoadByName(s.agentsDir, req.Agent)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "load agent: %v", err)
	}

	p, err := s.newProvider(a)
	if err != nil {
		return status.Errorf(codes.Internal, "create provider: %v", err)
	}

	sess := session.New(a.Name)
	if msgs := ProtoMessagesToProvider(req.Messages); len(msgs) > 0 {
		sess.SetMessages(msgs)
	}

	var pol permission.Policy
	if a.Permissions != nil {
		pol = permission.NewAgentPolicy(*a.Permissions)
	} else {
		pol = permission.AllowAllPolicy{}
	}

	loopCfg := loop.Config{
		Provider: p,
		Registry: s.registry,
		Agent:    a,
		Session:  sess,
		Prompt:   req.Prompt,
		Logger:   s.logger,
		Store:    s.store,
		Policy:   pol,
		Approver: s.approver,
	}

	if req.SessionId != "" {
		if s.store == nil {
			return status.Error(codes.FailedPrecondition, "session persistence not configured")
		}
		if _, err := s.store.Load(req.SessionId); err != nil {
			if errors.Is(err, session.ErrNotFound) {
				return status.Errorf(codes.NotFound, "session %q not found", req.SessionId)
			}
			return status.Errorf(codes.Internal, "load session: %v", err)
		}
		loopCfg.SessionID = req.SessionId
	}

	events, err := loop.Run(ctx, loopCfg)
	if err != nil {
		return status.Errorf(codes.Internal, "run: %v", err)
	}

	s.logger.Info("grpc agent run started", "session_id", sess.ID, "agent", a.Name, "provider", a.Provider, "model", a.Model)

	for ev := range events {
		if err := stream.Send(EventToProto(ev)); err != nil {
			return err
		}
	}

	return nil
}

// Approve resolves a pending tool approval.
func (s *GRPCServer) Approve(ctx context.Context, req *commonagentv1.ApproveRequest) (*commonagentv1.ApproveResponse, error) {
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	if req.ApprovalId == "" {
		return nil, status.Error(codes.InvalidArgument, "approval_id is required")
	}

	resolved := s.approver.ResolveApproval(req.ApprovalId, req.Approved)
	if !resolved {
		return nil, status.Errorf(codes.NotFound, "no pending approval for %q", req.ApprovalId)
	}

	return &commonagentv1.ApproveResponse{
		Resolved:   true,
		ApprovalId: req.ApprovalId,
		Approved:   req.Approved,
	}, nil
}

// ListTools returns all registered tools.
func (s *GRPCServer) ListTools(ctx context.Context, _ *commonagentv1.ListToolsRequest) (*commonagentv1.ListToolsResponse, error) {
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	tools := s.registry.List()
	result := make([]*commonagentv1.ToolInfo, len(tools))
	for i, t := range tools {
		params, _ := json.Marshal(t.InputSchema())
		result[i] = &commonagentv1.ToolInfo{
			Name:        t.Name(),
			Description: t.Description(),
			Parameters:  params,
		}
	}
	return &commonagentv1.ListToolsResponse{Tools: result}, nil
}

// ListAgents returns all loaded agents.
func (s *GRPCServer) ListAgents(ctx context.Context, _ *commonagentv1.ListAgentsRequest) (*commonagentv1.ListAgentsResponse, error) {
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
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	a, err := s.svc.GetAgent(req.Name)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, status.Errorf(codes.NotFound, "agent %q not found", req.Name)
		}
		return nil, status.Errorf(codes.InvalidArgument, "load agent: %v", err)
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
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	if err := s.svc.SaveAgent(req.Name, req.YamlContent); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "save agent: %v", err)
	}
	return &commonagentv1.UpdateAgentResponse{Name: service.NormalizeAgentName(req.Name)}, nil
}

// DeleteAgent deletes an agent YAML.
func (s *GRPCServer) DeleteAgent(ctx context.Context, req *commonagentv1.DeleteAgentRequest) (*commonagentv1.DeleteAgentResponse, error) {
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	if err := s.svc.DeleteAgent(req.Name); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, status.Errorf(codes.NotFound, "agent %q not found", req.Name)
		}
		return nil, status.Errorf(codes.Internal, "delete agent: %v", err)
	}
	return &commonagentv1.DeleteAgentResponse{}, nil
}

// ListSessions returns all persisted sessions.
func (s *GRPCServer) ListSessions(ctx context.Context, _ *commonagentv1.ListSessionsRequest) (*commonagentv1.ListSessionsResponse, error) {
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	metas, err := s.svc.ListSessions()
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "%v", err)
	}

	items := make([]*commonagentv1.SessionMeta, len(metas))
	for i, m := range metas {
		items[i] = &commonagentv1.SessionMeta{
			Id:        m.ID,
			AgentName: m.Agent,
			UpdatedAt: m.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
	}
	return &commonagentv1.ListSessionsResponse{Sessions: items}, nil
}

// GetSession returns a specific session with its messages.
func (s *GRPCServer) GetSession(ctx context.Context, req *commonagentv1.GetSessionRequest) (*commonagentv1.GetSessionResponse, error) {
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	sess, err := s.svc.LoadSession(req.Id)
	if err != nil {
		if errors.Is(err, session.ErrNotFound) {
			return nil, status.Errorf(codes.NotFound, "session %q not found", req.Id)
		}
		return nil, status.Errorf(codes.InvalidArgument, "%v", err)
	}

	msgs := sess.GetMessages()
	protoMsgs := make([]*commonagentv1.Message, len(msgs))
	for i, m := range msgs {
		protoMsgs[i] = &commonagentv1.Message{
			Role:    string(m.Role),
			Content: m.Content,
		}
	}

	return &commonagentv1.GetSessionResponse{
		Id:        sess.ID,
		AgentName: sess.Agent,
		Messages:  protoMsgs,
	}, nil
}

// DeleteSession deletes a persisted session.
func (s *GRPCServer) DeleteSession(ctx context.Context, req *commonagentv1.DeleteSessionRequest) (*commonagentv1.DeleteSessionResponse, error) {
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	if err := s.svc.DeleteSession(req.Id); err != nil {
		if errors.Is(err, session.ErrNotFound) {
			return nil, status.Errorf(codes.NotFound, "session %q not found", req.Id)
		}
		return nil, status.Errorf(codes.InvalidArgument, "%v", err)
	}
	return &commonagentv1.DeleteSessionResponse{}, nil
}

// ensure compilation
var _ commonagentv1.AgentServiceServer = (*GRPCServer)(nil)
var _ grpc_health_v1.HealthServer = (*grpcHealthService)(nil)

// ─── gRPC Health Check Integration ────────────────────────────────

// grpcHealthService implements grpc_health_v1.HealthServer with
// component-level readiness checks from telemetry.HealthServer.
type grpcHealthService struct {
	grpc_health_v1.UnimplementedHealthServer
	grpcSrv  *GRPCServer
	mu       sync.RWMutex
	statuses map[string]grpc_health_v1.HealthCheckResponse_ServingStatus
}

// Check returns the serving status for the requested service.
// Before checking, it refreshes status based on registered component checkers.
func (h *grpcHealthService) Check(ctx context.Context, req *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	h.refreshStatus(ctx)

	h.mu.RLock()
	status, ok := h.statuses[req.Service]
	h.mu.RUnlock()

	if !ok {
		return &grpc_health_v1.HealthCheckResponse{
			Status: grpc_health_v1.HealthCheckResponse_SERVICE_UNKNOWN,
		}, nil
	}
	return &grpc_health_v1.HealthCheckResponse{Status: status}, nil
}

// Watch streams health status changes. For simplicity, it sends the current
// status and then waits for context cancellation (no change notifications).
func (h *grpcHealthService) Watch(req *grpc_health_v1.HealthCheckRequest, stream grpc_health_v1.Health_WatchServer) error {
	resp, err := h.Check(stream.Context(), req)
	if err != nil {
		return err
	}
	if err := stream.Send(resp); err != nil {
		return err
	}
	// Block until client disconnects (no change notifications implemented).
	<-stream.Context().Done()
	return stream.Context().Err()
}

// refreshStatus checks all registered telemetry components and updates
// the gRPC health serving status accordingly.
func (h *grpcHealthService) refreshStatus(ctx context.Context) {
	h.grpcSrv.healthMu.RLock()
	health := h.grpcSrv.health
	h.grpcSrv.healthMu.RUnlock()

	if health == nil {
		return
	}

	status := grpc_health_v1.HealthCheckResponse_SERVING
	if err := health.CheckAll(ctx); err != nil {
		status = grpc_health_v1.HealthCheckResponse_NOT_SERVING
	}

	h.mu.Lock()
	h.statuses[""] = status
	h.statuses[commonagentv1.AgentService_ServiceDesc.ServiceName] = status
	h.mu.Unlock()
}
