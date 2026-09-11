package builtin

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/tool"
)

const maxImageBytes = 10 * 1024 * 1024 // 10MB, matches frontend MAX_IMAGE_BYTES

// ReadImage loads an image file for multimodal turns.
type ReadImage struct {
	WorkDir string
}

// Name returns the tool name.
func (ReadImage) Name() string { return "read_image" }

// Description returns a human-readable description.
func (ReadImage) Description() string {
	return "Read an image file (PNG/JPEG/GIF/WebP). Use this instead of read_file when you need to look at an image."
}

// InputSchema returns the JSON Schema for the tool's input.
func (ReadImage) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "Path to the image (relative to work directory or absolute)",
			},
			"detail": map[string]any{
				"type":        "string",
				"description": "Vision detail hint: low, high, or auto (default auto)",
				"enum":        []string{"low", "high", "auto"},
			},
		},
		"required": []string{"path"},
	}
}

// Execute reads the image and returns both JSON metadata and an image_url part.
func (r ReadImage) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Path   string `json:"path"`
		Detail string `json:"detail"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse read_image input: %w", err)
	}
	if strings.TrimSpace(args.Path) == "" {
		return tool.Result{}, fmt.Errorf("path is required")
	}
	workDir := resolveWorkDir(ctx, r.WorkDir)
	safePath, err := SafePath(workDir, args.Path)
	if err != nil {
		return tool.Result{}, err
	}
	data, err := os.ReadFile(safePath)
	if err != nil {
		return tool.Result{}, fmt.Errorf("read image: %w", err)
	}
	if len(data) == 0 {
		return tool.Result{}, fmt.Errorf("image file is empty")
	}
	if len(data) > maxImageBytes {
		return tool.Result{}, fmt.Errorf("image too large: %d bytes (max %d)", len(data), maxImageBytes)
	}
	mediaType := detectImageMediaType(safePath, data)
	if mediaType == "" {
		return tool.Result{}, fmt.Errorf("unsupported or unrecognized image type")
	}
	prepared, mediaType, err := prepareVisionImage(data, mediaType)
	if err != nil {
		return tool.Result{}, err
	}
	detail := args.Detail
	if detail == "" {
		detail = "auto"
	}
	dataURL := "data:" + mediaType + ";base64," + base64.StdEncoding.EncodeToString(prepared)
	out, _ := json.Marshal(map[string]any{
		"path":       args.Path,
		"media_type": mediaType,
		"bytes":      len(prepared),
		"detail":     detail,
	})
	return tool.Result{
		Output: out,
		ContentParts: []provider.ContentPart{{
			Type:     "image_url",
			ImageURL: &provider.ImageURL{URL: dataURL, Detail: detail},
		}},
	}, nil
}

func detectImageMediaType(path string, data []byte) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	}
	ct := http.DetectContentType(data)
	switch ct {
	case "image/png", "image/jpeg", "image/gif", "image/webp":
		return ct
	default:
		return ""
	}
}
