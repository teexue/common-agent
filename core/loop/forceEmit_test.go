package loop

import (
	"testing"
	"time"

	"github.com/teexue/common-agent/core/event"
)

// TestForceEmit_DeliversWhenConsumerReady verifies that forceEmit sends the
// event without delay when the consumer is ready to receive.
func TestForceEmit_DeliversWhenConsumerReady(t *testing.T) {
	out := make(chan event.Event, 1) // buffered so sender doesn't block
	ev := event.Event{Type: event.TypeDone, Status: "completed"}

	forceEmit(out, ev)

	select {
	case got := <-out:
		if got.Type != ev.Type || got.Status != ev.Status {
			t.Fatalf("got %+v, want %+v", got, ev)
		}
	default:
		t.Fatal("expected event to be delivered immediately")
	}
}

// TestForceEmit_DeliversToUnbufferedChannel verifies that forceEmit sends the
// event when a goroutine is actively reading from an unbuffered channel.
func TestForceEmit_DeliversToUnbufferedChannel(t *testing.T) {
	out := make(chan event.Event)
	ev := event.Event{Type: event.TypeDone, Status: "completed"}

	received := make(chan event.Event, 1)
	go func() {
		received <- <-out
	}()

	forceEmit(out, ev)

	select {
	case got := <-received:
		if got.Type != ev.Type || got.Status != ev.Status {
			t.Fatalf("got %+v, want %+v", got, ev)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event on unbuffered channel")
	}
}

// TestForceEmit_TimeoutOnStuckConsumer verifies that forceEmit does not block
// forever when no consumer is reading from the channel. It should time out
// and return, dropping the event with a warning log.
func TestForceEmit_TimeoutOnStuckConsumer(t *testing.T) {
	// Temporarily reduce the timeout so the test runs fast.
	original := forceEmitTimeout
	forceEmitTimeout = 50 * time.Millisecond
	defer func() { forceEmitTimeout = original }()

	out := make(chan event.Event) // no consumer, will block
	ev := event.Event{Type: event.TypeDone, Status: "completed"}

	start := time.Now()
	forcemitDone := make(chan struct{})
	go func() {
		forceEmit(out, ev)
		close(forcemitDone)
	}()

	select {
	case <-forcemitDone:
		elapsed := time.Since(start)
		if elapsed < 50*time.Millisecond {
			t.Fatalf("forceEmit returned too quickly: %v (expected at least 50ms)", elapsed)
		}
		if elapsed > 2*time.Second {
			t.Fatalf("forceEmit took too long: %v (expected ~50ms)", elapsed)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("forceEmit blocked for more than 5s; timeout fallback is not working")
	}

	// Verify the event was NOT delivered (it was dropped after timeout).
	select {
	case <-out:
		t.Fatal("event should have been dropped, not delivered")
	default:
		// Good — no event in the channel.
	}
}

// TestForceEmit_MultipleTimeouts verifies that consecutive forceEmit calls
// all time out gracefully when the consumer is stuck, without panicking.
func TestForceEmit_MultipleTimeouts(t *testing.T) {
	original := forceEmitTimeout
	forceEmitTimeout = 20 * time.Millisecond
	defer func() { forceEmitTimeout = original }()

	out := make(chan event.Event) // no consumer

	events := []event.Event{
		{Type: event.TypeError, Code: "cancelled", Message: "context cancelled"},
		{Type: event.TypeDone, Status: "cancelled"},
		{Type: event.TypeDone, Status: "failed"},
	}

	start := time.Now()
	for _, ev := range events {
		forceEmit(out, ev)
	}
	elapsed := time.Since(start)

	// 3 events × 20ms each = at least 60ms
	if elapsed < 60*time.Millisecond {
		t.Fatalf("expected at least 60ms for 3 timeouts, got %v", elapsed)
	}

	// Channel should be empty (all events dropped).
	select {
	case <-out:
		t.Fatal("no events should have been delivered")
	default:
	}
}
