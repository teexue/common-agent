package provider

import "testing"

func TestSpecForModel(t *testing.T) {
	cases := []struct {
		model   string
		wantOK  bool
		wantCtx int
		wantOut int
	}{
		{"deepseek-v4-flash", true, 1_000_000, 384_000},
		{"deepseek-v4-pro", true, 1_000_000, 384_000},
		{"deepseek-v4-flash-0731", true, 1_000_000, 384_000}, // dated variant
		{"gpt-5.2", false, 0, 0},
		{"", false, 0, 0},
	}
	for _, c := range cases {
		spec, ok := SpecForModel(c.model)
		if ok != c.wantOK {
			t.Errorf("%s: ok = %v, want %v", c.model, ok, c.wantOK)
			continue
		}
		if ok && (spec.ContextWindow != c.wantCtx || spec.MaxOutput != c.wantOut) {
			t.Errorf("%s: spec = %+v", c.model, spec)
		}
	}
}

func TestEffectiveMaxOutput(t *testing.T) {
	if got := EffectiveMaxOutput("deepseek-v4-flash", 8000); got != 8000 {
		t.Errorf("explicit value should win, got %d", got)
	}
	if got := EffectiveMaxOutput("deepseek-v4-flash", 0); got != 384_000 {
		t.Errorf("spec should apply, got %d", got)
	}
	if got := EffectiveMaxOutput("unknown-model", 0); got != DefaultMaxTokens {
		t.Errorf("fallback = %d, want %d", got, DefaultMaxTokens)
	}
}

func TestEffectiveContextWindow(t *testing.T) {
	if got := EffectiveContextWindow("deepseek-v4-pro", 256000); got != 256000 {
		t.Errorf("explicit value should win, got %d", got)
	}
	if got := EffectiveContextWindow("deepseek-v4-pro", 0); got != 1_000_000 {
		t.Errorf("spec should apply, got %d", got)
	}
	if got := EffectiveContextWindow("unknown-model", 0); got != DefaultContextWindow {
		t.Errorf("unknown model should fall back to DefaultContextWindow, got %d", got)
	}
}
