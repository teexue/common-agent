package builtin

import (
	"bufio"
	"encoding/json"
	"io"
	"strconv"
)

type readFileArgs struct {
	Path     string
	Encoding string
	Offset   int64 // 1-based start line; 0 means line 1
	MaxBytes int
}

func parseReadFileArgs(input json.RawMessage) (readFileArgs, error) {
	var raw struct {
		Path     string          `json:"path"`
		Encoding string          `json:"encoding"`
		Offset   json.RawMessage `json:"offset"`
		MaxBytes json.RawMessage `json:"max_bytes"`
	}
	if err := json.Unmarshal(input, &raw); err != nil {
		return readFileArgs{}, err
	}
	maxBytes := int(jsonInt(raw.MaxBytes, 0))
	if maxBytes <= 0 {
		maxBytes = defaultMaxReadBytes
	}
	offset := jsonInt(raw.Offset, 0)
	if offset < 0 {
		offset = 0
	}
	return readFileArgs{
		Path: raw.Path, Encoding: raw.Encoding,
		Offset: offset, MaxBytes: maxBytes,
	}, nil
}

func jsonInt(raw json.RawMessage, def int64) int64 {
	if len(raw) == 0 || string(raw) == "null" {
		return def
	}
	var n int64
	if json.Unmarshal(raw, &n) == nil {
		return n
	}
	var f float64
	if json.Unmarshal(raw, &f) == nil {
		return int64(f)
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		if v, err := strconv.ParseInt(s, 10, 64); err == nil {
			return v
		}
	}
	return def
}

// readFileRange reads from 1-based startLine until maxBytes. nextLine is the
// 1-based line to pass as offset to continue. truncated is true when more
// content remains after this chunk.
func readFileRange(r io.Reader, startLine int64, maxBytes int) ([]byte, int64, bool, error) {
	if startLine < 1 {
		startLine = 1
	}
	br := bufio.NewReaderSize(r, 32*1024)
	var lineNo int64
	var out []byte
	for {
		line, err := br.ReadBytes('\n')
		if len(line) == 0 && err != nil {
			if err == io.EOF {
				return out, startLine, false, nil
			}
			return nil, startLine, false, err
		}
		lineNo++
		if lineNo < startLine {
			if err == io.EOF {
				return out, startLine, false, nil
			}
			continue
		}
		chunk, next, truncated, done := appendLine(out, line, lineNo, maxBytes, err)
		if done {
			return chunk, next, truncated, nil
		}
		out = chunk
	}
}

func appendLine(out, line []byte, lineNo int64, maxBytes int, readErr error) ([]byte, int64, bool, bool) {
	if len(out)+len(line) > maxBytes {
		if len(out) == 0 {
			if maxBytes < len(line) {
				line = line[:maxBytes]
			}
			return append([]byte(nil), line...), lineNo + 1, true, true
		}
		return out, lineNo, true, true
	}
	out = append(out, line...)
	if readErr == io.EOF {
		return out, lineNo + 1, false, true
	}
	return out, 0, false, false
}
