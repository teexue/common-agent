package store

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
	"unicode"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// UserInfo is a public view of a user (no password).
type UserInfo struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateUser registers a new user with username/password.
func (db *DB) CreateUser(username, password, displayName string) (User, error) {
	username = strings.TrimSpace(strings.ToLower(username))
	displayName = strings.TrimSpace(displayName)
	if err := validateUsername(username); err != nil {
		return User{}, err
	}
	if len(password) < 6 {
		return User{}, fmt.Errorf("password must be at least 6 characters")
	}
	if displayName == "" {
		displayName = username
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, fmt.Errorf("hash password: %w", err)
	}
	id, err := generateID("usr")
	if err != nil {
		return User{}, err
	}
	u := User{
		ID:           id,
		Username:     username,
		PasswordHash: string(hash),
		Name:         displayName,
		CreatedAt:    time.Now().UTC(),
	}
	if err := db.Create(&u).Error; err != nil {
		if strings.Contains(err.Error(), "UNIQUE") || strings.Contains(err.Error(), "unique") {
			return User{}, fmt.Errorf("username %q already exists", username)
		}
		return User{}, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

// AuthenticateUser verifies username/password and returns the user.
func (db *DB) AuthenticateUser(username, password string) (User, error) {
	username = strings.TrimSpace(strings.ToLower(username))
	var u User
	err := db.Where("username = ?", username).First(&u).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, fmt.Errorf("invalid username or password")
	}
	if err != nil {
		return User{}, err
	}
	if u.PasswordHash == "" {
		return User{}, fmt.Errorf("invalid username or password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return User{}, fmt.Errorf("invalid username or password")
	}
	return u, nil
}

// GetUser returns a user by id.
func (db *DB) GetUser(id string) (User, error) {
	var u User
	err := db.Where("id = ?", id).First(&u).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, fmt.Errorf("user %q: %w", id, os.ErrNotExist)
	}
	return u, err
}

// HasUser reports whether a user id exists.
func (db *DB) HasUser(id string) bool {
	var n int64
	_ = db.Model(&User{}).Where("id = ?", id).Count(&n).Error
	return n > 0
}

// CountUsers returns the number of users.
func (db *DB) CountUsers() (int64, error) {
	var n int64
	err := db.Model(&User{}).Count(&n).Error
	return n, err
}

// CountUsersWithPassword returns users that can log in with a password.
func (db *DB) CountUsersWithPassword() (int64, error) {
	var n int64
	err := db.Model(&User{}).Where("password_hash <> ?", "").Count(&n).Error
	return n, err
}

// ListUsers returns public user info.
func (db *DB) ListUsers() ([]UserInfo, error) {
	var rows []User
	if err := db.Order("created_at asc").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]UserInfo, 0, len(rows))
	for _, u := range rows {
		out = append(out, UserInfo{
			ID: u.ID, Username: u.Username, Name: u.Name, CreatedAt: u.CreatedAt,
		})
	}
	return out, nil
}

// ToUserInfo converts a User to UserInfo.
func (u User) ToUserInfo() UserInfo {
	return UserInfo{ID: u.ID, Username: u.Username, Name: u.Name, CreatedAt: u.CreatedAt}
}

func validateUsername(username string) error {
	if len(username) < 2 || len(username) > 32 {
		return fmt.Errorf("username must be 2-32 characters")
	}
	for _, r := range username {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-' {
			continue
		}
		return fmt.Errorf("username may only contain letters, digits, _ and -")
	}
	return nil
}
