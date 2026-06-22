package agent

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestWatcher_DetectsCreate(t *testing.T) {
	dir := t.TempDir()
	var mu sync.Mutex
	var changes []AgentChange

	w := NewWatcher(dir, nil, func(c AgentChange) {
		mu.Lock()
		changes = append(changes, c)
		mu.Unlock()
	})

	if err := w.Start(); err != nil {
		t.Fatal(err)
	}
	defer w.Stop()

	// Create a new agent file.
	yaml := []byte(`name: test
version: 1
provider: openai
model: gpt-4o
system_prompt: test
tools: [echo]
`)
	if err := os.WriteFile(filepath.Join(dir, "test.yaml"), yaml, 0o644); err != nil {
		t.Fatal(err)
	}

	// Wait for the watcher to detect the change.
	time.Sleep(200 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	if len(changes) == 0 {
		t.Fatal("expected at least one change event")
	}

	found := false
	for _, c := range changes {
		if c.Name == "test" && (c.Type == ChangeCreated || c.Type == ChangeUpdated) {
			found = true
		}
	}
	if !found {
		t.Errorf("expected create/update event for 'test', got %v", changes)
	}
}

func TestWatcher_DetectsDelete(t *testing.T) {
	dir := t.TempDir()

	// Create a file first.
	yaml := []byte(`name: test
version: 1
provider: openai
model: gpt-4o
system_prompt: test
tools: [echo]
`)
	path := filepath.Join(dir, "test.yaml")
	if err := os.WriteFile(path, yaml, 0o644); err != nil {
		t.Fatal(err)
	}

	var mu sync.Mutex
	var changes []AgentChange

	w := NewWatcher(dir, nil, func(c AgentChange) {
		mu.Lock()
		changes = append(changes, c)
		mu.Unlock()
	})

	if err := w.Start(); err != nil {
		t.Fatal(err)
	}
	defer w.Stop()

	// Delete the file.
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}

	time.Sleep(200 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	found := false
	for _, c := range changes {
		if c.Name == "test" && c.Type == ChangeDeleted {
			found = true
		}
	}
	if !found {
		t.Errorf("expected delete event for 'test', got %v", changes)
	}
}

func TestWatcher_IgnoresNonYAML(t *testing.T) {
	dir := t.TempDir()
	var mu sync.Mutex
	var changes []AgentChange

	w := NewWatcher(dir, nil, func(c AgentChange) {
		mu.Lock()
		changes = append(changes, c)
		mu.Unlock()
	})

	if err := w.Start(); err != nil {
		t.Fatal(err)
	}
	defer w.Stop()

	// Create a non-YAML file.
	if err := os.WriteFile(filepath.Join(dir, "readme.txt"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}

	time.Sleep(200 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	if len(changes) != 0 {
		t.Errorf("expected no changes for non-YAML file, got %v", changes)
	}
}

func TestWatcher_DoubleStop(t *testing.T) {
	dir := t.TempDir()
	w := NewWatcher(dir, nil, nil)
	if err := w.Start(); err != nil {
		t.Fatal(err)
	}
	w.Stop()
	w.Stop() // should not panic
}

func TestLoadFromBytes(t *testing.T) {
	yaml := []byte(`name: test
version: 1
provider: openai
model: gpt-4o
system_prompt: test
tools: [echo]
`)
	a, err := LoadFromBytes(yaml)
	if err != nil {
		t.Fatal(err)
	}
	if a.Name != "test" {
		t.Errorf("expected name 'test', got %q", a.Name)
	}
	if a.Provider != "openai" {
		t.Errorf("expected provider 'openai', got %q", a.Provider)
	}
}

func TestLoadFromBytes_Invalid(t *testing.T) {
	yaml := []byte(`invalid: [yaml`)
	_, err := LoadFromBytes(yaml)
	if err == nil {
		t.Fatal("expected error for invalid YAML")
	}
}

func TestLoadFromBytes_InvalidAgent(t *testing.T) {
	yaml := []byte(`name: ""
version: 1
`)
	_, err := LoadFromBytes(yaml)
	if err == nil {
		t.Fatal("expected error for invalid agent")
	}
}
