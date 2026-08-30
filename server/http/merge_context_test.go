package httpapi

import (
	"context"
	"testing"
	"time"
)

func TestMergeContext_CancelStopsWait(t *testing.T) {
	a, aCancel := context.WithCancel(context.Background())
	defer aCancel()
	b, bCancel := context.WithCancel(context.Background())
	defer bCancel()

	ctx, cancel := mergeContext(a, b)
	cancel()
	select {
	case <-ctx.Done():
	case <-time.After(time.Second):
		t.Fatal("merged context not cancelled")
	}
}
