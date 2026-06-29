package hook

import (
	"context"
	"log/slog"
)

// LoggingHook logs tool execution and turn events using slog.
type LoggingHook struct {
	BaseHook
	Logger *slog.Logger
}

// NewLoggingHook creates a LoggingHook with the given logger.
// If logger is nil, slog.Default() is used.
func NewLoggingHook(logger *slog.Logger) *LoggingHook {
	if logger == nil {
		logger = slog.Default()
	}
	return &LoggingHook{Logger: logger}
}

// OnToolStart logs the tool name and argument length before execution.
func (h *LoggingHook) OnToolStart(_ context.Context, info ToolStartInfo) error {
	h.Logger.Info("tool start",
		"tool", info.Name,
		"args_len", len(info.Arguments),
	)
	return nil
}

// OnToolResult logs the tool result or error after execution.
func (h *LoggingHook) OnToolResult(_ context.Context, info ToolResultInfo) error {
	if info.Error != nil {
		h.Logger.Warn("tool result (error)",
			"tool", info.Name,
			"error", info.Error,
		)
	} else {
		h.Logger.Info("tool result",
			"tool", info.Name,
			"output_len", len(info.Output),
		)
	}
	return nil
}

// OnTurnStart logs the turn number at the beginning of each turn.
func (h *LoggingHook) OnTurnStart(_ context.Context, info TurnInfo) error {
	h.Logger.Debug("turn start", "turn", info.TurnNumber)
	return nil
}

// OnTurnEnd logs the turn number at the end of each turn.
func (h *LoggingHook) OnTurnEnd(_ context.Context, info TurnInfo) error {
	h.Logger.Debug("turn end", "turn", info.TurnNumber)
	return nil
}
