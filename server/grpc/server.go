package grpcapi

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
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
	approver    *GRPCApprover
}

// NewGRPCServer creates a GRPCServer.
func NewGRPCServer(
	agentsDir string,
	reg *registry.Registry,
	newProvider func(a *agent.Agent) (provider.Provider, error),
	logger *slog.Logger,
	store session.Store,
) *GRPCServer {
	return &GRPCServer{
		agentsDir:   agentsDir,
		registry:    reg,
		newProvider: newProvider,
		logger:      logger,
		store:       store,
		approver:    NewGRPCApprover(),
	}
}

// RegisterServer registers the GRPCServer on the given gRPC server.
func (s *GRPCServer) RegisterServer(srv *grpc.Server) {
	commonagentv1.RegisterAgentServiceServer(srv, s)
}

// Run executes an agent and streams events back to the client.
func (s *GRPCServer) Run(req *commonagentv1.RunRequest, stream grpc.ServerStreamingServer[commonagentv1.AgentEvent]) error {
	ctx := stream.Context()

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
			if errors.Is(err, os.ErrNotExist) {
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
func (s *GRPCServer) Approve(_ context.Context, req *commonagentv1.ApproveRequest) (*commonagentv1.ApproveResponse, error) {
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
func (s *GRPCServer) ListTools(_ context.Context, _ *commonagentv1.ListToolsRequest) (*commonagentv1.ListToolsResponse, error) {
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
func (s *GRPCServer) ListAgents(_ context.Context, _ *commonagentv1.ListAgentsRequest) (*commonagentv1.ListAgentsResponse, error) {
	all, err := agent.LoadAll(s.agentsDir)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "load agents: %v", err)
	}
	for _, e := range all.Errors {
		s.logger.Warn("failed to load agent", "name", e.Name, "error", e.Err)
	}

	items := make([]*commonagentv1.AgentListItem, len(all.Agents))
	for i, a := range all.Agents {
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
func (s *GRPCServer) GetAgent(_ context.Context, req *commonagentv1.GetAgentRequest) (*commonagentv1.GetAgentResponse, error) {
	if req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "agent name is required")
	}

	a, err := agent.LoadByName(s.agentsDir, strings.TrimSuffix(req.Name, ".yaml"))
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, status.Errorf(codes.NotFound, "agent %q not found", req.Name)
		}
		return nil, status.Errorf(codes.Internal, "load agent: %v", err)
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

// ListSessions returns all persisted sessions.
func (s *GRPCServer) ListSessions(_ context.Context, _ *commonagentv1.ListSessionsRequest) (*commonagentv1.ListSessionsResponse, error) {
	if s.store == nil {
		return nil, status.Error(codes.FailedPrecondition, "session persistence not configured")
	}

	metas, err := s.store.List()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list sessions: %v", err)
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
func (s *GRPCServer) GetSession(_ context.Context, req *commonagentv1.GetSessionRequest) (*commonagentv1.GetSessionResponse, error) {
	if s.store == nil {
		return nil, status.Error(codes.FailedPrecondition, "session persistence not configured")
	}
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "session id is required")
	}

	sess, err := s.store.Load(req.Id)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, status.Errorf(codes.NotFound, "session %q not found", req.Id)
		}
		return nil, status.Errorf(codes.Internal, "load session: %v", err)
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
func (s *GRPCServer) DeleteSession(_ context.Context, req *commonagentv1.DeleteSessionRequest) (*commonagentv1.DeleteSessionResponse, error) {
	if s.store == nil {
		return nil, status.Error(codes.FailedPrecondition, "session persistence not configured")
	}
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "session id is required")
	}

	if err := s.store.Delete(req.Id); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, status.Errorf(codes.NotFound, "session %q not found", req.Id)
		}
		return nil, status.Errorf(codes.Internal, "delete session: %v", err)
	}

	return &commonagentv1.DeleteSessionResponse{}, nil
}

// ensure compilation
var _ commonagentv1.AgentServiceServer = (*GRPCServer)(nil)
