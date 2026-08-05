package store

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// Kanban status values stored in KanbanRow.Status. The core/kanban package
// defines matching constants; store keeps literals to avoid a dependency
// cycle (core/kanban depends on core/store).
const (
	kanbanStatusPending = "pending"
	kanbanStatusRunning = "running"
)

// ErrKanbanNotFound is returned when a kanban item does not exist.
var ErrKanbanNotFound = errors.New("kanban item not found")

// ErrNoPending is returned when no pending kanban item can be claimed.
var ErrNoPending = errors.New("no pending kanban item")

// SaveKanban upserts a kanban item.
func (db *DB) SaveKanban(row *KanbanRow) error {
	return db.Save(row).Error
}

// GetKanban retrieves a kanban item by ID.
func (db *DB) GetKanban(id string) (*KanbanRow, error) {
	var row KanbanRow
	if err := db.Where("id = ?", id).First(&row).Error; err != nil {
		if isNotFound(err) {
			return nil, fmt.Errorf("%w: %s", ErrKanbanNotFound, id)
		}
		return nil, err
	}
	return &row, nil
}

// ListKanban returns kanban items for a user ordered by creation time,
// or all items when userID is empty.
func (db *DB) ListKanban(userID string) ([]KanbanRow, error) {
	q := db.Model(&KanbanRow{}).Order("created_at asc")
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	}
	var rows []KanbanRow
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// DeleteKanban removes a kanban item by ID.
func (db *DB) DeleteKanban(id string) error {
	res := db.Where("id = ?", id).Delete(&KanbanRow{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("%w: %s", ErrKanbanNotFound, id)
	}
	return nil
}

// ClaimNextPending atomically claims the oldest highest-priority pending item
// for a user, marking it running. Returns ErrNoPending when none is available.
func (db *DB) ClaimNextPending(userID string) (*KanbanRow, error) {
	return db.claimNextPending(userID)
}

// ClaimNextPendingAny atomically claims the oldest highest-priority pending
// item across all users. Used by the background worker.
func (db *DB) ClaimNextPendingAny() (*KanbanRow, error) {
	return db.claimNextPending("")
}

func (db *DB) claimNextPending(userID string) (*KanbanRow, error) {
	var claimed KanbanRow
	err := db.Transaction(func(tx *gorm.DB) error {
		q := tx.Where("status = ?", kanbanStatusPending)
		if userID != "" {
			q = q.Where("user_id = ?", userID)
		}
		var row KanbanRow
		if err := q.Order("priority desc, created_at asc").Limit(1).First(&row).Error; err != nil {
			if isNotFound(err) {
				return ErrNoPending
			}
			return err
		}
		res := tx.Model(&KanbanRow{}).
			Where("id = ? AND status = ?", row.ID, kanbanStatusPending).
			Updates(map[string]any{"status": kanbanStatusRunning, "updated_at": time.Now().UTC()})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrNoPending
		}
		row.Status = kanbanStatusRunning
		claimed = row
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &claimed, nil
}
