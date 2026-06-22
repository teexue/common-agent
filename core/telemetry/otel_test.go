package telemetry

import (
	"context"
	"testing"
	"time"

	"go.opentelemetry.io/otel/attribute"
)

func TestNew(t *testing.T) {
	tel, err := New("test-service")
	if err != nil {
		t.Fatal(err)
	}
	if tel.Tracer == nil {
		t.Error("expected non-nil tracer")
	}
	if tel.Meter == nil {
		t.Error("expected non-nil meter")
	}
	if tel.RunDuration == nil {
		t.Error("expected non-nil RunDuration")
	}
	if tel.TurnCount == nil {
		t.Error("expected non-nil TurnCount")
	}
	if tel.ToolDuration == nil {
		t.Error("expected non-nil ToolDuration")
	}
	if tel.ToolErrorCount == nil {
		t.Error("expected non-nil ToolErrorCount")
	}
}

func TestTelemetry_StartRun(t *testing.T) {
	tel, _ := New("test")

	ctx, span := tel.StartRun(context.Background(), "demo", "gpt-4o")
	defer span.End()

	if span.SpanContext().SpanID().IsValid() {
		// span was created
	}
	_ = ctx
}

func TestTelemetry_StartTurn(t *testing.T) {
	tel, _ := New("test")

	ctx, span := tel.StartTurn(context.Background(), 1)
	defer span.End()

	// With noop tracer (no OTLP configured), span is valid but context may be invalid.
	if span == nil {
		t.Error("expected non-nil span")
	}
	_ = ctx
}

func TestTelemetry_StartTool(t *testing.T) {
	tel, _ := New("test")

	ctx, span := tel.StartTool(context.Background(), "echo")
	defer span.End()

	if span == nil {
		t.Error("expected non-nil span")
	}
	_ = ctx
}

func TestTelemetry_RecordRunDuration(t *testing.T) {
	tel, _ := New("test")

	ctx := context.Background()
	tel.RecordRunDuration(ctx, 1500*time.Millisecond,
		attribute.String("agent", "demo"),
	)
	// Should not panic.
}

func TestTelemetry_RecordTurn(t *testing.T) {
	tel, _ := New("test")

	ctx := context.Background()
	tel.RecordTurn(ctx, attribute.String("agent", "demo"))
	// Should not panic.
}

func TestTelemetry_RecordToolDuration(t *testing.T) {
	tel, _ := New("test")

	ctx := context.Background()
	tel.RecordToolDuration(ctx, 200*time.Millisecond,
		attribute.String("tool", "echo"),
	)
	// Should not panic.
}

func TestTelemetry_RecordToolError(t *testing.T) {
	tel, _ := New("test")

	ctx := context.Background()
	tel.RecordToolError(ctx, attribute.String("tool", "echo"))
	// Should not panic.
}

func TestTelemetry_SpanHierarchy(t *testing.T) {
	tel, _ := New("test")

	// Create a run span with nested turn and tool spans.
	runCtx, runSpan := tel.StartRun(context.Background(), "demo", "gpt-4o")
	turnCtx, turnSpan := tel.StartTurn(runCtx, 1)
	_, toolSpan := tel.StartTool(turnCtx, "echo")

	// With noop tracer, spans are non-nil but contexts may be invalid.
	if runSpan == nil || turnSpan == nil || toolSpan == nil {
		t.Error("expected non-nil spans")
	}

	toolSpan.End()
	turnSpan.End()
	runSpan.End()
}
