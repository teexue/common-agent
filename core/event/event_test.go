package event_test

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/teexue/common-agent/core/event"
)

func TestStreamEvents(t *testing.T) {
	events := make(chan event.Event, 2)
	events <- event.Event{Type: event.TypeTextDelta, Content: "hello"}
	events <- event.Event{Type: event.TypeDone, Status: "completed"}
	close(events)

	var buf bytes.Buffer
	err := event.StreamEvents(context.Background(), &buf, events)
	if err != nil {
		t.Fatalf("StreamEvents: %v", err)
	}
	output := buf.String()
	if !strings.Contains(output, "hello") {
		t.Fatalf("expected 'hello' in output, got: %s", output)
	}
}

func TestStreamEventsContextCancel(t *testing.T) {
	events := make(chan event.Event)
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	var buf bytes.Buffer
	err := event.StreamEvents(ctx, &buf, events)
	if err == nil {
		t.Fatal("expected context error")
	}
}

func TestPrintEvents(t *testing.T) {
	events := make(chan event.Event, 3)
	events <- event.Event{Type: event.TypeReasoningDelta, Content: "thinking..."}
	events <- event.Event{Type: event.TypeToolStart, Tool: "echo"}
	events <- event.Event{Type: event.TypeDone, Status: "completed", Turns: 1}
	close(events)

	// PrintEvents writes to stdout, so just verify it doesn't panic.
	event.PrintEvents(events)
}
