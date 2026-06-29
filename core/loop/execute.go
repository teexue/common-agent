package loop

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/hook"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/telemetry"
	"github.com/teexue/common-agent/core/tool"
)

// ToolExecContext holds dependencies for executing a single tool call.
type ToolExecContext struct {
	Ctx      context.Context
	Reg      ToolRegistry
	Call     provider.ToolCall
	Out      chan<- event.Event
	Log      *slog.Logger
	Pol      permission.Policy
	Hooks    *hook.Chain
	Approver Approver
}

// executeOneTool runs a single tool call and emits tool_start / tool_result events.
func executeOneTool(tc ToolExecContext) json.RawMessage {
	return executeTool(tc)
}

func executeTool(tc ToolExecContext) json.RawMessage {
	inputJSON := prepareInput(tc.Call.Arguments, tc.Log)
	emit(tc.Ctx, tc.Out, event.Event{Type: event.TypeToolStart, Tool: tc.Call.Name, Input: json.RawMessage(inputJSON), ToolCallID: tc.Call.ID})

	if result, denied := checkPermission(tc.Ctx, tc.Pol, tc.Approver, tc.Call, tc.Out); denied {
		return result
	}

	fireOnToolStartHook(tc.Hooks, tc.Call, tc.Log)

	t, ok := tc.Reg.Get(tc.Call.Name)
	if !ok {
		return emitToolNotFound(tc.Ctx, tc.Hooks, tc.Call, tc.Out)
	}

	res, execErr := executeWithTelemetry(tc.Ctx, t, tc.Call, tc.Out)

	if execErr != nil {
		return emitToolError(tc.Ctx, tc.Hooks, tc.Call, execErr, tc.Out)
	}

	if tc.Hooks != nil {
		tc.Hooks.OnToolResult(tc.Ctx, hook.ToolResultInfo{Name: tc.Call.Name, Output: res.Output})
	}
	emit(tc.Ctx, tc.Out, event.Event{Type: event.TypeToolResult, Tool: tc.Call.Name, Output: res.Output, ToolCallID: tc.Call.ID})
	return res.Output
}

// prepareInput normalizes tool arguments for display.
func prepareInput(args json.RawMessage, log *slog.Logger) json.RawMessage {
	var input any
	if err := json.Unmarshal(args, &input); err != nil {
		log.Warn("unmarshal tool arguments", "error", err)
		input = string(args)
	}
	inputJSON, err := json.Marshal(input)
	if err != nil {
		log.Warn("marshal tool input", "error", err)
		return args
	}
	return inputJSON
}

// checkPermission evaluates the tool permission policy. Returns a result and
// true if the tool was denied, or zero value and false if allowed.
func checkPermission(ctx context.Context, pol permission.Policy, approver Approver, call provider.ToolCall, out chan<- event.Event) (json.RawMessage, bool) {
	decision := pol.Check(permission.ToolCall{Name: call.Name, Arguments: call.Arguments})

	if decision == permission.Deny {
		errJSON, _ := json.Marshal(map[string]string{"error": "permission denied", "tool": call.Name})
		emit(ctx, out, event.Event{Type: event.TypeToolResult, Tool: call.Name, Output: json.RawMessage(errJSON), ToolCallID: call.ID})
		return json.RawMessage(errJSON), true
	}

	if decision == permission.Confirm {
		emit(ctx, out, event.Event{
			Type: event.TypeToolApproval, Tool: call.Name,
			Input: call.Arguments, ToolCallID: call.ID, ApprovalID: call.ID,
		})
		approved := approver.Approve(ctx, ApprovalRequest{
			Tool: call.Name, Arguments: call.Arguments, ApprovalID: call.ID,
		})
		if !approved {
			errJSON, _ := json.Marshal(map[string]string{"error": "tool approval denied", "tool": call.Name})
			emit(ctx, out, event.Event{Type: event.TypeToolResult, Tool: call.Name, Output: json.RawMessage(errJSON), ToolCallID: call.ID})
			return json.RawMessage(errJSON), true
		}
	}

	return nil, false
}

func fireOnToolStartHook(hooks *hook.Chain, call provider.ToolCall, log *slog.Logger) {
	if hooks != nil {
		if err := hooks.OnToolStart(context.Background(), hook.ToolStartInfo{Name: call.Name, Arguments: call.Arguments}); err != nil {
			log.Warn("hook OnToolStart error", "tool", call.Name, "error", err)
		}
	}
}

func emitToolNotFound(ctx context.Context, hooks *hook.Chain, call provider.ToolCall, out chan<- event.Event) json.RawMessage {
	errJSON, _ := json.Marshal(map[string]string{"error": "tool not found"})
	if hooks != nil {
		hooks.OnToolResult(ctx, hook.ToolResultInfo{Name: call.Name, Output: errJSON, Error: fmt.Errorf("tool not found")})
	}
	emit(ctx, out, event.Event{Type: event.TypeToolResult, Tool: call.Name, Output: json.RawMessage(errJSON), ToolCallID: call.ID})
	return json.RawMessage(errJSON)
}

// executeWithTelemetry runs the tool with telemetry tracing.
func executeWithTelemetry(ctx context.Context, t tool.Tool, call provider.ToolCall, out chan<- event.Event) (tool.Result, error) {
	toolCtx := context.WithValue(ctx, "parent_event_chan", out)
	toolStart := time.Now()
	var toolSpan trace.Span
	if tel, ok := ctx.Value("telemetry").(*telemetry.Telemetry); ok && tel != nil {
		toolCtx, toolSpan = tel.StartTool(toolCtx, call.Name)
	}

	res, execErr := t.Execute(toolCtx, call.Arguments)
	toolDuration := time.Since(toolStart)

	if toolSpan != nil {
		toolSpan.End()
	}
	if tel, ok := ctx.Value("telemetry").(*telemetry.Telemetry); ok && tel != nil {
		tel.RecordToolDuration(ctx, toolDuration, attribute.String("tool.name", call.Name))
		if execErr != nil {
			tel.RecordToolError(ctx, attribute.String("tool.name", call.Name))
		}
	}

	return res, execErr
}

func emitToolError(ctx context.Context, hooks *hook.Chain, call provider.ToolCall, execErr error, out chan<- event.Event) json.RawMessage {
	outVal, _ := json.Marshal(map[string]string{"error": execErr.Error()})
	if hooks != nil {
		hooks.OnToolResult(ctx, hook.ToolResultInfo{Name: call.Name, Output: outVal, Error: execErr})
	}
	emit(ctx, out, event.Event{Type: event.TypeToolResult, Tool: call.Name, Output: json.RawMessage(outVal), ToolCallID: call.ID})
	return json.RawMessage(outVal)
}
