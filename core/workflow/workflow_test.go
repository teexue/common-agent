package workflow

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestWorkflow_Validate_Valid(t *testing.T) {
	w := &Workflow{
		Name:      "test",
		EntryNode: "a",
		Nodes: []Node{
			{ID: "a", Type: NodeAgent, Prompt: "do something"},
			{ID: "b", Type: NodeTool, Tool: "echo"},
		},
		Edges: []Edge{{From: "a", To: "b"}},
	}
	if err := w.Validate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestWorkflow_Validate_MissingName(t *testing.T) {
	w := &Workflow{EntryNode: "a", Nodes: []Node{{ID: "a", Type: NodeAgent, Prompt: "x"}}}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for missing name")
	}
}

func TestWorkflow_Validate_MissingEntryNode(t *testing.T) {
	w := &Workflow{Name: "test", Nodes: []Node{{ID: "a", Type: NodeAgent, Prompt: "x"}}}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for missing entry_node")
	}
}

func TestWorkflow_Validate_NoNodes(t *testing.T) {
	w := &Workflow{Name: "test", EntryNode: "a"}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for no nodes")
	}
}

func TestWorkflow_Validate_DuplicateNodeID(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{
			{ID: "a", Type: NodeAgent, Prompt: "x"},
			{ID: "a", Type: NodeTool, Tool: "echo"},
		},
	}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for duplicate node ID")
	}
}

func TestWorkflow_Validate_EntryNodeNotFound(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "missing",
		Nodes: []Node{{ID: "a", Type: NodeAgent, Prompt: "x"}},
	}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for missing entry node")
	}
}

func TestWorkflow_Validate_EdgeReferencesMissingNode(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{{ID: "a", Type: NodeAgent, Prompt: "x"}},
		Edges: []Edge{{From: "a", To: "missing"}},
	}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for edge referencing missing node")
	}
}

func TestWorkflow_Validate_Cycle(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{
			{ID: "a", Type: NodeAgent, Prompt: "x"},
			{ID: "b", Type: NodeAgent, Prompt: "y"},
		},
		Edges: []Edge{
			{From: "a", To: "b"},
			{From: "b", To: "a"},
		},
	}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for cycle")
	}
}

func TestWorkflow_Validate_UnreachableNode(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{
			{ID: "a", Type: NodeAgent, Prompt: "x"},
			{ID: "b", Type: NodeAgent, Prompt: "y"},
		},
		Edges: []Edge{},
	}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for unreachable node")
	}
}

func TestWorkflow_Validate_InvalidNodeType(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{{ID: "a", Type: "invalid", Prompt: "x"}},
	}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for invalid node type")
	}
}

func TestWorkflow_Validate_AgentNodeRequiresAgentOrPrompt(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{{ID: "a", Type: NodeAgent}},
	}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for agent node without agent or prompt")
	}
}

func TestWorkflow_Validate_ToolNodeRequiresTool(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{{ID: "a", Type: NodeTool}},
	}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for tool node without tool")
	}
}

func TestWorkflow_Validate_ConditionNodeRequiresCondition(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{{ID: "a", Type: NodeCondition}},
	}
	if err := w.Validate(); err == nil {
		t.Fatal("expected error for condition node without condition")
	}
}

func TestWorkflow_TopologicalSort(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{
			{ID: "a", Type: NodeAgent, Prompt: "x"},
			{ID: "b", Type: NodeAgent, Prompt: "y"},
			{ID: "c", Type: NodeTool, Tool: "echo"},
		},
		Edges: []Edge{
			{From: "a", To: "b"},
			{From: "a", To: "c"},
		},
	}

	order, err := w.TopologicalSort()
	if err != nil {
		t.Fatal(err)
	}
	if len(order) != 3 {
		t.Fatalf("expected 3 nodes, got %d", len(order))
	}
	if order[0] != "a" {
		t.Errorf("expected first node 'a', got %q", order[0])
	}
}

func TestWorkflow_ExecutionLayers(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{
			{ID: "a", Type: NodeAgent, Prompt: "x"},
			{ID: "b", Type: NodeAgent, Prompt: "y"},
			{ID: "c", Type: NodeTool, Tool: "echo"},
			{ID: "d", Type: NodeAgent, Prompt: "z"},
		},
		Edges: []Edge{
			{From: "a", To: "b"},
			{From: "a", To: "c"},
			{From: "b", To: "d"},
			{From: "c", To: "d"},
		},
	}

	layers, err := w.ExecutionLayers()
	if err != nil {
		t.Fatal(err)
	}
	if len(layers) != 3 {
		t.Fatalf("expected 3 layers, got %d: %v", len(layers), layers)
	}
	// Layer 0: [a], Layer 1: [b, c], Layer 2: [d]
	if len(layers[0]) != 1 || layers[0][0] != "a" {
		t.Errorf("unexpected layer 0: %v", layers[0])
	}
	if len(layers[1]) != 2 {
		t.Errorf("unexpected layer 1: %v", layers[1])
	}
	if len(layers[2]) != 1 || layers[2][0] != "d" {
		t.Errorf("unexpected layer 2: %v", layers[2])
	}
}

func TestWorkflow_GetNode(t *testing.T) {
	w := &Workflow{
		Nodes: []Node{{ID: "a", Type: NodeAgent, Prompt: "x"}},
	}
	node, ok := w.GetNode("a")
	if !ok || node.ID != "a" {
		t.Error("expected to find node 'a'")
	}
	_, ok = w.GetNode("missing")
	if ok {
		t.Error("expected not to find node 'missing'")
	}
}

