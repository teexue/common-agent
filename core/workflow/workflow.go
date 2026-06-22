// Package workflow provides DAG-based workflow orchestration for agents.
// Workflows are defined as YAML files with nodes (agent/tool/condition)
// and edges (directed connections with optional conditions).
package workflow

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// NodeType identifies the kind of workflow node.
type NodeType string

const (
	NodeAgent     NodeType = "agent"
	NodeTool      NodeType = "tool"
	NodeCondition NodeType = "condition"
)

// Workflow defines a DAG of nodes and edges.
type Workflow struct {
	Name        string     `yaml:"name"`
	Description string     `yaml:"description,omitempty"`
	EntryNode   string     `yaml:"entry_node"`
	Nodes       []Node     `yaml:"nodes"`
	Edges       []Edge     `yaml:"edges"`
}

// Node is a single step in the workflow.
type Node struct {
	ID          string   `yaml:"id"`
	Type        NodeType `yaml:"type"`
	Agent       string   `yaml:"agent,omitempty"`        // for type=agent
	Tool        string   `yaml:"tool,omitempty"`         // for type=tool
	Prompt      string   `yaml:"prompt,omitempty"`       // for type=agent
	Condition   string   `yaml:"condition,omitempty"`    // for type=condition
	Description string   `yaml:"description,omitempty"`
}

// Edge connects two nodes, optionally with a condition.
type Edge struct {
	From      string `yaml:"from"`
	To        string `yaml:"to"`
	Condition string `yaml:"condition,omitempty"` // e.g. "true", "false", "output.contains('ok')"
}

// Validate checks the workflow for structural correctness.
func (w *Workflow) Validate() error {
	if w.Name == "" {
		return fmt.Errorf("workflow name is required")
	}
	if w.EntryNode == "" {
		return fmt.Errorf("entry_node is required")
	}
	if len(w.Nodes) == 0 {
		return fmt.Errorf("at least one node is required")
	}

	// Build node map.
	nodeMap := make(map[string]Node)
	for _, n := range w.Nodes {
		if n.ID == "" {
			return fmt.Errorf("node ID is required")
		}
		if _, exists := nodeMap[n.ID]; exists {
			return fmt.Errorf("duplicate node ID: %s", n.ID)
		}
		nodeMap[n.ID] = n
	}

	// Validate entry node exists.
	if _, ok := nodeMap[w.EntryNode]; !ok {
		return fmt.Errorf("entry_node %q not found in nodes", w.EntryNode)
	}

	// Validate edges reference existing nodes.
	for i, e := range w.Edges {
		if _, ok := nodeMap[e.From]; !ok {
			return fmt.Errorf("edge[%d]: source node %q not found", i, e.From)
		}
		if _, ok := nodeMap[e.To]; !ok {
			return fmt.Errorf("edge[%d]: target node %q not found", i, e.To)
		}
	}

	// Validate node types.
	for _, n := range w.Nodes {
		switch n.Type {
		case NodeAgent:
			if n.Agent == "" && n.Prompt == "" {
				return fmt.Errorf("node %q (agent): agent or prompt is required", n.ID)
			}
		case NodeTool:
			if n.Tool == "" {
				return fmt.Errorf("node %q (tool): tool is required", n.ID)
			}
		case NodeCondition:
			if n.Condition == "" {
				return fmt.Errorf("node %q (condition): condition expression is required", n.ID)
			}
		default:
			return fmt.Errorf("node %q: unknown type %q", n.ID, n.Type)
		}
	}

	// Check for cycles.
	if err := w.detectCycles(); err != nil {
		return err
	}

	// Check entry node can reach all nodes.
	if err := w.checkReachability(); err != nil {
		return err
	}

	return nil
}

// detectCycles uses DFS to detect cycles in the DAG.
func (w *Workflow) detectCycles() error {
	adj := w.adjacencyList()
	visited := make(map[string]bool)
	inStack := make(map[string]bool)

	var dfs func(id string) error
	dfs = func(id string) error {
		if inStack[id] {
			return fmt.Errorf("cycle detected involving node %q", id)
		}
		if visited[id] {
			return nil
		}
		visited[id] = true
		inStack[id] = true
		for _, next := range adj[id] {
			if err := dfs(next); err != nil {
				return err
			}
		}
		inStack[id] = false
		return nil
	}

	for _, n := range w.Nodes {
		if err := dfs(n.ID); err != nil {
			return err
		}
	}
	return nil
}

