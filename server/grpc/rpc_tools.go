package grpcapi

import (
	"context"
	"encoding/json"

	commonagentv1 "github.com/teexue/common-agent/proto"
)

// ListTools returns all registered tools.
func (s *GRPCServer) ListTools(ctx context.Context, _ *commonagentv1.ListToolsRequest) (*commonagentv1.ListToolsResponse, error) {
	ctx = withRequestLocale(ctx)
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
