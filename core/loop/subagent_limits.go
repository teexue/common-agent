package loop

// SubagentLimits are process-wide nested-run caps, not Agent YAML fields.
type SubagentLimits struct {
	Enabled  bool
	MaxTurns int
	// MaxDepth is the deepest child run allowed (1 = main agent may spawn; children cannot).
	MaxDepth int
	Timeout  int
	// MaxConcurrent caps how many child runs may execute at once (queue the rest).
	// Independent of Agent tool_execution.max_parallel.
	MaxConcurrent int
}

const (
	// DefaultSubagentMaxConcurrent is used when MaxConcurrent is unset.
	DefaultSubagentMaxConcurrent = 2
)

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
	if l.MaxConcurrent <= 0 {
		l.MaxConcurrent = DefaultSubagentMaxConcurrent
	}
	return l
}

// IsDelegateTool reports tools that spawn nested runs. They must not share the
// regular tool parallel semaphore — subagent concurrency is capped separately.
func IsDelegateTool(name string) bool {
	return name == "delegate_task"
}
