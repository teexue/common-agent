package builtin_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/tools/builtin"
)

// 1x1 PNG
var tinyPNG = mustDecode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")

func mustDecode(s string) []byte {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		panic(err)
	}
	return b
}

func TestReadImage_ReturnsImagePart(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "dot.png")
	require.NoError(t, os.WriteFile(path, tinyPNG, 0o644))

	res, err := (builtin.ReadImage{WorkDir: dir}).Execute(context.Background(), json.RawMessage(`{"path":"dot.png"}`))
	require.NoError(t, err)
	require.Len(t, res.ContentParts, 1)
	assert.Equal(t, "image_url", res.ContentParts[0].Type)
	require.NotNil(t, res.ContentParts[0].ImageURL)
	assert.Contains(t, res.ContentParts[0].ImageURL.URL, "data:image/png;base64,")

	var meta map[string]any
	require.NoError(t, json.Unmarshal(res.Output, &meta))
	assert.Equal(t, "image/png", meta["media_type"])
}

func TestReadImage_RejectsNonImage(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hi"), 0o644))
	_, err := (builtin.ReadImage{WorkDir: dir}).Execute(context.Background(), json.RawMessage(`{"path":"a.txt"}`))
	require.Error(t, err)
}
