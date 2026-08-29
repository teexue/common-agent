package main

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var frontendDist embed.FS

// distFS returns the embedded frontend filesystem, or nil if empty.
func distFS() fs.FS {
	entries, err := fs.ReadDir(frontendDist, "dist")
	if err != nil || !distHasIndex(entries) {
		return nil
	}
	sub, err := fs.Sub(frontendDist, "dist")
	if err != nil {
		return nil
	}
	return sub
}

func distHasIndex(entries []fs.DirEntry) bool {
	for _, e := range entries {
		if e.Name() == "index.html" {
			return true
		}
	}
	return false
}
