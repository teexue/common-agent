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
	if err != nil || len(entries) == 0 {
		return nil
	}
	sub, _ := fs.Sub(frontendDist, "dist")
	return sub
}
