package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// TokenService issues and verifies HS256 JWTs for API clients.
type TokenService struct {
	secret  []byte
	ttl     time.Duration
	hasKey  func(keyID string) bool
	hasUser func(userID string) bool
}

// Claims are JWT claims for a user session or API key.
type Claims struct {
	KeyID string `json:"kid"`
	jwt.RegisteredClaims
}

// NewTokenService creates a token service.
// hasKey reports whether an API key id is still valid.
// hasUser reports whether a user id still exists (for password JWTs).
func NewTokenService(secret []byte, hasKey func(keyID string) bool, hasUser func(userID string) bool) *TokenService {
	if hasKey == nil {
		hasKey = func(string) bool { return true }
	}
	if hasUser == nil {
		hasUser = func(string) bool { return true }
	}
	return &TokenService{
		secret:  secret,
		ttl:     365 * 24 * time.Hour,
		hasKey:  hasKey,
		hasUser: hasUser,
	}
}

// Issue creates a JWT for an API-key identity (requires KeyID).
func (s *TokenService) Issue(id Identity) (string, error) {
	if id.UserID == "" || id.KeyID == "" {
		return "", fmt.Errorf("user_id and key_id are required")
	}
	return s.sign(id)
}

// IssueLogin creates a JWT for a password login session.
func (s *TokenService) IssueLogin(userID string) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("user_id is required")
	}
	return s.sign(Identity{UserID: userID, KeyID: PasswordKeyID})
}

func (s *TokenService) sign(id Identity) (string, error) {
	now := time.Now().UTC()
	claims := Claims{
		KeyID: id.KeyID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   id.UserID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
			ID:        id.KeyID,
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString(s.secret)
}

// Parse validates a JWT and returns the identity.
func (s *TokenService) Parse(tokenStr string) (Identity, error) {
	tok, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return s.secret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil {
		return Identity{}, fmt.Errorf("parse token: %w", err)
	}
	claims, ok := tok.Claims.(*Claims)
	if !ok || !tok.Valid {
		return Identity{}, fmt.Errorf("invalid token claims")
	}
	kid := claims.KeyID
	if kid == "" {
		kid = claims.ID
	}
	if claims.Subject == "" || kid == "" {
		return Identity{}, fmt.Errorf("token missing subject or key id")
	}
	if kid == PasswordKeyID {
		if !s.hasUser(claims.Subject) {
			return Identity{}, fmt.Errorf("user revoked")
		}
		return Identity{UserID: claims.Subject, KeyID: PasswordKeyID}, nil
	}
	if !s.hasKey(kid) {
		return Identity{}, fmt.Errorf("api key revoked")
	}
	return Identity{UserID: claims.Subject, KeyID: kid}, nil
}

// LooksLikeJWT reports whether s has JWT structure (three base64 segments).
func LooksLikeJWT(s string) bool {
	n := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			n++
		}
	}
	return n == 2
}
