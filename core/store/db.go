package store

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DefaultUserID is the legacy local user used for open mode and file migrations.
const DefaultUserID = "usr_local"

// DB wraps a GORM connection to ~/.common-agent/state.db.
type DB struct {
	*gorm.DB
	home string
}

// StateFile returns the state.db path under home.
func StateFile(home string) string {
	return filepath.Join(home, "state.db")
}

// Open opens (or creates) state.db, runs AutoMigrate, and ensures the default user.
func Open(home string) (*DB, error) {
	if err := os.MkdirAll(home, 0o755); err != nil {
		return nil, fmt.Errorf("create home: %w", err)
	}
	path := StateFile(home)
	created := false
	if _, err := os.Stat(path); os.IsNotExist(err) {
		created = true
	}

	gdb, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("open state.db: %w", err)
	}
	if created {
		_ = os.Chmod(path, 0o600)
	}

	sqlDB, err := gdb.DB()
	if err != nil {
		return nil, fmt.Errorf("sql db: %w", err)
	}
	if _, err := sqlDB.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return nil, fmt.Errorf("pragma foreign_keys: %w", err)
	}

	db := &DB{DB: gdb, home: home}
	if err := db.autoMigrate(); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	if err := db.ensureDefaultUser(); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	if err := db.MigrateFromFiles(); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("migrate from files: %w", err)
	}
	return db, nil
}

// Home returns the config home directory.
func (db *DB) Home() string { return db.home }

// Close closes the underlying SQL connection.
func (db *DB) Close() error {
	sqlDB, err := db.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func (db *DB) autoMigrate() error {
	if err := db.DB.AutoMigrate(
		&User{},
		&APIKey{},
		&Meta{},
		&Setting{},
		&ProviderRow{},
		&Credential{},
		&MCPServerRow{},
		&SessionRow{},
	); err != nil {
		return fmt.Errorf("auto migrate: %w", err)
	}
	return nil
}

func (db *DB) ensureDefaultUser() error {
	var count int64
	if err := db.Model(&User{}).Where("id = ?", DefaultUserID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		if err := db.Create(&User{
			ID:        DefaultUserID,
			Username:  "local",
			Name:      "local",
			CreatedAt: time.Now().UTC(),
		}).Error; err != nil {
			return err
		}
	}
	// Backfill username for installs migrated before multi-user.
	return db.Model(&User{}).
		Where("id = ? AND (username = '' OR username IS NULL)", DefaultUserID).
		Update("username", "local").Error
}
