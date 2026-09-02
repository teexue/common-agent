package builtin_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/teexue/common-agent/tools/builtin"
)

func TestDeleteFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "gone.txt")
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	df := builtin.DeleteFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "gone.txt"})
	res, err := df.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["deleted"] != true {
		t.Fatalf("expected deleted true, got %v", out["deleted"])
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("expected file to be gone")
	}
}

func TestDeleteFileMissing(t *testing.T) {
	dir := t.TempDir()
	df := builtin.DeleteFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "nope.txt"})
	if _, err := df.Execute(context.Background(), input); err == nil {
		t.Fatal("expected error for missing file")
	}
}

func TestDeleteFileDirectoryRequiresRecursive(t *testing.T) {
	dir := t.TempDir()
	nested := filepath.Join(dir, "sub")
	if err := os.Mkdir(nested, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(nested, "a.txt"), []byte("a"), 0o644); err != nil {
		t.Fatal(err)
	}

	df := builtin.DeleteFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "sub"})
	if _, err := df.Execute(context.Background(), input); err == nil {
		t.Fatal("expected error when deleting a directory without recursive")
	}

	input, _ = json.Marshal(map[string]any{"path": "sub", "recursive": true})
	if _, err := df.Execute(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(nested); !os.IsNotExist(err) {
		t.Fatal("expected directory to be gone")
	}
}

func TestDeleteFileTraversal(t *testing.T) {
	dir := t.TempDir()
	df := builtin.DeleteFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "../../../tmp/evil.txt"})
	if _, err := df.Execute(context.Background(), input); err == nil {
		t.Fatal("expected error for path traversal")
	}
}

func TestDeleteFileRejectsWorkDirRoot(t *testing.T) {
	dir := t.TempDir()
	df := builtin.DeleteFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "."})
	if _, err := df.Execute(context.Background(), input); err == nil {
		t.Fatal("expected error when deleting work directory root")
	}
}
