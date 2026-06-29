package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/skill"
)

// RunRequest is the HTTP DTO for POST /v1/agents/run.
type RunRequest struct {
	Agent     string             `json:"agent"`
	Prompt    string             `json:"prompt"`
	SessionID string             `json:"session_id,omitempty"`
	Messages  []provider.Message `json:"messages,omitempty"`
	WorkDir   string             `json:"workdir,omitempty"`
}

func (s *Server) handleRun(c *gin.Context) {
	var req RunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_json", "message": err.Error()})
		return
	}
	if req.Agent == "" || req.Prompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "agent and prompt are required"})
		return
	}

	a, err := agent.LoadByName(s.agentsDir, req.Agent)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "agent_error", "message": err.Error()})
		return
	}

	_, skillToolNames := s.injectSkills(a)
	defer func() {
		if len(skillToolNames) > 0 {
			s.registry.UnregisterBatch(skillToolNames)
		}
	}()

	loopCfg, sess, err := s.setupLoopConfig(a, req)
	if err != nil {
		if code, ok := err.(*apiError); ok {
			c.JSON(code.status, gin.H{"code": code.code, "message": code.msg})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"code": "run_error", "message": err.Error()})
		}
		return
	}

	runCtx := c.Request.Context()
	if s.shutdownCtx != nil {
		var cancel context.CancelFunc
		runCtx, cancel = mergeContext(s.shutdownCtx, c.Request.Context())
		defer cancel()
	}

	events, err := loop.Run(runCtx, loopCfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "run_error", "message": err.Error()})
		return
	}

	s.streamEvents(c, events, a.Name, sess.ID)
}

type apiError struct {
	status int
	code   string
	msg    string
}

func (e *apiError) Error() string { return e.msg }

func (s *Server) setupLoopConfig(a *agent.Agent, req RunRequest) (loop.Config, *session.Session, error) {
	p, err := s.newProvider(a)
	if err != nil {
		return loop.Config{}, nil, &apiError{http.StatusInternalServerError, "provider_error", err.Error()}
	}

	sess := session.New(a.Name)
	if len(req.Messages) > 0 {
		sess.SetMessages(req.Messages)
	}

	var pol permission.Policy
	if a.Permissions != nil {
		pol = permission.NewAgentPolicy(*a.Permissions)
	} else {
		pol = permission.AllowAllPolicy{}
	}

	cfg := loop.Config{
		Provider: p, Registry: s.registry, Agent: a, Session: sess,
		Prompt: req.Prompt, Logger: s.logger, Store: s.store,
		Policy: pol, Approver: s.approver, WorkDir: req.WorkDir,
	}

	if req.SessionID != "" {
		if s.store == nil {
			return loop.Config{}, nil, &apiError{http.StatusBadRequest, "session_error", "session persistence not configured"}
		}
		if _, err := s.store.Load(req.SessionID); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				return loop.Config{}, nil, &apiError{http.StatusBadRequest, "session_error", "session not found"}
			}
			return loop.Config{}, nil, &apiError{http.StatusInternalServerError, "session_error", err.Error()}
		}
		cfg.SessionID = req.SessionID
	}

	return cfg, sess, nil
}

func (s *Server) streamEvents(c *gin.Context, events <-chan event.Event, agentName, sessionID string) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "stream_error", "message": "streaming unsupported"})
		return
	}

	s.logger.Info("agent run started", "session_id", sessionID, "agent", agentName)
	runStart := time.Now()
	s.health.AgentMetrics.RecordRunStart(agentName)

	turn := 0
	runSuccess := false
	for ev := range events {
		if s.eventLogger != nil {
			if ev.Type == event.TypeDone || ev.Type == event.TypeError {
				turn++
			}
			_ = s.eventLogger.Log(audit.EventRecord{
				Timestamp: time.Now(), SessionID: sessionID,
				Agent: agentName, Turn: turn, Event: ev,
			})
		}
		if ev.Type == event.TypeDone && ev.Status == "completed" {
			runSuccess = true
		}
		data, _ := json.Marshal(ev)
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		flusher.Flush()
	}

	s.health.AgentMetrics.RecordRunEnd(agentName, time.Since(runStart), runSuccess)
}

// injectSkills loads skills and injects their instructions into the agent's
// system prompt. Returns the names of temporarily registered tools.
func (s *Server) injectSkills(a *agent.Agent) (loadedSkills []*skill.Skill, tempToolNames []string) {
	loader := skill.NewLoader(s.skillsDir)
	allSkills, err := loader.LoadAll()
	if err != nil {
		s.logger.Warn("some skills failed to load", "error", err)
	}
	if len(allSkills) == 0 {
		return nil, nil
	}

	selected := filterSkills(a, allSkills, s.logger)
	if len(selected) == 0 {
		return nil, nil
	}

	var sections []string
	for _, sk := range selected {
		if body := sk.Body(); body != "" {
			sections = append(sections, fmt.Sprintf("[[skill:%s]]\n%s", sk.Name, body))
		}
		if sk.LegacyManifest != nil {
			for _, t := range skill.Tools(sk) {
				if err := s.registry.Register(t); err != nil {
					s.logger.Warn("failed to register skill tool", "skill", sk.Name, "tool", t.Name(), "error", err)
					continue
				}
				tempToolNames = append(tempToolNames, t.Name())
			}
		}
	}

	if len(sections) > 0 {
		a.SystemPrompt += "\n\n# Available Skills\n\n" + strings.Join(sections, "\n\n")
	}

	if len(tempToolNames) > 0 {
		existing := make(map[string]bool, len(a.Tools))
		for _, t := range a.Tools {
			existing[t] = true
		}
		for _, t := range tempToolNames {
			if !existing[t] {
				a.Tools = append(a.Tools, t)
			}
		}
	}

	return selected, tempToolNames
}

func filterSkills(a *agent.Agent, all []*skill.Skill, log interface{ Warn(string, ...any) }) []*skill.Skill {
	if len(a.Skills) == 0 {
		return all
	}
	byName := make(map[string]*skill.Skill, len(all))
	for _, sk := range all {
		byName[sk.Name] = sk
	}
	var selected []*skill.Skill
	for _, name := range a.Skills {
		if sk, ok := byName[name]; ok {
			selected = append(selected, sk)
		} else {
			log.Warn("skill not found", "agent", a.Name, "skill", name)
		}
	}
	return selected
}

// mergeContext returns a context that is cancelled when either a or b is done.
func mergeContext(a, b context.Context) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		select {
		case <-a.Done():
		case <-b.Done():
		}
		cancel()
	}()
	return ctx, cancel
}
