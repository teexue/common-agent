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
	{"deepseek-v4-flash", ModelSpec{ContextWindow: 1_048_576, MaxOutput: 393_216}},
	{"deepseek-v4-pro", ModelSpec{ContextWindow: 1_048_576, MaxOutput: 393_216}},
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

// EffectiveContextWindow resolves the model context window: an explicit
// configuration wins, then the model's official spec (0 when unknown).
func EffectiveContextWindow(model string, configured int) int {
	if configured > 0 {
		return configured
	}
	if spec, ok := SpecForModel(model); ok {
		return spec.ContextWindow
	}
	return 0
}
