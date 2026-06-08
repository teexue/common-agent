package loop

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"

	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/scenario"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tool"
)

// ToolRegistry resolves tools by name.
type ToolRegistry interface {
	Get(name string) (tool.Tool, bool)
	Definitions(names []string) ([]provider.ToolDefinition, error)
}

// Config configures a single agent run.
type Config struct {
	Provider provider.Provider
	Registry ToolRegistry
	Scenario *scenario.Scenario
	Session  *session.Session
	Prompt   string
	Logger   *slog.Logger
}

// Run executes the agent loop and streams events.
func Run(ctx context.Context, cfg Config) (<-chan event.Event, error) {
	if cfg.Provider == nil {
		return nil, fmt.Errorf("provider is required")
	}
	if cfg.Registry == nil {
		return nil, fmt.Errorf("registry is required")
	}
	if cfg.Scenario == nil {
		return nil, fmt.Errorf("scenario is required")
	}
	if cfg.Session == nil {
		return nil, fmt.Errorf("session is required")
	}
	if cfg.Prompt == "" && len(cfg.Session.GetMessages()) == 0 {
		return nil, fmt.Errorf("prompt is required for a new session")
	}

	toolDefs, err := cfg.Registry.Definitions(cfg.Scenario.Tools)
	if err != nil {
		return nil, err
	}

	msgs := cfg.Session.GetMessages()
	if len(msgs) == 0 {
		msgs = []provider.Message{
			{Role: provider.RoleSystem, Content: cfg.Scenario.SystemPrompt},
		}
		cfg.Session.SetMessages(msgs)
	}
	if cfg.Prompt != "" {
		cfg.Session.AddMessages(provider.Message{
			Role:    provider.RoleUser,
			Content: cfg.Prompt,
		})
	}

	out := make(chan event.Event)
	go func() {
		defer close(out)
		runLoop(ctx, cfg, toolDefs, out)
	}()
	return out, nil
}

func runLoop(ctx context.Context, cfg Config, toolDefs []provider.ToolDefinition, out chan<- event.Event) {
	maxTurns := cfg.Scenario.MaxTurns
	execMode := cfg.Scenario.ToolExecMode()
	maxParallel := cfg.Scenario.ToolMaxParallel()
	log := cfg.Logger
	if log == nil {
		log = slog.Default()
	}

	for turn := 1; turn <= maxTurns; turn++ {
		select {
		case <-ctx.Done():
			forceEmit(out, event.Event{Type: event.TypeError, Code: "cancelled", Message: ctx.Err().Error()})
			forceEmit(out, event.Event{Type: event.TypeDone, Status: "cancelled", Turns: turn})
			return
		default:
		}

		req := provider.Request{
			Model:     cfg.Scenario.Model,
			Messages:  cfg.Session.GetMessages(),
			Tools:     toolDefs,
			MaxTokens: cfg.Scenario.MaxTokens,
		}

		chunks, err := cfg.Provider.Stream(ctx, req)
		if err != nil {
			forceEmit(out, event.Event{Type: event.TypeError, Code: "provider_error", Message: err.Error()})
			forceEmit(out, event.Event{Type: event.TypeDone, Status: "failed", Turns: turn})
			return
		}

		var assistantText string
		var reasoningText string
		var assistantToolCalls []provider.ToolCall

		// Streaming tool execution for parallel mode.
		type pendingResult struct {
			idx      int
			callID   string
			toolName string
			output   json.RawMessage
		}
		resultCh := make(chan pendingResult, maxParallel*2)
		var execWg sync.WaitGroup // declared but only used in parallel mode
		sem := make(chan struct{}, maxParallel)
		toolIdx := 0

		// readStream consumes provider chunks. Tool calls are executed
		// immediately in parallel mode or collected for serial mode.
		for chunk := range chunks {
			if chunk.ReasoningDelta != "" {
				reasoningText += chunk.ReasoningDelta
				emit(ctx, out, event.Event{Type: event.TypeReasoningDelta, Content: chunk.ReasoningDelta})
			}
			if chunk.TextDelta != "" {
				assistantText += chunk.TextDelta
				emit(ctx, out, event.Event{Type: event.TypeTextDelta, Content: chunk.TextDelta})
			}
			for _, tc := range chunk.ToolCalls {
				assistantToolCalls = append(assistantToolCalls, tc)
				if execMode == "parallel" {
					idx := toolIdx
					toolIdx++
					execWg.Add(1)
					go func(tc provider.ToolCall, idx int) {
						defer execWg.Done()
						// Respect context cancellation.
						select {
						case <-ctx.Done():
							return
						case sem <- struct{}{}:
						}
						defer func() { <-sem }()

						res := executeOneTool(ctx, cfg.Registry, tc, out, log)
						select {
						case resultCh <- pendingResult{
							idx: idx, callID: tc.ID, toolName: tc.Name, output: res,
						}:
						case <-ctx.Done():
						}
					}(tc, idx)
				} else {
					toolIdx++
				}
			}
		}

		// Check if context was cancelled during stream processing.
		select {
		case <-ctx.Done():
			forceEmit(out, event.Event{Type: event.TypeError, Code: "cancelled", Message: ctx.Err().Error()})
			forceEmit(out, event.Event{Type: event.TypeDone, Status: "cancelled", Turns: turn})
			return
		default:
		}

		// No tool calls → assistant text-only response → done.
		if len(assistantToolCalls) == 0 {
			cfg.Session.AddMessages(provider.Message{
				Role:             provider.RoleAssistant,
				Content:          assistantText,
				ReasoningContent: reasoningText,
			})
			forceEmit(out, event.Event{Type: event.TypeDone, Status: "completed", Turns: turn})
			return
		}

		// Record the assistant message (with tool calls).
		cfg.Session.AddMessages(provider.Message{
			Role:             provider.RoleAssistant,
			Content:          assistantText,
			ReasoningContent: reasoningText,
			ToolCalls:        assistantToolCalls,
		})

		// Collect tool results in order.
		var toolResults []pendingResult
		if execMode == "parallel" {
			go func() {
				execWg.Wait()
				close(resultCh)
			}()
			// Build index-preserving slice.
			byIndex := make(map[int]pendingResult)
			for r := range resultCh {
				byIndex[r.idx] = r
			}
			for i := 0; i < toolIdx; i++ {
				if r, ok := byIndex[i]; ok {
					toolResults = append(toolResults, r)
				}
			}
		} else {
			// Serial mode: execute one at a time after all tool calls received.
			for i, tc := range assistantToolCalls {
				res := executeOneTool(ctx, cfg.Registry, tc, out, log)
				toolResults = append(toolResults, pendingResult{
					idx:      i,
					callID:   tc.ID,
					toolName: tc.Name,
					output:   res,
				})
			}
		}

		// Record tool results in session.
		for _, tr := range toolResults {
			cfg.Session.AddMessages(provider.Message{
				Role:       provider.RoleTool,
				ToolCallID: tr.callID,
				Name:       tr.toolName,
				Content:    string(tr.output),
			})
		}
	}

	forceEmit(out, event.Event{Type: event.TypeError, Code: "max_turns", Message: fmt.Sprintf("exceeded max turns %d", maxTurns)})
	forceEmit(out, event.Event{Type: event.TypeDone, Status: "failed", Turns: maxTurns})
}

