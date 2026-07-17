package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/provider"
)

const optimizeSystemPrompt = `你是一个提示词优化专家。你的任务是理解用户的原始意图，并将其优化为更清晰、更具体、更结构化的提示词。
规则：
1. 保持用户的原始意图不变
2. 补充必要的上下文和约束条件
3. 使指令更明确、可执行
4. 如果提示词已经足够清晰，可以只做微调
5. 只返回优化后的提示词，不要添加任何解释或前缀`

// OptimizePrompt calls the LLM to optimize a user's prompt for intent clarity.
// It uses the specified agent's provider and model, or the first available agent
// when agentName is empty.
func (s *Service) OptimizePrompt(ctx context.Context, prompt string, agentName string) (string, error) {
	if prompt == "" {
		return "", &ArgError{Field: "prompt", Message: "prompt is required"}
	}

	a, err := s.resolveAgentForOptimize(agentName)
	if err != nil {
		return "", err
	}

	p, err := s.NewProvider(a)
	if err != nil {
		return "", &ServerError{Message: fmt.Sprintf("create provider: %v", err)}
	}

	req := provider.Request{
		Model: a.Model,
		Messages: []provider.Message{
			{Role: provider.RoleSystem, Content: optimizeSystemPrompt},
			{Role: provider.RoleUser, Content: prompt},
		},
		MaxTokens: 2048,
	}

	ch, err := p.Stream(ctx, req)
	if err != nil {
		return "", &ServerError{Message: fmt.Sprintf("stream: %v", err)}
	}

	var result strings.Builder
	for chunk := range ch {
		if chunk.TextDelta != "" {
			result.WriteString(chunk.TextDelta)
		}
		if chunk.Done {
			break
		}
	}

	optimized := strings.TrimSpace(result.String())
	if optimized == "" {
		return "", &ServerError{Message: "LLM returned empty response"}
	}
	return optimized, nil
}

// resolveAgentForOptimize loads the named agent, or the first available agent
// when agentName is empty.
func (s *Service) resolveAgentForOptimize(agentName string) (*agent.Agent, error) {
	if agentName != "" {
		a, err := agent.LoadByName(s.AgentsDir, NormalizeAgentName(agentName))
		if err != nil {
			return nil, fmt.Errorf("load agent: %w", err)
		}
		return a, nil
	}

	names, err := agent.ListAvailable(s.AgentsDir)
	if err != nil {
		return nil, fmt.Errorf("list agents: %w", err)
	}
	if len(names) == 0 {
		return nil, &ArgError{Field: "agent", Message: "no agents configured"}
	}
	return agent.LoadByName(s.AgentsDir, names[0])
}
