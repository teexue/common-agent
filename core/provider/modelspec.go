package provider

import "strings"

// ModelSpec describes a model's official capacity limits.
type ModelSpec struct {
	ContextWindow int // total context window in tokens
	MaxOutput     int // max output tokens per completion
}

// modelSpecs holds official specs per vendor documentation. Extend as
// providers publish new models.
var modelSpecs = []struct {
	prefix string
	spec   ModelSpec
}{
	// DeepSeek V4 (api-docs.deepseek.com/quick_start/pricing): 1M context,
	// 384K max output for both flash and pro.
	{"deepseek-v4-flash", ModelSpec{ContextWindow: 1_000_000, MaxOutput: 384_000}},
	{"deepseek-v4-pro", ModelSpec{ContextWindow: 1_000_000, MaxOutput: 384_000}},
}

// SpecForModel returns the official spec for a model, matched by exact name
// or prefix (e.g. dated variants like deepseek-v4-flash-0731).
func SpecForModel(model string) (ModelSpec, bool) {
	for _, entry := range modelSpecs {
		if model == entry.prefix || strings.HasPrefix(model, entry.prefix+"-") {
			return entry.spec, true
		}
	}
	return ModelSpec{}, false
}

// EffectiveMaxOutput resolves the per-request output cap: an explicit agent
// value wins, then the model's official spec, then DefaultMaxTokens.
func EffectiveMaxOutput(model string, configured int) int {
	if configured > 0 {
		return configured
	}
	if spec, ok := SpecForModel(model); ok {
		return spec.MaxOutput
	}
	return DefaultMaxTokens
}

// DefaultContextWindow is the conservative context size assumed for models
// without a known spec. It keeps compaction active for any model so long
// histories get trimmed instead of growing unboundedly.
const DefaultContextWindow = 128_000 // 128K tokens

// EffectiveContextWindow resolves the model context window: an explicit
// configuration wins, then the model's official spec, then a conservative
// default so compaction never silently disables itself for unknown models.
func EffectiveContextWindow(model string, configured int) int {
	if configured > 0 {
		return configured
	}
	if spec, ok := SpecForModel(model); ok {
		return spec.ContextWindow
	}
	return DefaultContextWindow
}
