package store

import "time"

// User is a local account (multi-user).
type User struct {
	ID           string    `gorm:"primaryKey;size:64"`
	Username     string    `gorm:"uniqueIndex;not null;size:64"`
	PasswordHash string    `gorm:"not null"`
	Name         string    `gorm:"not null"` // display name
	CreatedAt    time.Time `gorm:"not null"`
}

// APIKey is a hashed server API key bound to a user.
type APIKey struct {
	ID        string    `gorm:"primaryKey;size:64"`
	UserID    string    `gorm:"index;not null;size:64;uniqueIndex:idx_api_keys_user_name"`
	Name      string    `gorm:"not null;uniqueIndex:idx_api_keys_user_name"`
	KeyHash   string    `gorm:"uniqueIndex;not null"`
	Prefix    string    `gorm:"not null"`
	CreatedAt time.Time `gorm:"not null"`
}

// Meta stores opaque key/value pairs (jwt_secret, migration flags, …).
type Meta struct {
	Key   string `gorm:"primaryKey"`
	Value string `gorm:"not null"`
}

// Setting is a settings key/value row.
type Setting struct {
	Key   string `gorm:"primaryKey"`
	Value string `gorm:"not null"`
}

// ProviderRow persists a provider spec as JSON.
type ProviderRow struct {
	Name     string `gorm:"primaryKey"`
	SpecJSON string `gorm:"not null"`
}

// Credential stores an env-name → secret mapping.
type Credential struct {
	EnvName string `gorm:"primaryKey"`
	Value   string `gorm:"not null"`
}

// MCPServerRow persists a global MCP server config as JSON.
type MCPServerRow struct {
	Name     string `gorm:"primaryKey"`
	SpecJSON string `gorm:"not null"`
}

// SessionRow persists a chat session.
type SessionRow struct {
	ID           string    `gorm:"primaryKey;size:64"`
	UserID       string    `gorm:"index:idx_sessions_user_updated,priority:1;not null;size:64"`
	Agent        string    `gorm:"not null"`
	Title        string    `gorm:""`
	MessagesJSON string    `gorm:"not null"`
	MetadataJSON string    `gorm:""`
	CreatedAt    time.Time `gorm:"not null"`
	UpdatedAt    time.Time `gorm:"index:idx_sessions_user_updated,priority:2;not null"`
}
