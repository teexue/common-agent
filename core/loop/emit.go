package loop

import (
	"context"
	"log/slog"
	"time"

	"github.com/teexue/common-agent/core/event"
)

// emit sends an event to the channel, respecting context cancellation.
func emit(ctx context.Context, out chan<- event.Event, ev event.Event) {
	select {
	case out <- ev:
	case <-ctx.Done():
	}
}

// forceEmitTimeout is the maximum duration to wait for a terminal event
// to be delivered before falling back to a log warning.
var forceEmitTimeout = 5 * time.Second

// forceEmit sends a terminal event (cancelled, done, error) to the channel
// with a timeout fallback. If the consumer is stuck and the event cannot be
// delivered within forceEmitTimeout, the event is dropped and a warning is
// logged to prevent the loop from blocking indefinitely.
func forceEmit(out chan<- event.Event, ev event.Event) {
	timer := time.NewTimer(forceEmitTimeout)
	defer timer.Stop()
	select {
	case out <- ev:
	case <-timer.C:
		slog.Warn("log.event.force_emit_timeout",
			slog.String("event_type", string(ev.Type)),
			slog.String("status", ev.Status),
			slog.String("code", ev.Code),
		)
	}
}
