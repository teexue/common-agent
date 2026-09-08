package tui

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDetectTrigger(t *testing.T) {
	kind, q := detectTrigger("/mod")
	assert.Equal(t, overlaySlash, kind)
	assert.Equal(t, "mod", q)

	kind, q = detectTrigger("@glm")
	assert.Equal(t, overlayNone, kind)
	assert.Empty(t, q)

	kind, q = detectTrigger("hello")
	assert.Equal(t, overlayNone, kind)
	assert.Empty(t, q)
}

func TestAtTrigger(t *testing.T) {
	ok, q, prefix := atTrigger("@cmd")
	assert.True(t, ok)
	assert.Equal(t, "cmd", q)
	assert.Empty(t, prefix)

	ok, q, prefix = atTrigger("see @core/tui")
	assert.True(t, ok)
	assert.Equal(t, "core/tui", q)
	assert.Equal(t, "see ", prefix)

	ok, _, _ = atTrigger("email@x.com")
	assert.False(t, ok)

	ok, _, _ = atTrigger("@done path")
	assert.False(t, ok)
}

func TestFilterSlashAndModels(t *testing.T) {
	items := filterSlash("mo")
	assert.Len(t, items, 1)
	assert.Equal(t, "model", items[0].Name)

	opts := []ModelOption{
		{Provider: "ollama", Label: "Ollama", Model: "glm-flash"},
		{Provider: "openai", Label: "OpenAI", Model: "gpt-4o"},
	}
	got := filterModels(opts, "glm")
	assert.Len(t, got, 1)
	assert.Equal(t, "glm-flash", got[0].Model)
}

func TestIndexAndExpandFiles(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "a.go"), []byte("package a"), 0o644))
	require.NoError(t, os.Mkdir(filepath.Join(dir, "sub"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "sub", "b.md"), []byte("# hi"), 0o644))
	require.NoError(t, os.Mkdir(filepath.Join(dir, ".git"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(dir, ".git", "x"), []byte("no"), 0o644))

	files := indexWorkdir(dir)
	assert.Contains(t, files, "a.go")
	assert.Contains(t, files, "sub/b.md")
	assert.NotContains(t, files, ".git/x")

	filtered := filterFiles(files, "b.md")
	assert.Equal(t, []string{"sub/b.md"}, filtered)

	out := expandFileMentions(dir, "look @a.go please")
	assert.Contains(t, out, "look @a.go please")
	assert.Contains(t, out, "--- file: a.go ---")
	assert.Contains(t, out, "package a")
}
