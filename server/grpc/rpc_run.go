package grpcapi

import (
	"context"
	"errors"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/i18n"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/session"
	commonagentv1 "github.com/teexue/common-agent/proto"
)

// Run executes an agent and streams events back to the client.
func (s *GRPCServer) Run(req *commonagentv1.RunRequest, stream grpc.ServerStreamingServer[commonagentv1.AgentEvent]) error {
	ctx := withRequestLocale(stream.Context())

	if err := s.checkAuth(ctx); err != nil {
		return err
	}

	if req.Agent == "" || req.Prompt == "" {
		return status.Error(codes.InvalidArgument, i18n.TCtx(ctx, "api.grpc.error.agent_prompt_required"))
	}

	a, err := agent.LoadByName(s.agentsDir, req.Agent)
	if err != nil {
		return status.Error(codes.InvalidArgument, i18n.TCtx(ctx, "api.grpc.error.load_agent", "error", err.Error()))
	}

	p, err := s.newProvider(a)
	if err != nil {
		return status.Error(codes.Internal, i18n.TCtx(ctx, "api.grpc.error.create_provider", "error", err.Error()))
	}

	sess := session.New(a.ID)
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
			return status.Error(codes.FailedPrecondition, i18n.TCtx(ctx, "api.grpc.error.session_not_configured"))
		}
		if _, err := s.store.Load(req.SessionId); err != nil {
			if errors.Is(err, session.ErrNotFound) {
				return status.Error(codes.NotFound, i18n.TCtx(ctx, "api.grpc.error.session_not_found", "id", req.SessionId))
			}
			return status.Error(codes.Internal, i18n.TCtx(ctx, "api.grpc.error.load_session", "error", err.Error()))
		}
		loopCfg.SessionID = req.SessionId
	}

	events, err := loop.Run(ctx, loopCfg)
	if err != nil {
		return status.Error(codes.Internal, i18n.TCtx(ctx, "api.grpc.error.run", "error", err.Error()))
	}

	s.logger.Info("log.grpc.agent_run_started", "session_id", sess.ID, "agent", a.Name, "provider", a.Provider, "model", a.Model)

	for ev := range events {
		if err := stream.Send(EventToProto(ev)); err != nil {
			return err
		}
	}

	return nil
}

// Approve resolves a pending tool approval.
func (s *GRPCServer) Approve(ctx context.Context, req *commonagentv1.ApproveRequest) (*commonagentv1.ApproveResponse, error) {
	ctx = withRequestLocale(ctx)
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	if req.ApprovalId == "" {
		return nil, status.Error(codes.InvalidArgument, i18n.TCtx(ctx, "api.grpc.error.approval_id_required"))
	}

	resolved := s.approver.ResolveApproval(req.ApprovalId, req.Approved)
	if !resolved {
		return nil, status.Error(codes.NotFound, i18n.TCtx(ctx, "api.grpc.error.approval_not_found", "id", req.ApprovalId))
	}

	return &commonagentv1.ApproveResponse{
		Resolved:   true,
		ApprovalId: req.ApprovalId,
		Approved:   req.Approved,
	}, nil
}
