package agent

import (
	"crypto/rand"
	"fmt"
	"time"
)

// NewID generates a stable agent id (agt_<hex>).
func NewID() string {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("agt_%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("agt_%x", b)
}
