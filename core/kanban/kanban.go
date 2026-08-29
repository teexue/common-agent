// Package kanban implements the kanban work-item state machine and a
// background worker that executes pending items via an agent run.
package kanban

import (
	"crypto/rand"
	"fmt"
	"time"
)

// Kanban item statuses: pending → running → review → done. Execution errors
// send an item back to pending (or to failed after MaxAttempts).
const (
	// StatusPending is the queue state: the worker has not started, or a failed
	// run was retried while still under MaxAttempts.
	StatusPending = "pending"
	// StatusRunning means a worker is currently executing this item's agent run.
	StatusRunning = "running"
	// StatusReview waits for a human approve/reject before the item can close.
	StatusReview = "review"
	// StatusDone is the terminal success state after approval (or auto-complete).
	StatusDone = "done"
	// StatusFailed is the terminal error state after MaxAttempts execution failures.
	StatusFailed = "failed"
)

const (
	// PriorityLow is the lowest ClaimNextPending scheduling weight (API value 1).
	PriorityLow = 1
	// PriorityMedium sits between low and high when ordering the pending queue.
	PriorityMedium = 2
	// PriorityHigh jumps an item ahead of medium/low in ClaimNextPending
	// (order is priority desc, then oldest created_at).
	PriorityHigh = 3
)

// MaxAttempts is the number of execution failures after which an item is
// marked failed instead of returning to pending.
const MaxAttempts = 3

// NewID generates a kanban item id.
func NewID() string {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("kb_%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("kb_%x", b)
}
