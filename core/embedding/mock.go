package embedding

import (
	"context"
	"fmt"
	"sync"
)

// MockEmbedder returns deterministic low-dimensional vectors for tests.
type MockEmbedder struct {
	Dim int

	mu    sync.Mutex
	Calls [][]string
}

// Embed implements Embedder.
func (m *MockEmbedder) Embed(_ context.Context, texts []string) ([][]float32, error) {
	m.mu.Lock()
	m.Calls = append(m.Calls, append([]string(nil), texts...))
	m.mu.Unlock()

	dim := m.Dim
	if dim <= 0 {
		dim = 8
	}
	out := make([][]float32, len(texts))
	for i, t := range texts {
		v := make([]float32, dim)
		if len(t) == 0 {
			out[i] = v
			continue
		}
		// Simple bag-of-bytes hash into the vector for stable cosine tests.
		for j := 0; j < len(t); j++ {
			v[j%dim] += float32(t[j]) / 255
		}
		out[i] = v
	}
	return out, nil
}

// Dimensions implements Embedder.
func (m *MockEmbedder) Dimensions() int {
	if m.Dim > 0 {
		return m.Dim
	}
	return 8
}

// ErrEmbedder always fails.
type ErrEmbedder struct {
	Err error
}

// Embed implements Embedder.
func (e ErrEmbedder) Embed(context.Context, []string) ([][]float32, error) {
	if e.Err != nil {
		return nil, e.Err
	}
	return nil, fmt.Errorf("embed error")
}

// Dimensions implements Embedder.
func (ErrEmbedder) Dimensions() int { return 0 }
