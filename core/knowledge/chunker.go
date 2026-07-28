package knowledge

import (
	"strings"
	"unicode/utf8"
)

const (
	defaultChunkSize    = 800
	defaultChunkOverlap = 100
)

// Chunk splits text into overlapping windows suitable for embedding.
func Chunk(text string) []string {
	return ChunkSized(text, defaultChunkSize, defaultChunkOverlap)
}

// ChunkSized splits text by rune count with overlap.
func ChunkSized(text string, size, overlap int) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	if size <= 0 {
		size = defaultChunkSize
	}
	if overlap < 0 {
		overlap = 0
	}
	if overlap >= size {
		overlap = size / 4
	}

	// Prefer splitting on blank lines / headings for markdown-ish docs.
	paras := splitParagraphs(text)
	var chunks []string
	var buf strings.Builder
	bufRunes := 0

	flush := func() {
		s := strings.TrimSpace(buf.String())
		if s != "" {
			chunks = append(chunks, s)
		}
		buf.Reset()
		bufRunes = 0
	}

	for _, p := range paras {
		pr := utf8.RuneCountInString(p)
		if pr > size {
			flush()
			chunks = append(chunks, splitWindow(p, size, overlap)...)
			continue
		}
		if bufRunes > 0 && bufRunes+1+pr > size {
			flush()
		}
		if buf.Len() > 0 {
			buf.WriteByte('\n')
			bufRunes++
		}
		buf.WriteString(p)
		bufRunes += pr
	}
	flush()
	return chunks
}

func splitParagraphs(text string) []string {
	parts := strings.Split(text, "\n\n")
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{text}
	}
	return out
}

func splitWindow(text string, size, overlap int) []string {
	runes := []rune(text)
	if len(runes) <= size {
		return []string{text}
	}
	step := size - overlap
	if step <= 0 {
		step = size
	}
	var out []string
	for start := 0; start < len(runes); start += step {
		end := start + size
		if end > len(runes) {
			end = len(runes)
		}
		out = append(out, string(runes[start:end]))
		if end == len(runes) {
			break
		}
	}
	return out
}
