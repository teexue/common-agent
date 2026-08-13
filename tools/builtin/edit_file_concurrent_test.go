package builtin_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/teexue/common-agent/tools/builtin"
)

// ─── Concurrency: parallel tool execution must not corrupt shared files ───

// TestEditFileConcurrentSameFile fires several edits at the same file from
// parallel goroutines (mirroring tool_execution.mode = "parallel"). Without
// per-path locking the last writer would clobber the other edits; with the
// lock every replacement must be applied.
func TestEditFileConcurrentSameFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "doc.txt"), []byte("alpha\nbeta\ngamma\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	ef := builtin.EditFile{WorkDir: dir}
	edits := []struct{ old, new string }{
		{"alpha", "ALPHA"},
		{"beta", "BETA"},
		{"gamma", "GAMMA"},
	}

	var wg sync.WaitGroup
	errs := make([]error, len(edits))
	for i, e := range edits {
		wg.Add(1)
		go func(i int, old, new string) {
			defer wg.Done()
			input, _ := json.Marshal(map[string]string{
				"path":       "doc.txt",
				"old_string": old,
				"new_string": new,
			})
			_, errs[i] = ef.Execute(context.Background(), input)
		}(i, e.old, e.new)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("edit %d failed: %v", i, err)
		}
	}

	data, err := os.ReadFile(filepath.Join(dir, "doc.txt"))
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	for _, want := range []string{"ALPHA", "BETA", "GAMMA"} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected all edits applied, missing %q in %q", want, got)
		}
	}
}

// TestWriteFileConcurrentSamePath verifies that concurrent full overwrites of
// the same path never mix content from different writes — the final file must
// equal exactly one of the written payloads.
func TestWriteFileConcurrentSamePath(t *testing.T) {
	dir := t.TempDir()
	wf := builtin.WriteFile{WorkDir: dir}

	const n = 8
	payloads := make([]string, n)
	for i := range payloads {
		payloads[i] = strings.Repeat(string(rune('a'+i)), 4096)
	}

	var wg sync.WaitGroup
	errs := make([]error, n)
	for i, p := range payloads {
		wg.Add(1)
		go func(i int, p string) {
			defer wg.Done()
			input, _ := json.Marshal(map[string]string{"path": "shared.bin", "content": p})
			_, errs[i] = wf.Execute(context.Background(), input)
		}(i, p)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("write %d failed: %v", i, err)
		}
	}

	data, err := os.ReadFile(filepath.Join(dir, "shared.bin"))
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	for _, p := range payloads {
		if got == p {
			return // final content is exactly one full payload: no torn write
		}
	}
	t.Fatalf("final content is a mix of concurrent writes: %d bytes", len(got))
}

// TestEditFileConcurrentWriteEdit interleaves a full overwrite with a targeted
// edit of the same file. Whatever the interleaving, the edit must either apply
// on top of the overwritten content or report the old_string as missing — it
// must never tear the file.
func TestEditFileConcurrentWriteEdit(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "shared.txt")
	if err := os.WriteFile(path, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}

	wf := builtin.WriteFile{WorkDir: dir}
	ef := builtin.EditFile{WorkDir: dir}

	writeInput, _ := json.Marshal(map[string]string{
		"path": "shared.txt", "content": "new content",
	})
	editInput, _ := json.Marshal(map[string]string{
		"path": "shared.txt", "old_string": "new content", "new_string": "new content edited",
	})

	var wg sync.WaitGroup
	wg.Add(2)
	var werr, eerr error
	go func() {
		defer wg.Done()
		_, werr = wf.Execute(context.Background(), writeInput)
	}()
	go func() {
		defer wg.Done()
		_, eerr = ef.Execute(context.Background(), editInput)
	}()
	wg.Wait()

	if werr != nil {
		t.Fatalf("write failed: %v", werr)
	}
	// The edit is allowed to fail when it ran before the overwrite (old_string
	// not present yet) — but it must fail cleanly, not corrupt the file.
	if eerr != nil && !strings.Contains(eerr.Error(), "old_string not found") {
		t.Fatalf("unexpected edit error: %v", eerr)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	if got != "new content edited" && got != "new content" && got != "old" {
		t.Fatalf("torn or unexpected content: %q", got)
	}
}
