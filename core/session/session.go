package session

import (
	"crypto/rand"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/teexue/common-agent/core/provider"
)

// MetadataKeyWorkdir is the session metadata key that stores the per-session
// working directory. Empty or absent means the caller falls back to the
// global/default working directory.
const MetadataKeyWorkdir = "workdir"

// MetadataKeySource is the session metadata key recording what created the
// session (e.g. "kanban"). Kanban-created sessions are hidden from the
// conversation session list.
const MetadataKeySource = "source"

// MetadataKeyUsageInputTokens stores the real prompt token count (provider
// input_tokens) of the most recent LLM request for this session. Combined with
// MetadataKeyUsageMsgCount it lets compaction trigger off real usage instead
// of a raw estimate, which matters for CJK-heavy conversations.
const MetadataKeyUsageInputTokens = "usage.input_tokens"

// MetadataKeyUsageMsgCount stores the message count at the time of the most
// recent LLM request, so compaction can estimate only the delta appended since.
const MetadataKeyUsageMsgCount = "usage.message_count"

// MetadataKeyUsageTotalInputTokens and friends store the cumulative provider
// token usage across every run of this session (unlike MetadataKeyUsageInputTokens
// which only holds the most recent single request for compaction). The UI reads
// these to restore the token-usage indicator after reloading a session.
const MetadataKeyUsageTotalInputTokens = "usage.total_input_tokens"
const MetadataKeyUsageTotalOutputTokens = "usage.total_output_tokens"
const MetadataKeyUsageCacheReadTokens = "usage.cache_read_tokens"
const MetadataKeyUsageCacheCreationTokens = "usage.cache_creation_tokens"
const MetadataKeyUsageContextWindow = "usage.context_window"

// MetadataKeyUsageOutputTokens stores the real output token count of the most
// recent single LLM request, mirroring MetadataKeyUsageInputTokens. The UI
// reads it (together with the input key) to restore the token-usage indicator
// after reloading a session with the latest request's usage rather than the
// cumulative session total.
const MetadataKeyUsageOutputTokens = "usage.output_tokens"

// SourceKanban marks sessions created by kanban task runs.
const SourceKanban = "kanban"

// Session holds in-memory conversation state for one agent run.
// It is safe for concurrent use by a single producer (the loop) and
// multiple readers.
type Session struct {
	mu        sync.RWMutex
	ID        string
	UserID    string
	Agent     string
	Title     string
	Messages  []provider.Message
	Metadata  map[string]string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// New creates a session owned by the default local user.
func New(agentName string) *Session {
	return NewForUser(agentName, "usr_local")
}

// NewForUser creates a session with a random ID owned by userID.
func NewForUser(agentName, userID string) *Session {
	now := time.Now().UTC()
	if userID == "" {
		userID = "usr_local"
	}
	return &Session{
		ID:        newID("sess"),
		UserID:    userID,
		Agent:     agentName,
		Messages:  nil,
		Metadata:  make(map[string]string),
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// touch updates the UpdatedAt timestamp. Caller must hold s.mu.
func (s *Session) touch() {
	s.UpdatedAt = time.Now().UTC()
}

// AddMessages appends messages to the session in a concurrency-safe way.
func (s *Session) AddMessages(msgs ...provider.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = append(s.Messages, msgs...)
	s.touch()
}

// GetMessages returns a copy of the current messages slice.
func (s *Session) GetMessages() []provider.Message {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]provider.Message, len(s.Messages))
	copy(out, s.Messages)
	return out
}

// SetMessages replaces all messages (for /clear).
func (s *Session) SetMessages(msgs []provider.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = msgs
	s.touch()
}

// Clear removes all messages.
func (s *Session) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = nil
	s.touch()
}

// GetTitle returns the session title.
func (s *Session) GetTitle() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Title
}

// EnsureTitle sets the title from prompt if the session has no title yet.
func (s *Session) EnsureTitle(prompt string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Title != "" {
		return
	}
	if title := TitleFromPrompt(prompt); title != "" {
		s.Title = title
		s.touch()
	}
}

// GetMetadata returns a copy of the metadata map.
func (s *Session) GetMetadata() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]string, len(s.Metadata))
	for k, v := range s.Metadata {
		out[k] = v
	}
	return out
}

