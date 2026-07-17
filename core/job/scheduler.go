package job

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

// RunRequest is the input for a single job tick execution.
type RunRequest struct {
	Agent     string
	Prompt    string
	WorkDir   string
	SessionID string
}

// Runner executes a job tick to completion and returns the session id used.
type Runner func(ctx context.Context, req RunRequest) (sessionID string, err error)

// Scheduler polls due jobs and executes them via Runner.
type Scheduler struct {
	store       Store
	runner      Runner
	logger      *slog.Logger
	interval    time.Duration
	maxParallel int

	mu      sync.Mutex
	running map[string]bool
	active  int
	cancel  context.CancelFunc
	wg      sync.WaitGroup
}

// SchedulerConfig configures a Scheduler.
type SchedulerConfig struct {
	Store       Store
	Runner      Runner
	Logger      *slog.Logger
	TickEvery   time.Duration
	MaxParallel int
}

// NewScheduler creates a Scheduler.
func NewScheduler(cfg SchedulerConfig) *Scheduler {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	tick := cfg.TickEvery
	if tick <= 0 {
		tick = time.Second
	}
	maxP := cfg.MaxParallel
	if maxP <= 0 {
		maxP = 2
	}
	return &Scheduler{
		store:       cfg.Store,
		runner:      cfg.Runner,
		logger:      logger,
		interval:    tick,
		maxParallel: maxP,
		running:     make(map[string]bool),
	}
}

// Start begins the polling loop until ctx is cancelled.
func (s *Scheduler) Start(ctx context.Context) {
	ctx, s.cancel = context.WithCancel(ctx)
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.resetRunningFlags()
		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()
		s.tick(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.tick(ctx)
			}
		}
	}()
}

// Stop cancels the scheduler and waits for the poll loop to exit.
func (s *Scheduler) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
	s.wg.Wait()
}

// TriggerNow queues a job to run immediately (async).
func (s *Scheduler) TriggerNow(_ context.Context, id string) error {
	j, err := s.store.Load(id)
	if err != nil {
		return err
	}
	go func() {
		if err := s.execute(context.Background(), j, true); err != nil {
			s.logger.Warn("log.job.trigger_failed", "job_id", id, "error", err)
		}
	}()
	return nil
}

func (s *Scheduler) resetRunningFlags() {
	jobs, err := s.store.List()
	if err != nil {
		return
	}
	for _, j := range jobs {
		if j.Status.Running {
			j.Status.Running = false
			_ = s.store.Save(j)
		}
	}
}

func (s *Scheduler) tick(ctx context.Context) {
	jobs, err := s.store.List()
	if err != nil {
		s.logger.Warn("log.job.list_failed", "error", err)
		return
	}
	now := time.Now().UTC()
	for _, j := range jobs {
		if !j.Enabled {
			continue
		}
		if j.Status.NextRunAt == nil || j.Status.NextRunAt.After(now) {
			continue
		}
		go func(job *Job) {
			if err := s.execute(ctx, job, false); err != nil {
				s.logger.Warn("log.job.execute_failed", "job_id", job.ID, "error", err)
			}
		}(j)
	}
}

func (s *Scheduler) execute(ctx context.Context, j *Job, force bool) error {
	s.mu.Lock()
	if s.running[j.ID] {
		s.mu.Unlock()
		s.recordSkip(j, "already running")
		return nil
	}
	if s.active >= s.maxParallel {
		s.mu.Unlock()
		s.recordSkip(j, "max parallel jobs reached")
		return nil
	}
	s.running[j.ID] = true
	s.active++
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.running, j.ID)
		s.active--
		s.mu.Unlock()
	}()

	fresh, err := s.store.Load(j.ID)
	if err != nil {
		return err
	}
	j = fresh
	if !force && !j.Enabled {
		return nil
	}
	if j.Policy.MaxRuns > 0 && j.Status.RunCount >= j.Policy.MaxRuns {
		j.Enabled = false
		j.Status.NextRunAt = nil
		_ = s.store.Save(j)
		return nil
	}

	j.Status.Running = true
	_ = s.store.Save(j)

	started := time.Now().UTC()
	runCtx := ctx
	if j.Policy.Timeout.Std() > 0 {
		var cancel context.CancelFunc
		runCtx, cancel = context.WithTimeout(ctx, j.Policy.Timeout.Std())
		defer cancel()
	}

	req := RunRequest{
		Agent:   j.Agent,
		Prompt:  j.Prompt,
		WorkDir: j.WorkDir,
	}
	if j.SessionMode == SessionContinue && j.SessionID != "" {
		req.SessionID = j.SessionID
	}

	sessionID, runErr := s.runner(runCtx, req)
	ended := time.Now().UTC()

	rec := &RunRecord{
		ID:        NewRunID(),
		JobID:     j.ID,
		SessionID: sessionID,
		StartedAt: started,
		EndedAt:   ended,
	}
	if runErr != nil {
		rec.Status = "error"
		rec.Error = runErr.Error()
		j.Status.LastStatus = "error"
		j.Status.LastError = runErr.Error()
	} else {
		rec.Status = "ok"
		j.Status.LastStatus = "ok"
		j.Status.LastError = ""
	}
	_ = s.store.SaveRun(rec)

	j.Status.Running = false
	j.Status.LastRunAt = &ended
	j.Status.RunCount++
	if j.SessionMode == SessionContinue && sessionID != "" {
		j.SessionID = sessionID
	}

	next, err := NextRunAfter(j.Schedule, ended)
	if err != nil {
		s.logger.Warn("log.job.next_run_failed", "job_id", j.ID, "error", err)
	}
	if j.Schedule.Type == ScheduleOnce {
		j.Enabled = false
		j.Status.NextRunAt = nil
	} else if j.Policy.MaxRuns > 0 && j.Status.RunCount >= j.Policy.MaxRuns {
		j.Enabled = false
		j.Status.NextRunAt = nil
	} else {
		j.Status.NextRunAt = next
	}
	return s.store.Save(j)
}

func (s *Scheduler) recordSkip(j *Job, reason string) {
	now := time.Now().UTC()
	_ = s.store.SaveRun(&RunRecord{
		ID:        NewRunID(),
		JobID:     j.ID,
		Status:    "skipped",
		Error:     reason,
		StartedAt: now,
		EndedAt:   now,
	})
	if j.Schedule.Type == ScheduleInterval {
		fresh, err := s.store.Load(j.ID)
		if err != nil {
			return
		}
		next, err := NextRunAfter(fresh.Schedule, now)
		if err == nil {
			fresh.Status.NextRunAt = next
			fresh.Status.LastStatus = "skipped"
			_ = s.store.Save(fresh)
		}
	}
}
