package provider

import (
	"strings"
)

// ollamaThinkValue maps a ThinkingConfig to the Ollama `think` field.
// "enabled" -> true, "disabled" -> false, "high"/"medium"/"low"/"max" -> level.
// nil (no thinking config) omits the field so the model default applies.
func ollamaThinkValue(th *ThinkingConfig) any {
	if th == nil || th.Type == "" {
		return nil
	}
	switch th.Type {
	case "enabled":
		return true
	case "disabled":
		return false
	case "high", "medium", "low", "max":
		return th.Type
	default:
		return nil
	}
}

func convertOllamaMessages(msgs []Message) []ollamaMessage {
	out := make([]ollamaMessage, 0, len(msgs))
	for _, m := range msgs {
		msg := ollamaMessage{Role: string(m.Role), Content: m.Content}
		if len(m.ContentParts) > 0 {
			// Ollama native API keeps text in `content` and images in a separate
			// `images` array. Concatenate text parts into content; inline base64
			// image parts go to images. HTTP image URLs are unsupported (skipped).
			var textParts []string
			for _, p := range m.ContentParts {
				if p.Type == "text" && p.Text != "" {
					textParts = append(textParts, p.Text)
				}
			}
			if len(textParts) > 0 {
				msg.Content = strings.Join(textParts, "")
			}
			msg.Images = extractOllamaImages(m.ContentParts)
		}
		if len(m.ToolCalls) > 0 {
			msg.ToolCalls = make([]ollamaToolCall, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				msg.ToolCalls = append(msg.ToolCalls, ollamaToolCall{
					Function: ollamaFunctionCall{Name: tc.Name, Arguments: tc.Arguments},
				})
			}
		}
		out = append(out, msg)
	}
	return out
}

// extractOllamaImages pulls raw base64 payloads from image content parts.
// Ollama native API takes an `images` array of base64 strings (no data: prefix).
// HTTP image URLs are not supported by the native API and are skipped.
func extractOllamaImages(parts []ContentPart) []string {
	if len(parts) == 0 {
		return nil
	}
	var images []string
	for _, p := range parts {
		if p.Type != "image_url" || p.ImageURL == nil {
			continue
		}
		if b64, ok := dataURLToBase64(p.ImageURL.URL); ok {
			images = append(images, b64)
		}
	}
	return images
}

// dataURLToBase64 returns the base64 payload of a data: URL, true.
// Non-data URLs return ("", false).
func dataURLToBase64(s string) (string, bool) {
	const prefix = "data:"
	if !strings.HasPrefix(s, prefix) {
		return "", false
	}
	// data:image/png;base64,XXXX
	rest := strings.TrimPrefix(s, prefix)
	semi := strings.IndexByte(rest, ';')
	if semi < 0 {
		return "", false
	}
	rest = rest[semi+1:]
	comma := strings.IndexByte(rest, ',')
	if comma < 0 {
		return "", false
	}
	return rest[comma+1:], true
}

func convertOllamaTools(tools []ToolDefinition) []ollamaTool {
	if len(tools) == 0 {
		return nil
	}
	out := make([]ollamaTool, 0, len(tools))
	for _, t := range tools {
		out = append(out, ollamaTool{
			Type:     "function",
			Function: ollamaFunction(t),
		})
	}
	return out
}
