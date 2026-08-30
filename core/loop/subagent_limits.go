package loop

// SubagentLimits are process-wide nested-run caps, not Agent YAML fields.
type SubagentLimits struct {
	Enabled  bool
	MaxTurns int
	// MaxDepth is the deepest child run allowed (1 = main agent may spawn; children cannot).
	MaxDepth int
	Timeout  int
}

// NormalizeSubagentLimits fills zero values with defaults.
func NormalizeSubagentLimits(l SubagentLimits) SubagentLimits {
	if l.MaxTurns <= 0 {
		l.MaxTurns = 5
	}
	if l.MaxDepth <= 0 {
		l.MaxDepth = 1
	}
	if l.Timeout < 0 {
		l.Timeout = 0
	}
	return l
}
