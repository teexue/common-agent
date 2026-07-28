package config

import "github.com/teexue/common-agent/core/store"

// stateDB is the process-wide SQLite store when BindDB has been called.
var stateDB *store.DB

// BindDB sets the shared SQLite store used by config helpers.
func BindDB(db *store.DB) { stateDB = db }

// DB returns the bound store, or nil.
func DB() *store.DB { return stateDB }
