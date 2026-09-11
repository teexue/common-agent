package provider

// DropImagesBefore returns a copy of msgs where image_url payloads on
// messages before fromIndex are replaced with a short text stub.
// Images on and after fromIndex (current user turn and later tool reads)
// are kept. fromIndex < 0 is treated as 0; fromIndex >= len keeps all.
func DropImagesBefore(msgs []Message, fromIndex int) []Message {
	if fromIndex < 0 {
		fromIndex = 0
	}
	if fromIndex >= len(msgs) || !hasImageBefore(msgs, fromIndex) {
		return msgs
	}
	out := make([]Message, len(msgs))
	for i, m := range msgs {
		if i >= fromIndex || len(m.ContentParts) == 0 {
			out[i] = m
			continue
		}
		parts, changed := stubImageParts(m.ContentParts)
		if !changed {
			out[i] = m
			continue
		}
		cp := m
		cp.ContentParts = parts
		out[i] = cp
	}
	return out
}

func hasImageBefore(msgs []Message, fromIndex int) bool {
	for i := 0; i < fromIndex && i < len(msgs); i++ {
		for _, p := range msgs[i].ContentParts {
			if isDataImagePart(p) {
				return true
			}
		}
	}
	return false
}

func isDataImagePart(p ContentPart) bool {
	return p.Type == "image_url" && p.ImageURL != nil && p.ImageURL.URL != ""
}

func stubImageParts(parts []ContentPart) ([]ContentPart, bool) {
	changed := false
	out := make([]ContentPart, len(parts))
	for i, p := range parts {
		if isDataImagePart(p) {
			out[i] = ContentPart{
				Type: "text",
				Text: "[image from earlier turn omitted]",
			}
			changed = true
			continue
		}
		out[i] = p
	}
	return out, changed
}
