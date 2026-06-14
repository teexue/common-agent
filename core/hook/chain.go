package hook

import "context"

// Chain executes multiple hooks in order.
// If any hook returns an error, the chain stops and returns that error.
type Chain struct {
	hooks []Hook
}

// NewChain creates a HookChain from the given hooks.
func NewChain(hooks ...Hook) *Chain {
	return &Chain{hooks: hooks}
}

// OnToolStart calls each hook's OnToolStart in order.
func (c *Chain) OnToolStart(ctx context.Context, info ToolStartInfo) error {
	for _, h := range c.hooks {
		if err := h.OnToolStart(ctx, info); err != nil {
			return err
		}
	}
	return nil
}

// OnToolResult calls each hook's OnToolResult in order.
func (c *Chain) OnToolResult(ctx context.Context, info ToolResultInfo) error {
	for _, h := range c.hooks {
		if err := h.OnToolResult(ctx, info); err != nil {
			return err
		}
	}
	return nil
}

// OnTurnStart calls each hook's OnTurnStart in order.
func (c *Chain) OnTurnStart(ctx context.Context, info TurnInfo) error {
	for _, h := range c.hooks {
		if err := h.OnTurnStart(ctx, info); err != nil {
			return err
		}
	}
	return nil
}

// OnTurnEnd calls each hook's OnTurnEnd in order.
func (c *Chain) OnTurnEnd(ctx context.Context, info TurnInfo) error {
	for _, h := range c.hooks {
		if err := h.OnTurnEnd(ctx, info); err != nil {
			return err
		}
	}
	return nil
}