// checkReachability verifies the entry node can reach all other nodes.
func (w *Workflow) checkReachability() error {
	adj := w.adjacencyList()
	reachable := make(map[string]bool)
	var dfs func(id string)
	dfs = func(id string) {
		if reachable[id] {
			return
		}
		reachable[id] = true
		for _, next := range adj[id] {
			dfs(next)
		}
	}
	dfs(w.EntryNode)

	for _, n := range w.Nodes {
		if !reachable[n.ID] {
			return fmt.Errorf("node %q is not reachable from entry_node %q", n.ID, w.EntryNode)
		}
	}
	return nil
}

func (w *Workflow) adjacencyList() map[string][]string {
	adj := make(map[string][]string)
	for _, e := range w.Edges {
		adj[e.From] = append(adj[e.From], e.To)
	}
	return adj
}

// TopologicalSort returns nodes in topological order (BFS/Kahn's algorithm).
func (w *Workflow) TopologicalSort() ([]string, error) {
	adj := w.adjacencyList()
	inDegree := make(map[string]int)
	for _, n := range w.Nodes {
		inDegree[n.ID] = 0
	}
	for _, edges := range adj {
		for _, to := range edges {
			inDegree[to]++
		}
	}

	var queue []string
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}
	sort.Strings(queue) // deterministic order

	var order []string
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		order = append(order, id)

		for _, next := range adj[id] {
			inDegree[next]--
			if inDegree[next] == 0 {
				queue = append(queue, next)
			}
		}
	}

	if len(order) != len(w.Nodes) {
		return nil, fmt.Errorf("topological sort failed: cycle exists")
	}
	return order, nil
}

// ExecutionLayers returns nodes grouped by execution layer (nodes in the same layer can run in parallel).
func (w *Workflow) ExecutionLayers() ([][]string, error) {
	adj := w.adjacencyList()
	inDegree := make(map[string]int)
	for _, n := range w.Nodes {
		inDegree[n.ID] = 0
	}
	for _, edges := range adj {
		for _, to := range edges {
			inDegree[to]++
		}
	}

	var layers [][]string
	remaining := len(w.Nodes)

	for remaining > 0 {
		// Find all nodes with in-degree 0.
		var layer []string
		for id, deg := range inDegree {
			if deg == 0 {
				layer = append(layer, id)
			}
		}
		if len(layer) == 0 {
			return nil, fmt.Errorf("cycle detected: no zero-in-degree nodes found with %d remaining", remaining)
		}
		sort.Strings(layer)
		layers = append(layers, layer)

		// Remove these nodes and update in-degrees.
		for _, id := range layer {
			inDegree[id] = -1 // mark as removed
			for _, next := range adj[id] {
				inDegree[next]--
			}
		}
		remaining -= len(layer)
	}

	return layers, nil
}

// GetNode returns a node by ID.
func (w *Workflow) GetNode(id string) (Node, bool) {
	for _, n := range w.Nodes {
		if n.ID == id {
			return n, true
		}
	}
	return Node{}, false
}

// OutEdges returns edges from a given node.
func (w *Workflow) OutEdges(nodeID string) []Edge {
	var edges []Edge
	for _, e := range w.Edges {
		if e.From == nodeID {
			edges = append(edges, e)
		}
	}
	return edges
}

// Load reads and validates a workflow YAML file.
func Load(path string) (*Workflow, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read workflow: %w", err)
	}
	return LoadFromBytes(data)
}

// LoadFromBytes parses and validates a workflow from raw YAML bytes.
func LoadFromBytes(data []byte) (*Workflow, error) {
	var w Workflow
	if err := yaml.Unmarshal(data, &w); err != nil {
		return nil, fmt.Errorf("parse workflow: %w", err)
	}
	if err := w.Validate(); err != nil {
		return nil, fmt.Errorf("validate workflow: %w", err)
	}
	return &w, nil
}

// LoadAll loads all workflows from a directory.
func LoadAll(dir string) ([]*Workflow, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read workflows dir: %w", err)
	}

	var workflows []*Workflow
	var errs []string
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		w, err := Load(filepath.Join(dir, e.Name()))
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", e.Name(), err))
			continue
		}
		workflows = append(workflows, w)
	}

	if len(errs) > 0 {
		return workflows, fmt.Errorf("errors loading workflows: %s", strings.Join(errs, "; "))
	}
	return workflows, nil
}