// SetMetadata sets a key-value pair in the metadata map.
func (s *Session) SetMetadata(key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Metadata == nil {
		s.Metadata = make(map[string]string)
	}
	s.Metadata[key] = value
	s.touch()
}

// SetLastUsage records the real provider token usage of the most recent LLM
// request. msgCount must be the number of messages in the session at request
// time (before any messages added after the response).
func (s *Session) SetLastUsage(inputTokens, outputTokens, msgCount int) {
	s.SetMetadata(MetadataKeyUsageInputTokens, strconv.Itoa(inputTokens))
	s.SetMetadata(MetadataKeyUsageOutputTokens, strconv.Itoa(outputTokens))
	s.SetMetadata(MetadataKeyUsageMsgCount, strconv.Itoa(msgCount))
}

// LastUsage returns the recorded real usage of the most recent LLM request.
// Returns (0, 0, 0) when no usage has been recorded (e.g. new sessions).
func (s *Session) LastUsage() (inputTokens, outputTokens, msgCount int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	inputTokens, _ = strconv.Atoi(s.Metadata[MetadataKeyUsageInputTokens])
	outputTokens, _ = strconv.Atoi(s.Metadata[MetadataKeyUsageOutputTokens])
	msgCount, _ = strconv.Atoi(s.Metadata[MetadataKeyUsageMsgCount])
	return inputTokens, outputTokens, msgCount
}

// ClearUsage removes recorded usage. Called after compaction so the next
// projection starts from the compacted message list.
func (s *Session) ClearUsage() {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.Metadata, MetadataKeyUsageInputTokens)
	delete(s.Metadata, MetadataKeyUsageOutputTokens)
	delete(s.Metadata, MetadataKeyUsageMsgCount)
	s.touch()
}

// AddUsage accumulates provider token usage for this run into session metadata
// so it survives reloads. contextWindow replaces any previously stored value
// (the effective window is a property of the model, not cumulative).
func (s *Session) AddUsage(inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, contextWindow int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Metadata == nil {
		s.Metadata = make(map[string]string)
	}
	add := func(key string, delta int) {
		prev, _ := strconv.Atoi(s.Metadata[key])
		s.Metadata[key] = strconv.Itoa(prev + delta)
	}
	add(MetadataKeyUsageTotalInputTokens, inputTokens)
	add(MetadataKeyUsageTotalOutputTokens, outputTokens)
	add(MetadataKeyUsageCacheReadTokens, cacheReadTokens)
	add(MetadataKeyUsageCacheCreationTokens, cacheCreationTokens)
	if contextWindow > 0 {
		s.Metadata[MetadataKeyUsageContextWindow] = strconv.Itoa(contextWindow)
	}
	s.touch()
}

// UsageTotals returns the cumulative token usage recorded for this session
// across all runs. Returns all zeros when nothing has been recorded.
func (s *Session) UsageTotals() (inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, contextWindow int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	inputTokens, _ = strconv.Atoi(s.Metadata[MetadataKeyUsageTotalInputTokens])
	outputTokens, _ = strconv.Atoi(s.Metadata[MetadataKeyUsageTotalOutputTokens])
	cacheReadTokens, _ = strconv.Atoi(s.Metadata[MetadataKeyUsageCacheReadTokens])
	cacheCreationTokens, _ = strconv.Atoi(s.Metadata[MetadataKeyUsageCacheCreationTokens])
	contextWindow, _ = strconv.Atoi(s.Metadata[MetadataKeyUsageContextWindow])
	return inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, contextWindow
}

// titleMaxRunes is the maximum display length for an auto-generated title.
const titleMaxRunes = 40

// TitleFromPrompt derives a short session title from the first user prompt.
func TitleFromPrompt(prompt string) string {
	s := strings.TrimSpace(prompt)
	if s == "" {
		return ""
	}
	s = strings.Join(strings.Fields(s), " ")
	if utf8.RuneCountInString(s) <= titleMaxRunes {
		return s
	}
	runes := []rune(s)
	return string(runes[:titleMaxRunes]) + "…"
}

func newID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// fallback to timestamp if crypto/rand fails
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return fmt.Sprintf("%s_%x", prefix, b)
}
