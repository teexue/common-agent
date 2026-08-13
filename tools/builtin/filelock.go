package builtin

import "sync"

// fileLocks serializes read-modify-write file operations per resolved path.
//
// edit_file / write_file run inside the agent loop, which may execute tools in
// parallel (tool_execution.mode = "parallel"). Without this guard, two
// concurrent edits of the same file both read the old content, apply their own
// replacement, and write back — the last writer silently discards the other's
// change (lost update), which corrupts files. The per-path lock makes each
// read→modify→write sequence atomic within the process.
var (
	fileLocksMu sync.Mutex
	fileLocks   = map[string]*sync.Mutex{}
)

// lockPath acquires an exclusive lock for the given resolved file path and
// returns the matching unlock function. Callers must defer the returned
// function immediately after acquiring.
func lockPath(path string) func() {
	fileLocksMu.Lock()
	mu, ok := fileLocks[path]
	if !ok {
		mu = &sync.Mutex{}
		fileLocks[path] = mu
	}
	fileLocksMu.Unlock()
	mu.Lock()
	return mu.Unlock
}
