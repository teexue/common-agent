package loop

import (
	"context"

	"github.com/teexue/common-agent/core/permission"
)

// ApprovalRequest is sent to an Approver when a tool requires confirmation.
type ApprovalRequest struct {
	Tool       string
	Arguments  []byte
	ApprovalID string
}

// Approver handles interactive tool approval decisions.
// Implementations prompt the user (CLI) or wait for an HTTP response.
type Approver interface {
	// Approve asks the user to approve or deny a tool call.
	// Returns true if approved, false if denied.
	// The context may be cancelled if the stream is aborted.
	Approve(ctx context.Context, req ApprovalRequest) bool
}

// AutoApprover always approves. Used when no interactive approval is needed.
type AutoApprover struct{}

// Approve always returns true.
func (AutoApprover) Approve(_ context.Context, _ ApprovalRequest) bool {
	return true
}

// DenyAllApprover always denies. Used for non-interactive backends.
type DenyAllApprover struct{}

// Approve always returns false.
func (DenyAllApprover) Approve(_ context.Context, _ ApprovalRequest) bool {
	return false
}

// decisionNeedsApproval checks if a permission decision requires interactive approval.
func decisionNeedsApproval(d permission.Decision) bool {
	return d == permission.Confirm
}
