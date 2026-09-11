package loop

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsDelegateTool(t *testing.T) {
	assert.True(t, IsDelegateTool("delegate_task"))
	assert.False(t, IsDelegateTool("read_file"))
}

func TestAcquireToolSlot_SkipsDelegate(t *testing.T) {
	sem := make(chan struct{}, 1)
	sem <- struct{}{} // full
	release, ok := acquireToolSlot(context.Background(), sem, "delegate_task")
	require.True(t, ok)
	release()
	// Regular tool must wait / fail on cancel while slot is held.
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, ok = acquireToolSlot(ctx, sem, "read_file")
	assert.False(t, ok)
}

func TestNormalizeSubagentLimits_MaxConcurrent(t *testing.T) {
	got := NormalizeSubagentLimits(SubagentLimits{})
	assert.Equal(t, DefaultSubagentMaxConcurrent, got.MaxConcurrent)
	got = NormalizeSubagentLimits(SubagentLimits{MaxConcurrent: 5})
	assert.Equal(t, 5, got.MaxConcurrent)
}
