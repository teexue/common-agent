package subagent

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/event"
)

func TestAcquireSlot_QueuesBeyondMax(t *testing.T) {
	ResetSlotsForTest()
	t.Cleanup(ResetSlotsForTest)

	const max = 2
	var running atomic.Int32
	var peak atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			release, err := acquireSlot(context.Background(), max)
			require.NoError(t, err)
			defer release()
			n := running.Add(1)
			for {
				cur := peak.Load()
				if n <= cur || peak.CompareAndSwap(cur, n) {
					break
				}
			}
			time.Sleep(30 * time.Millisecond)
			running.Add(-1)
		}()
	}
	wg.Wait()
	assert.LessOrEqual(t, peak.Load(), int32(max))
}

func TestTryAcquireSlot_FailsWhenFull(t *testing.T) {
	ResetSlotsForTest()
	t.Cleanup(ResetSlotsForTest)

	release1, ok := tryAcquireSlot(1)
	require.True(t, ok)

	_, ok = tryAcquireSlot(1)
	assert.False(t, ok)

	release1()
	release2, ok := tryAcquireSlot(1)
	require.True(t, ok)
	release2()
}

func TestReserveSlot_EmitsQueuedWhenBusy(t *testing.T) {
	ResetSlotsForTest()
	t.Cleanup(ResetSlotsForTest)

	held, ok := tryAcquireSlot(1)
	require.True(t, ok)

	out := make(chan event.Event, 4)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		release, err := reserveSlot(ctx, Config{Task: "wait-me"}, out, 1)
		if release != nil {
			release()
		}
		errCh <- err
	}()

	select {
	case ev := <-out:
		assert.Equal(t, event.TypeSubAgentStart, ev.Type)
		assert.Equal(t, StatusQueued, ev.Status)
		assert.Equal(t, "1", ev.Message)
		assert.Equal(t, "wait-me", ev.Content)
	case <-time.After(time.Second):
		t.Fatal("expected queued sub_agent_start")
	}

	held()
	select {
	case err := <-errCh:
		require.NoError(t, err)
	case <-time.After(time.Second):
		t.Fatal("expected reserveSlot to finish after release")
	}
}
