package builtin_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/teexue/common-agent/tools/builtin"
)

func TestEcho(t *testing.T) {
	var e builtin.Echo
	input, _ := json.Marshal(map[string]string{"message": "hi"})
	res, err := e.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]string
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["message"] != "hi" {
		t.Fatalf("got %q", out["message"])
	}
}

func TestGetTime(t *testing.T) {
	var g builtin.GetTime
	res, err := g.Execute(context.Background(), json.RawMessage("{}"))
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]string
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["time"] == "" {
		t.Fatal("expected time")
	}
}

// ─── ReadFile ─────────────────────────────────────────────────────

func TestReadFile(t *testing.T) {
	dir := t.TempDir()
	err := os.WriteFile(filepath.Join(dir, "test.txt"), []byte("hello world"), 0o644)
	if err != nil {
		t.Fatal(err)
	}

	rf := builtin.ReadFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "test.txt"})
	res, err := rf.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["content"] != "hello world" {
		t.Fatalf("expected 'hello world', got %q", out["content"])
	}
}

func TestReadFileTraversal(t *testing.T) {
	dir := t.TempDir()
	rf := builtin.ReadFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "../../../etc/passwd"})
	_, err := rf.Execute(context.Background(), input)
	if err == nil {
		t.Fatal("expected error for path traversal")
	}
}

func TestReadFileMaxBytes(t *testing.T) {
	dir := t.TempDir()
	err := os.WriteFile(filepath.Join(dir, "big.txt"), []byte("0123456789"), 0o644)
	if err != nil {
		t.Fatal(err)
	}

	rf := builtin.ReadFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{"path": "big.txt", "max_bytes": 5})
	res, err := rf.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["content"] != "01234" {
		t.Fatalf("expected '01234', got %q", out["content"])
	}
}

// ─── WriteFile ────────────────────────────────────────────────────

func TestWriteFile(t *testing.T) {
	dir := t.TempDir()
	wf := builtin.WriteFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "output.txt", "content": "data"})
	res, err := wf.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["bytes"].(float64) != 4 {
		t.Fatalf("expected 4 bytes, got %v", out["bytes"])
	}

	// Verify file was actually written
	data, err := os.ReadFile(filepath.Join(dir, "output.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "data" {
		t.Fatalf("expected 'data', got %q", string(data))
	}
}

func TestWriteFileCreatesDirs(t *testing.T) {
	dir := t.TempDir()
	wf := builtin.WriteFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "sub/dir/file.txt", "content": "nested"})
	_, err := wf.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(filepath.Join(dir, "sub", "dir", "file.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "nested" {
		t.Fatalf("expected 'nested', got %q", string(data))
	}
}

func TestWriteFileTraversal(t *testing.T) {
	dir := t.TempDir()
	wf := builtin.WriteFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "../../../tmp/evil.txt", "content": "bad"})
	_, err := wf.Execute(context.Background(), input)
	if err == nil {
		t.Fatal("expected error for path traversal")
	}
}

// ─── ListDirectory ────────────────────────────────────────────────

func TestListDirectory(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("a"), 0o644)
	os.WriteFile(filepath.Join(dir, "b.go"), []byte("b"), 0o644)
	os.Mkdir(filepath.Join(dir, "sub"), 0o755)

	ld := builtin.ListDirectory{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{"path": "."})
	res, err := ld.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["count"].(float64) != 3 {
		t.Fatalf("expected 3 entries, got %v", out["count"])
	}
}

func TestListDirectoryPattern(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("a"), 0o644)
	os.WriteFile(filepath.Join(dir, "b.go"), []byte("b"), 0o644)

	ld := builtin.ListDirectory{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{"path": ".", "pattern": "*.go"})
	res, err := ld.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["count"].(float64) != 1 {
		t.Fatalf("expected 1 entry, got %v", out["count"])
	}
}

func TestListDirectoryRecursive(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "sub"), 0o755)
	os.WriteFile(filepath.Join(dir, "root.txt"), []byte("r"), 0o644)
	os.WriteFile(filepath.Join(dir, "sub", "child.txt"), []byte("c"), 0o644)

	ld := builtin.ListDirectory{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{"path": "."})
	res, err := ld.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	// Non-recursive: root.txt (file), sub (dir) = 2
	if out["count"].(float64) != 2 {
		t.Fatalf("expected 2 entries, got %v", out["count"])
	}
}

// ─── EditFile ─────────────────────────────────────────────────────

func TestEditFile(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "code.go"), []byte("package main\nfunc main() {}\n"), 0o644)

	ef := builtin.EditFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{
		"path":        "code.go",
		"old_string":  "func main() {}",
		"new_string":  "func main() { fmt.Println(\"hi\") }",
	})
	res, err := ef.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["replacements"].(float64) != 1 {
		t.Fatalf("expected 1 replacement, got %v", out["replacements"])
	}

	data, _ := os.ReadFile(filepath.Join(dir, "code.go"))
	expected := "package main\nfunc main() { fmt.Println(\"hi\") }\n"
	if string(data) != expected {
		t.Fatalf("unexpected content: %q", string(data))
	}
}

func TestEditFileNotFound(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "f.txt"), []byte("hello"), 0o644)

	ef := builtin.EditFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{
		"path":        "f.txt",
		"old_string":  "nonexistent",
		"new_string":  "replacement",
	})
	_, err := ef.Execute(context.Background(), input)
	if err == nil {
		t.Fatal("expected error when old_string not found")
	}
}

