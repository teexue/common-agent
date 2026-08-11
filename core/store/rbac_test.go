package store_test

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/store"
)

func TestListUsers(t *testing.T) {
	db := openTestDB(t)

	alice, err := db.CreateUser("alice", "secret1", "Alice", store.RoleMember)
	require.NoError(t, err)
	bob, err := db.CreateUser("bob", "secret2", "", store.RoleAdmin)
	require.NoError(t, err)

	users, err := db.ListUsers()
	require.NoError(t, err)
	require.Len(t, users, 3) // usr_local + alice + bob

	byID := map[string]store.User{}
	for _, u := range users {
		byID[u.ID] = u
	}
	assert.Equal(t, store.RoleAdmin, byID[store.DefaultUserID].Role)
	assert.Equal(t, store.RoleMember, byID[alice.ID].Role)
	assert.Equal(t, store.RoleAdmin, byID[bob.ID].Role)
	assert.Equal(t, "bob", byID[bob.ID].Name) // display name defaults to username
}

func TestUpdateUserRole_LastAdminProtection(t *testing.T) {
	db := openTestDB(t)

	// usr_local is the only admin: demoting it must fail.
	require.Error(t, db.UpdateUserRole(store.DefaultUserID, store.RoleMember))

	role, err := db.GetUserRole(store.DefaultUserID)
	require.NoError(t, err)
	assert.Equal(t, store.RoleAdmin, role)

	// With a second admin, demotion succeeds.
	alice, err := db.CreateUser("alice", "secret1", "", store.RoleAdmin)
	require.NoError(t, err)
	require.NoError(t, db.UpdateUserRole(store.DefaultUserID, store.RoleMember))

	role, err = db.GetUserRole(store.DefaultUserID)
	require.NoError(t, err)
	assert.Equal(t, store.RoleMember, role)

	// Promote back and demote alice.
	require.NoError(t, db.UpdateUserRole(store.DefaultUserID, store.RoleAdmin))
	require.NoError(t, db.UpdateUserRole(alice.ID, store.RoleMember))

	// Invalid role rejected; unknown user not found.
	require.Error(t, db.UpdateUserRole(store.DefaultUserID, "root"))
	require.ErrorIs(t, db.UpdateUserRole("usr_missing", store.RoleAdmin), os.ErrNotExist)
}

func TestDeleteUser_LastAdminProtection(t *testing.T) {
	db := openTestDB(t)

	// Cannot delete the only admin.
	require.Error(t, db.DeleteUser(store.DefaultUserID))

	alice, err := db.CreateUser("alice", "secret1", "", store.RoleAdmin)
	require.NoError(t, err)

	// Two admins now: deleting usr_local works.
	require.NoError(t, db.DeleteUser(store.DefaultUserID))
	assert.False(t, db.HasUser(store.DefaultUserID))

	// Deleting the remaining admin fails again.
	require.Error(t, db.DeleteUser(alice.ID))

	// Members are always deletable; their API keys go with them.
	bob, err := db.CreateUser("bob", "secret2", "", store.RoleMember)
	require.NoError(t, err)
	_, key, err := db.AddAPIKey(bob.ID, "b1", "*", nil)
	require.NoError(t, err)
	require.NoError(t, db.DeleteUser(bob.ID))
	assert.False(t, db.HasUser(bob.ID))
	assert.False(t, db.HasAPIKeyID(key.ID))

	require.ErrorIs(t, db.DeleteUser("usr_missing"), os.ErrNotExist)
}

func TestResetUserPassword(t *testing.T) {
	db := openTestDB(t)

	alice, err := db.CreateUser("alice", "secret1", "", store.RoleMember)
	require.NoError(t, err)

	require.Error(t, db.ResetUserPassword(alice.ID, "short"))
	require.NoError(t, db.ResetUserPassword(alice.ID, "newsecret"))

	_, err = db.AuthenticateUser("alice", "secret1")
	require.Error(t, err)
	got, err := db.AuthenticateUser("alice", "newsecret")
	require.NoError(t, err)
	assert.Equal(t, alice.ID, got.ID)

	require.ErrorIs(t, db.ResetUserPassword("usr_missing", "newsecret"), os.ErrNotExist)
}

func TestGetUserRole(t *testing.T) {
	db := openTestDB(t)

	role, err := db.GetUserRole(store.DefaultUserID)
	require.NoError(t, err)
	assert.Equal(t, store.RoleAdmin, role)

	_, err = db.GetUserRole("usr_missing")
	require.ErrorIs(t, err, os.ErrNotExist)
}

func TestAllowRegistration(t *testing.T) {
	db := openTestDB(t)

	// Default is closed.
	assert.False(t, db.GetAllowRegistration())

	require.NoError(t, db.SetAllowRegistration(true))
	assert.True(t, db.GetAllowRegistration())

	require.NoError(t, db.SetAllowRegistration(false))
	assert.False(t, db.GetAllowRegistration())
}
