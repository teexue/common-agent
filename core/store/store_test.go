package store_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/auth"
	"github.com/teexue/common-agent/core/store"
)

func TestOpen_BootstrapUser(t *testing.T) {
	dir := t.TempDir()
	db, err := store.Open(dir)
	require.NoError(t, err)
	defer db.Close()

	info, err := os.Stat(store.StateFile(dir))
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o600), info.Mode().Perm())

	var n int64
	require.NoError(t, db.Model(&store.User{}).Where("id = ?", store.DefaultUserID).Count(&n).Error)
	assert.Equal(t, int64(1), n)
}

func TestAPIKey_AddVerifyJWT(t *testing.T) {
	dir := t.TempDir()
	db, err := store.Open(dir)
	require.NoError(t, err)
	defer db.Close()

	entry, err := db.AddAPIKey(store.DefaultUserID, "default", "ca_test_secret_key_001")
	require.NoError(t, err)
	assert.NotEmpty(t, entry.KeyHash)
	assert.NotEqual(t, "ca_test_secret_key_001", entry.KeyHash)

	got, ok, err := db.VerifyAPIKey("ca_test_secret_key_001")
	require.NoError(t, err)
	assert.True(t, ok)
	assert.Equal(t, entry.ID, got.ID)

	secret, err := db.EnsureJWTSecret()
	require.NoError(t, err)
	tokens := auth.NewTokenService(secret, db.HasAPIKeyID, db.HasUser)
	tok, err := tokens.Issue(auth.Identity{UserID: entry.UserID, KeyID: entry.ID})
	require.NoError(t, err)
	id, err := tokens.Parse(tok)
	require.NoError(t, err)
	assert.Equal(t, entry.UserID, id.UserID)
	assert.Equal(t, entry.ID, id.KeyID)

	require.NoError(t, db.DeleteAPIKey(entry.ID, store.DefaultUserID))
	_, err = tokens.Parse(tok)
	require.Error(t, err)
}

func TestCreateUser_Authenticate(t *testing.T) {
	dir := t.TempDir()
	db, err := store.Open(dir)
	require.NoError(t, err)
	defer db.Close()

	u, err := db.CreateUser("alice", "secret1", "Alice")
	require.NoError(t, err)
	assert.Equal(t, "alice", u.Username)
	assert.NotEmpty(t, u.PasswordHash)

	got, err := db.AuthenticateUser("Alice", "secret1") // case-insensitive username
	require.NoError(t, err)
	assert.Equal(t, u.ID, got.ID)

	_, err = db.AuthenticateUser("alice", "wrong")
	require.Error(t, err)

	_, err = db.CreateUser("alice", "other12", "")
	require.Error(t, err)

	n, err := db.CountUsersWithPassword()
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
}

func TestMigrateAPIKeysFile(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "api_keys.yaml"), []byte(`keys:
  - id: ak_old
    name: legacy
    key: ca_legacy_plain_key
`), 0o600))

	db, err := store.Open(dir)
	require.NoError(t, err)
	defer db.Close()

	_, ok, err := db.VerifyAPIKey("ca_legacy_plain_key")
	require.NoError(t, err)
	assert.True(t, ok)
}