func TestEditFileAll(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "f.txt"), []byte("aaa bbb aaa"), 0o644)

	ef := builtin.EditFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{
		"path":        "f.txt",
		"old_string":  "aaa",
		"new_string":  "ccc",
		"all":         true,
	})
	res, err := ef.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	json.Unmarshal(res.Output, &out)
	if out["replacements"].(float64) != 2 {
		t.Fatalf("expected 2 replacements, got %v", out["replacements"])
	}

	data, _ := os.ReadFile(filepath.Join(dir, "f.txt"))
	if string(data) != "ccc bbb ccc" {
		t.Fatalf("unexpected: %q", string(data))
	}
}

// ─── CreateDirectory ──────────────────────────────────────────────

func TestCreateDirectory(t *testing.T) {
	dir := t.TempDir()
	cd := builtin.CreateDirectory{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "new/nested/dir"})
	_, err := cd.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	info, err := os.Stat(filepath.Join(dir, "new", "nested", "dir"))
	if err != nil {
		t.Fatal(err)
	}
	if !info.IsDir() {
		t.Fatal("expected directory")
	}
}

func TestCreateDirectoryTraversal(t *testing.T) {
	dir := t.TempDir()
	cd := builtin.CreateDirectory{WorkDir: dir}
	input, _ := json.Marshal(map[string]string{"path": "../../../tmp/evil"})
	_, err := cd.Execute(context.Background(), input)
	if err == nil {
		t.Fatal("expected error for path traversal")
	}
}

// ─── RunCommand ───────────────────────────────────────────────────

func TestRunCommand(t *testing.T) {
	dir := t.TempDir()
	rc := builtin.RunCommand{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{"command": "echo hello"})
	res, err := rc.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["exit_code"].(float64) != 0 {
		t.Fatalf("expected exit code 0, got %v", out["exit_code"])
	}
	stdout := out["stdout"].(string)
	if stdout != "hello\n" {
		t.Fatalf("expected 'hello\\n', got %q", stdout)
	}
}

func TestRunCommandFailure(t *testing.T) {
	dir := t.TempDir()
	rc := builtin.RunCommand{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{"command": "false"})
	res, err := rc.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	json.Unmarshal(res.Output, &out)
	if out["exit_code"].(float64) != 1 {
		t.Fatalf("expected exit code 1, got %v", out["exit_code"])
	}
}

func TestRunCommandWorkdir(t *testing.T) {
	dir := t.TempDir()
	os.Mkdir(filepath.Join(dir, "sub"), 0o755)

	rc := builtin.RunCommand{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{"command": "pwd", "workdir": "sub"})
	res, err := rc.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	json.Unmarshal(res.Output, &out)
	stdout := out["stdout"].(string)
	if stdout != filepath.Join(dir, "sub")+"\n" {
		t.Fatalf("expected %q, got %q", filepath.Join(dir, "sub")+"\n", stdout)
	}
}

// ─── SearchFiles ──────────────────────────────────────────────────

func TestSearchFiles(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.go"), []byte("package main\nfunc main() {}\n"), 0o644)
	os.WriteFile(filepath.Join(dir, "b.txt"), []byte("no match here\n"), 0o644)

	sf := builtin.SearchFiles{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{"pattern": "func main", "glob": "*.go"})
	res, err := sf.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	json.Unmarshal(res.Output, &out)
	if out["count"].(float64) != 1 {
		t.Fatalf("expected 1 match, got %v", out["count"])
	}
}

func TestSearchFilesMaxResults(t *testing.T) {
	dir := t.TempDir()
	content := ""
	for i := 0; i < 100; i++ {
		content += "line with pattern\n"
	}
	os.WriteFile(filepath.Join(dir, "big.txt"), []byte(content), 0o644)

	sf := builtin.SearchFiles{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{"pattern": "pattern", "max_results": 5})
	res, err := sf.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	json.Unmarshal(res.Output, &out)
	if out["count"].(float64) != 5 {
		t.Fatalf("expected 5 matches, got %v", out["count"])
	}
	if out["truncated"] != true {
		t.Fatal("expected truncated=true")
	}
}

// ─── SafePath ─────────────────────────────────────────────────────

func TestSafePath(t *testing.T) {
	tests := []struct {
		name    string
		root    string
		path    string
		wantErr bool
	}{
		{"relative", "/home/user", "file.txt", false},
		{"absolute inside", "/home/user", "/home/user/file.txt", false},
		{"traversal", "/home/user", "../etc/passwd", true},
		{"deep traversal", "/home/user", "sub/../../etc/passwd", true},
		{"empty path", "/home/user", "", true},
		{"absolute outside", "/home/user", "/etc/passwd", true},
		{"valid special chars", "/home/user", "sub/..%2f..%2fetc", false},
		{"root itself", "/home/user", ".", false},
		{"nested valid", "/home/user", "a/b/c/d.txt", false},
		{"traversal to parent of root", "/home/user", "..", true},
		{"traversal via absolute", "/home/user", "/home/user/../../../etc/passwd", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := builtin.SafePath(tt.root, tt.path)
			if (err != nil) != tt.wantErr {
				t.Errorf("SafePath(%q, %q) error = %v, wantErr %v", tt.root, tt.path, err, tt.wantErr)
			}
		})
	}
}

func TestSearchFilesTraversal(t *testing.T) {
	dir := t.TempDir()
	sf := builtin.SearchFiles{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{"pattern": "test", "path": "../../../etc"})
	_, err := sf.Execute(context.Background(), input)
	if err == nil {
		t.Fatal("expected error for path traversal in search_files")
	}
}

func TestEditFileTraversal(t *testing.T) {
	dir := t.TempDir()
	ef := builtin.EditFile{WorkDir: dir}
	input, _ := json.Marshal(map[string]any{
		"path":       "../../../tmp/evil.go",
		"old_string": "a",
		"new_string": "b",
	})
	_, err := ef.Execute(context.Background(), input)
	if err == nil {
		t.Fatal("expected error for path traversal in edit_file")
	}
}
