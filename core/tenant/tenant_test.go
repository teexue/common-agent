package tenant

import (
	"testing"
	"time"
)

func TestFileStore_SaveAndGet(t *testing.T) {
	dir := t.TempDir()
	store, err := NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	tenant := &Tenant{
		ID:         "t1",
		Name:       "Test Tenant",
		DailyQuota: 100,
		RateLimit:  10,
	}

	if err := store.Save(tenant); err != nil {
		t.Fatal(err)
	}

	got, err := store.Get("t1")
	if err != nil {
		t.Fatal(err)
	}

	if got.ID != "t1" {
		t.Errorf("expected ID 't1', got %q", got.ID)
	}
	if got.Name != "Test Tenant" {
		t.Errorf("expected name 'Test Tenant', got %q", got.Name)
	}
	if got.DailyQuota != 100 {
		t.Errorf("expected daily quota 100, got %d", got.DailyQuota)
	}
	if got.CreatedAt.IsZero() {
		t.Error("expected non-zero created_at")
	}
}

func TestFileStore_Get_NotFound(t *testing.T) {
	dir := t.TempDir()
	store, _ := NewFileStore(dir)

	_, err := store.Get("nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent tenant")
	}
}

func TestFileStore_List(t *testing.T) {
	dir := t.TempDir()
	store, _ := NewFileStore(dir)

	store.Save(&Tenant{ID: "t1", Name: "A"})
	store.Save(&Tenant{ID: "t2", Name: "B"})

	tenants, err := store.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(tenants) != 2 {
		t.Fatalf("expected 2 tenants, got %d", len(tenants))
	}
}

func TestFileStore_Delete(t *testing.T) {
	dir := t.TempDir()
	store, _ := NewFileStore(dir)

	store.Save(&Tenant{ID: "t1", Name: "A"})
	if err := store.Delete("t1"); err != nil {
		t.Fatal(err)
	}

	_, err := store.Get("t1")
	if err == nil {
		t.Fatal("expected error after deletion")
	}
}

func TestFileStore_Delete_NotFound(t *testing.T) {
	dir := t.TempDir()
	store, _ := NewFileStore(dir)

	err := store.Delete("nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent tenant")
	}
}

func TestFileStore_Save_NoID(t *testing.T) {
	dir := t.TempDir()
	store, _ := NewFileStore(dir)

	err := store.Save(&Tenant{Name: "no id"})
	if err == nil {
		t.Fatal("expected error for tenant without ID")
	}
}

func TestFileStore_PreservesCreatedAt(t *testing.T) {
	dir := t.TempDir()
	store, _ := NewFileStore(dir)

	ts := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	store.Save(&Tenant{ID: "t1", Name: "A", CreatedAt: ts})

	got, _ := store.Get("t1")
	if !got.CreatedAt.Equal(ts) {
		t.Errorf("expected created_at %v, got %v", ts, got.CreatedAt)
	}
}
