package provider

import "strings"

// IsOutputTruncated reports whether a completion stopped because it hit the
// output token cap. Prefer an explicit provider finish reason; fall back to
// comparing reported output tokens against the effective max.
func IsOutputTruncated(finishReason string, outputTokens, maxOutput int) bool {
	switch strings.ToLower(strings.TrimSpace(finishReason)) {
	case "length", "max_tokens":
		return true
	}
	return maxOutput > 0 && outputTokens >= maxOutput
}
