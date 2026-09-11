package subagent

import (
	"context"
	"sync"

	"github.com/teexue/common-agent/core/loop"
)

// Process-wide FIFO-ish gate: blocked acquires wait until a slot frees.
var (
	slotsMu sync.Mutex
	slots   chan struct{}
	slotsN  int
)

// tryAcquireSlot reserves a slot without blocking. ok is false when all slots are busy.
func tryAcquireSlot(max int) (release func(), ok bool) {
	if max <= 0 {
		max = loop.DefaultSubagentMaxConcurrent
	}
	ch := ensureSlots(max)
	select {
	case ch <- struct{}{}:
		return func() { <-ch }, true
	default:
		return nil, false
	}
}

// acquireSlot reserves one concurrent child-run slot (or waits until one is free).
func acquireSlot(ctx context.Context, max int) (release func(), err error) {
	if max <= 0 {
		max = loop.DefaultSubagentMaxConcurrent
	}
	ch := ensureSlots(max)
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case ch <- struct{}{}:
		return func() { <-ch }, nil
	}
}

func ensureSlots(max int) chan struct{} {
	slotsMu.Lock()
	defer slotsMu.Unlock()
	if slots == nil {
		slots = make(chan struct{}, max)
		slotsN = max
	}
	_ = slotsN // capacity fixed for process lifetime after first acquire
	return slots
}

// ResetSlotsForTest clears the process gate (tests only).
func ResetSlotsForTest() {
	slotsMu.Lock()
	defer slotsMu.Unlock()
	slots = nil
	slotsN = 0
}
