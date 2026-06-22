package telemetry

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

// Telemetry holds OpenTelemetry tracer and meter instances.
type Telemetry struct {
	Tracer trace.Tracer
	Meter  metric.Meter

	// Metrics.
	RunDuration    metric.Float64Histogram
	TurnCount      metric.Int64Counter
	ToolDuration   metric.Float64Histogram
	ToolErrorCount metric.Int64Counter
}

// New creates a Telemetry instance. If no OTLP endpoint is configured,
// it returns a no-op instance with zero overhead.
func New(serviceName string) (*Telemetry, error) {
	tracer := otel.Tracer(serviceName)
	meter := otel.Meter(serviceName)

	runDuration, err := meter.Float64Histogram(
		"agent.run.duration",
		metric.WithDescription("Duration of agent runs in seconds"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return nil, err
	}

	turnCount, err := meter.Int64Counter(
		"agent.turn.count",
		metric.WithDescription("Number of agent turns"),
	)
	if err != nil {
		return nil, err
	}

	toolDuration, err := meter.Float64Histogram(
		"agent.tool.duration",
		metric.WithDescription("Duration of tool executions in seconds"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return nil, err
	}

	toolErrorCount, err := meter.Int64Counter(
		"agent.tool.error.count",
		metric.WithDescription("Number of tool execution errors"),
	)
	if err != nil {
		return nil, err
	}

	return &Telemetry{
		Tracer:         tracer,
		Meter:          meter,
		RunDuration:    runDuration,
		TurnCount:      turnCount,
		ToolDuration:   toolDuration,
		ToolErrorCount: toolErrorCount,
	}, nil
}

// StartRun starts a span for an agent run and returns the context and span.
func (t *Telemetry) StartRun(ctx context.Context, agentName, model string) (context.Context, trace.Span) {
	return t.Tracer.Start(ctx, "agent.run",
		trace.WithAttributes(
			attribute.String("agent.name", agentName),
			attribute.String("agent.model", model),
		),
	)
}

// StartTurn starts a span for an agent turn.
func (t *Telemetry) StartTurn(ctx context.Context, turn int) (context.Context, trace.Span) {
	return t.Tracer.Start(ctx, "agent.turn",
		trace.WithAttributes(
			attribute.Int("turn", turn),
		),
	)
}

// StartTool starts a span for a tool execution.
func (t *Telemetry) StartTool(ctx context.Context, toolName string) (context.Context, trace.Span) {
	return t.Tracer.Start(ctx, "agent.tool."+toolName,
		trace.WithAttributes(
			attribute.String("tool.name", toolName),
		),
	)
}

// RecordRunDuration records the duration of a completed run.
func (t *Telemetry) RecordRunDuration(ctx context.Context, duration time.Duration, attrs ...attribute.KeyValue) {
	t.RunDuration.Record(ctx, duration.Seconds(), metric.WithAttributes(attrs...))
}

// RecordTurn records a completed turn.
func (t *Telemetry) RecordTurn(ctx context.Context, attrs ...attribute.KeyValue) {
	t.TurnCount.Add(ctx, 1, metric.WithAttributes(attrs...))
}

// RecordToolDuration records the duration of a tool execution.
func (t *Telemetry) RecordToolDuration(ctx context.Context, duration time.Duration, attrs ...attribute.KeyValue) {
	t.ToolDuration.Record(ctx, duration.Seconds(), metric.WithAttributes(attrs...))
}

// RecordToolError records a tool execution error.
func (t *Telemetry) RecordToolError(ctx context.Context, attrs ...attribute.KeyValue) {
	t.ToolErrorCount.Add(ctx, 1, metric.WithAttributes(attrs...))
}