func TestWorkflow_OutEdges(t *testing.T) {
	w := &Workflow{
		Edges: []Edge{
			{From: "a", To: "b"},
			{From: "a", To: "c"},
			{From: "b", To: "d"},
		},
	}
	edges := w.OutEdges("a")
	if len(edges) != 2 {
		t.Fatalf("expected 2 out-edges from 'a', got %d", len(edges))
	}
}

func TestLoadFromBytes(t *testing.T) {
	yaml := `
name: test-workflow
entry_node: start
nodes:
  - id: start
    type: agent
    prompt: "Hello"
  - id: end
    type: tool
    tool: echo
edges:
  - from: start
    to: end
`
	w, err := LoadFromBytes([]byte(yaml))
	if err != nil {
		t.Fatal(err)
	}
	if w.Name != "test-workflow" {
		t.Errorf("expected name 'test-workflow', got %q", w.Name)
	}
	if len(w.Nodes) != 2 {
		t.Errorf("expected 2 nodes, got %d", len(w.Nodes))
	}
}

func TestLoadFromBytes_Invalid(t *testing.T) {
	_, err := LoadFromBytes([]byte("invalid: [yaml"))
	if err == nil {
		t.Fatal("expected error for invalid YAML")
	}
}

func TestLoad(t *testing.T) {
	dir := t.TempDir()
	yaml := `
name: test
entry_node: a
nodes:
  - id: a
    type: agent
    prompt: "Hello"
`
	if err := os.WriteFile(filepath.Join(dir, "test.yaml"), []byte(yaml), 0o644); err != nil {
		t.Fatal(err)
	}

	w, err := Load(filepath.Join(dir, "test.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if w.Name != "test" {
		t.Errorf("expected name 'test', got %q", w.Name)
	}
}

func TestLoadAll(t *testing.T) {
	dir := t.TempDir()
	for i, name := range []string{"wf1", "wf2"} {
		yaml := fmt.Sprintf(`
name: %s
entry_node: a
nodes:
  - id: a
    type: agent
    prompt: "Step %d"
`, name, i)
		os.WriteFile(filepath.Join(dir, name+".yaml"), []byte(yaml), 0o644)
	}

	workflows, err := LoadAll(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(workflows) != 2 {
		t.Fatalf("expected 2 workflows, got %d", len(workflows))
	}
}

func TestRunner_Run_Sequential(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{
			{ID: "a", Type: NodeAgent, Prompt: "Hello"},
			{ID: "b", Type: NodeTool, Tool: "echo"},
		},
		Edges: []Edge{{From: "a", To: "b"}},
	}

	runner := NewRunner(w, nil)
	executor := func(ctx context.Context, node Node, input string) (string, error) {
		return fmt.Sprintf("output-%s", node.ID), nil
	}

	result, err := runner.Run(context.Background(), executor)
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "completed" {
		t.Errorf("expected status 'completed', got %q", result.Status)
	}
	if result.NodeOutputs["a"] != "output-a" {
		t.Errorf("unexpected output for node a: %q", result.NodeOutputs["a"])
	}
	if result.NodeOutputs["b"] != "output-b" {
		t.Errorf("unexpected output for node b: %q", result.NodeOutputs["b"])
	}
}

func TestRunner_Run_Parallel(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{
			{ID: "a", Type: NodeAgent, Prompt: "Hello"},
			{ID: "b", Type: NodeAgent, Prompt: "B"},
			{ID: "c", Type: NodeAgent, Prompt: "C"},
			{ID: "d", Type: NodeTool, Tool: "echo"},
		},
		Edges: []Edge{
			{From: "a", To: "b"},
			{From: "a", To: "c"},
			{From: "b", To: "d"},
			{From: "c", To: "d"},
		},
	}

	runner := NewRunner(w, nil)
	executor := func(ctx context.Context, node Node, input string) (string, error) {
		return fmt.Sprintf("done-%s", node.ID), nil
	}

	result, err := runner.Run(context.Background(), executor)
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "completed" {
		t.Errorf("expected status 'completed', got %q", result.Status)
	}
	if len(result.NodeOutputs) != 4 {
		t.Errorf("expected 4 outputs, got %d", len(result.NodeOutputs))
	}
}

func TestRunner_Run_NodeError(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{
			{ID: "a", Type: NodeAgent, Prompt: "Hello"},
		},
	}

	runner := NewRunner(w, nil)
	executor := func(ctx context.Context, node Node, input string) (string, error) {
		return "", fmt.Errorf("node failed")
	}

	result, err := runner.Run(context.Background(), executor)
	if err == nil {
		t.Fatal("expected error")
	}
	if result.Status != "failed" {
		t.Errorf("expected status 'failed', got %q", result.Status)
	}
}

func TestRunner_Run_CancelledContext(t *testing.T) {
	w := &Workflow{
		Name: "test", EntryNode: "a",
		Nodes: []Node{
			{ID: "a", Type: NodeAgent, Prompt: "Hello"},
		},
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	runner := NewRunner(w, nil)
	executor := func(ctx context.Context, node Node, input string) (string, error) {
		return "ok", nil
	}

	_, err := runner.Run(ctx, executor)
	if err == nil {
		t.Fatal("expected error for cancelled context")
	}
}
