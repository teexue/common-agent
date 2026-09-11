package tui

// EntryKind classifies a conversation row in the fullscreen chat.
type EntryKind string

const (
	// EntryUser is a user prompt.
	EntryUser EntryKind = "user"
	// EntryAssistant is an assistant reply block.
	EntryAssistant EntryKind = "assistant"
	// EntrySystem is a system/compaction/error notice.
	EntrySystem EntryKind = "system"
)

// ToolStatus is the lifecycle of a tool call card.
type ToolStatus string

const (
	// ToolRunning means the tool is executing.
	ToolRunning ToolStatus = "running"
	// ToolQueued means a sub-agent is waiting for a concurrency slot.
	ToolQueued ToolStatus = "queued"
	// ToolPending means the tool awaits human approval.
	ToolPending ToolStatus = "pending_approval"
	// ToolDone means the tool finished successfully.
	ToolDone ToolStatus = "completed"
	// ToolFailed means the tool failed.
	ToolFailed ToolStatus = "error"
	// ToolDenied means the user denied the tool.
	ToolDenied ToolStatus = "denied"
)

// ToolCard is a single tool invocation shown under an assistant entry.
type ToolCard struct {
	ID     string
	Name   string
	Input  string
	Output string
	Status ToolStatus
}

// Entry is one conversation block in the message viewport.
type Entry struct {
	Kind      EntryKind
	Content   string
	Reasoning string
	Tools     []ToolCard
	Streaming bool
}

// StreamStatus is the top-bar run state.
type StreamStatus string

const (
	// StatusIdle means no run is in progress.
	StatusIdle StreamStatus = "idle"
	// StatusStreaming means the agent is producing events.
	StatusStreaming StreamStatus = "streaming"
	// StatusError means the last run failed.
	StatusError StreamStatus = "error"
)
