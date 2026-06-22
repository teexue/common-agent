package workflow

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/teexue/common-agent/core/event"
)

// Runner executes a workflow DAG.
type Runner struct {
	workflow *Workflow
	logger   *slog.Logger
}

// NewRunner creates a Runner for the given workflow.
func NewRunner(w *Workflow, logger *slog.Logger) *Runner {
	if logger == nil {
		logger = slog.Default()
	}
	return &Runner{workflow: w, logger: logger}
}

// RunResult is the outcome of a workflow execution.
type RunResult struct {
	// NodeOutputs maps node ID to its output text.
	NodeOutputs map[string]string
	// Events are all events emitted during execution.
	Events []event.Event
	// Status is the final status.
	Status string
}

// NodeExecutor executes a single node and returns its output.
type NodeExecutor func(ctx context.Context, node Node, input string) (string, error)

// Run executes the workflow DAG. It groups nodes into layers by topological
// order and executes each layer in parallel.
func (r *Runner) Run(ctx context.Context, executor NodeExecutor) (*RunResult, error) {
	layers, err := r.workflow.ExecutionLayers()
	if err != nil {
		return nil, fmt.Errorf("compute execution layers: %w", err)
	}

	result := &RunResult{
		NodeOutputs: make(map[string]string),
	}

	for _, layer := range layers {
		if err := r.executeLayer(ctx, layer, executor, result); err != nil {
			result.Status = "failed"
			return result, err
		}
	}

	result.Status = "completed"
	return result, nil
}

func (r *Runner) executeLayer(ctx context.Context, nodeIDs []string, executor NodeExecutor, result *RunResult) error {
	if len(nodeIDs) == 1 {
		return r.executeNode(ctx, nodeIDs[0], executor, result)
	}

	// Parallel execution.
	var wg sync.WaitGroup
	errs := make([]error, len(nodeIDs))
	for i, id := range nodeIDs {
		wg.Add(1)
		go func(idx int, nodeID string) {
			defer wg.Done()
			errs[idx] = r.executeNode(ctx, nodeID, executor, result)
		}(i, id)
	}
	wg.Wait()

	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Runner) executeNode(ctx context.Context, nodeID string, executor NodeExecutor, result *RunResult) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}

	node, ok := r.workflow.GetNode(nodeID)
	if !ok {
		return fmt.Errorf("node %q not found", nodeID)
	}

	// Build input from predecessors.
	input := r.buildInput(nodeID, result)

	r.logger.Info("executing workflow node", "id", nodeID, "type", node.Type)

	output, err := executor(ctx, node, input)
	if err != nil {
		r.logger.Error("workflow node failed", "id", nodeID, "error", err)
		return fmt.Errorf("node %q: %w", nodeID, err)
	}

	result.NodeOutputs[nodeID] = output
	return nil
}

// buildInput collects outputs from predecessor nodes.
func (r *Runner) buildInput(nodeID string, result *RunResult) string {
	// Find all edges pointing to this node.
	var inputs []string
	for _, e := range r.workflow.Edges {
		if e.To == nodeID {
			if out, ok := result.NodeOutputs[e.From]; ok && out != "" {
				inputs = append(inputs, fmt.Sprintf("[%s]: %s", e.From, out))
			}
		}
	}
	if len(inputs) == 0 {
		return ""
	}
	return joinStrings(inputs, "\n")
}

func joinStrings(ss []string, sep string) string {
	if len(ss) == 0 {
		return ""
	}
	result := ss[0]
	for _, s := range ss[1:] {
		result += sep + s
	}
	return result
}
