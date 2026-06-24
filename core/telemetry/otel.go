package telemetry

import (
	"context"
	"os"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/metric"
	metricSDK "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	traceSDK "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

// Init initializes OpenTelemetry with an OTLP gRPC exporter.
// If OTEL_EXPORTER_OTLP_ENDPOINT is not set, it returns a no-op Telemetry
// with zero overhead (global providers stay as no-op).
// Returns the Telemetry instance and a shutdown function.
func Init(ctx context.Context, serviceName string) (*Telemetry, func(context.Context) error, error) {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		// No endpoint configured — return no-op telemetry.
		return newNoopTelemetry(serviceName)
	}

	// Create resource with service info.
	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
		),
	)
	if err != nil {
		return nil, nil, err
	}

	// Setup trace exporter + provider.
	traceExporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(endpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, nil, err
	}
	tp := traceSDK.NewTracerProvider(
		traceSDK.WithBatcher(traceExporter),
		traceSDK.WithResource(res),
	)
	otel.SetTracerProvider(tp)

	// Setup metric exporter + provider.
	metricExporter, err := otlpmetricgrpc.New(ctx,
		otlpmetricgrpc.WithEndpoint(endpoint),
		otlpmetricgrpc.WithInsecure(),
	)
	if err != nil {
		tp.Shutdown(ctx)
		return nil, nil, err
	}
	mp := metricSDK.NewMeterProvider(
		metricSDK.WithReader(metricSDK.NewPeriodicReader(metricExporter)),
		metricSDK.WithResource(res),
	)
	otel.SetMeterProvider(mp)

	t, err := New(serviceName)
	if err != nil {
		tp.Shutdown(ctx)
		mp.Shutdown(ctx)
		return nil, nil, err
	}

	shutdown := func(ctx context.Context) error {
		if err := tp.Shutdown(ctx); err != nil {
			return err
		}
		return mp.Shutdown(ctx)
	}

	return t, shutdown, nil
}

// newNoopTelemetry creates a Telemetry using the global no-op providers.
// When no OTLP endpoint is configured, OTel's default global providers are
// no-op implementations with zero overhead.
func newNoopTelemetry(serviceName string) (*Telemetry, func(context.Context) error, error) {
	// The global providers are no-op by default (before Init).
	// New() uses otel.Tracer/otel.Meter which return no-op implementations.
	t, err := New(serviceName)
	if err != nil {
		return nil, nil, err
	}
	shutdown := func(_ context.Context) error { return nil }
	return t, shutdown, nil
}

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