// executeOneTool runs a single tool call and emits tool_start / tool_result events.
func executeOneTool(ctx context.Context, reg ToolRegistry, call provider.ToolCall, out chan<- event.Event, log *slog.Logger) json.RawMessage {
	var input any
	if err := json.Unmarshal(call.Arguments, &input); err != nil {
		log.Warn("unmarshal tool arguments", "tool", call.Name, "error", err)
		input = string(call.Arguments)
	}
	inputJSON, err := json.Marshal(input)
	if err != nil {
		log.Warn("marshal tool input", "tool", call.Name, "error", err)
		inputJSON = call.Arguments
	}
	emit(ctx, out, event.Event{Type: event.TypeToolStart, Tool: call.Name, Input: json.RawMessage(inputJSON)})

	t, ok := reg.Get(call.Name)
	if !ok {
		errJSON, _ := json.Marshal(map[string]string{"error": "tool not found"})
		emit(ctx, out, event.Event{
			Type:   event.TypeToolResult,
			Tool:   call.Name,
			Output: json.RawMessage(errJSON),
		})
		return json.RawMessage(errJSON)
	}

	res, execErr := t.Execute(ctx, call.Arguments)
	if execErr != nil {
		outVal, _ := json.Marshal(map[string]string{"error": execErr.Error()})
		emit(ctx, out, event.Event{Type: event.TypeToolResult, Tool: call.Name, Output: json.RawMessage(outVal)})
		return json.RawMessage(outVal)
	}

	emit(ctx, out, event.Event{Type: event.TypeToolResult, Tool: call.Name, Output: res.Output})
	return res.Output
}

func emit(ctx context.Context, out chan<- event.Event, ev event.Event) {
	select {
	case out <- ev:
	case <-ctx.Done():
	}
}

// forceEmit sends an event to the channel without checking ctx cancellation.
// Used for terminal events (cancelled, done) that must always be delivered.
func forceEmit(out chan<- event.Event, ev event.Event) {
	out <- ev
}
