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
	StatusPending = "pending"
	StatusRunning = "running"
	StatusReview  = "review"
	StatusDone    = "done"
	StatusFailed  = "failed"
)

// Kanban item priorities.
const (
	PriorityLow    = 1
	PriorityMedium = 2
	PriorityHigh   = 3
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
