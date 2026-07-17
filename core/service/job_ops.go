package service

import (
	"fmt"
	"time"

	"github.com/teexue/common-agent/core/job"
)

// CreateJobRequest is the DTO for creating a job.
type CreateJobRequest struct {
	Name        string          `json:"name"`
	Agent       string          `json:"agent"`
	Prompt      string          `json:"prompt"`
	WorkDir     string          `json:"workdir,omitempty"`
	Schedule    job.Schedule    `json:"schedule"`
	SessionMode job.SessionMode `json:"session_mode,omitempty"`
	Policy      job.Policy      `json:"policy"`
	Enabled     *bool           `json:"enabled,omitempty"`
}

// UpdateJobRequest is the DTO for updating a job.
type UpdateJobRequest struct {
	Name        *string          `json:"name,omitempty"`
	Agent       *string          `json:"agent,omitempty"`
	Prompt      *string          `json:"prompt,omitempty"`
	WorkDir     *string          `json:"workdir,omitempty"`
	Schedule    *job.Schedule    `json:"schedule,omitempty"`
	SessionMode *job.SessionMode `json:"session_mode,omitempty"`
	Policy      *job.Policy      `json:"policy,omitempty"`
	Enabled     *bool            `json:"enabled,omitempty"`
}

// JobStore returns the job store (may be nil).
func (s *Service) JobStore() job.Store {
	return s.Jobs
}

// ListJobs returns all jobs.
func (s *Service) ListJobs() ([]*job.Job, error) {
	if s.Jobs == nil {
		return nil, fmt.Errorf("job store not configured")
	}
	return s.Jobs.List()
}

// GetJob loads a job by id.
func (s *Service) GetJob(id string) (*job.Job, error) {
	if s.Jobs == nil {
		return nil, fmt.Errorf("job store not configured")
	}
	return s.Jobs.Load(id)
}

// CreateJob validates and persists a new job.
func (s *Service) CreateJob(req CreateJobRequest) (*job.Job, error) {
	if s.Jobs == nil {
		return nil, fmt.Errorf("job store not configured")
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	now := time.Now().UTC()
	j := &job.Job{
		ID:          job.NewID(),
		Name:        req.Name,
		Enabled:     enabled,
		Agent:       req.Agent,
		Prompt:      req.Prompt,
		WorkDir:     req.WorkDir,
		Schedule:    req.Schedule,
		SessionMode: req.SessionMode,
		Policy:      req.Policy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := j.Validate(); err != nil {
		return nil, &ArgError{Field: "job", Message: err.Error()}
	}
	next, err := job.ComputeInitialNextRun(j.Schedule, now)
	if err != nil {
		return nil, &ArgError{Field: "schedule", Message: err.Error()}
	}
	j.Status.NextRunAt = next
	if err := s.Jobs.Save(j); err != nil {
		return nil, err
	}
	return j, nil
}

// UpdateJob applies partial updates.
func (s *Service) UpdateJob(id string, req UpdateJobRequest) (*job.Job, error) {
	if s.Jobs == nil {
		return nil, fmt.Errorf("job store not configured")
	}
	j, err := s.Jobs.Load(id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		j.Name = *req.Name
	}
	if req.Agent != nil {
		j.Agent = *req.Agent
	}
	if req.Prompt != nil {
		j.Prompt = *req.Prompt
	}
	if req.WorkDir != nil {
		j.WorkDir = *req.WorkDir
	}
	if req.Schedule != nil {
		j.Schedule = *req.Schedule
		next, err := job.ComputeInitialNextRun(j.Schedule, time.Now().UTC())
		if err != nil {
			return nil, &ArgError{Field: "schedule", Message: err.Error()}
		}
		j.Status.NextRunAt = next
	}
	if req.SessionMode != nil {
		j.SessionMode = *req.SessionMode
	}
	if req.Policy != nil {
		j.Policy = *req.Policy
	}
	if req.Enabled != nil {
		j.Enabled = *req.Enabled
	}
	if err := j.Validate(); err != nil {
		return nil, &ArgError{Field: "job", Message: err.Error()}
	}
	if err := s.Jobs.Save(j); err != nil {
		return nil, err
	}
	return j, nil
}

// DeleteJob removes a job.
func (s *Service) DeleteJob(id string) error {
	if s.Jobs == nil {
		return fmt.Errorf("job store not configured")
	}
	return s.Jobs.Delete(id)
}

// ListJobRuns returns recent runs for a job.
func (s *Service) ListJobRuns(id string, limit int) ([]*job.RunRecord, error) {
	if s.Jobs == nil {
		return nil, fmt.Errorf("job store not configured")
	}
	if limit <= 0 {
		limit = 50
	}
	return s.Jobs.ListRuns(id, limit)
}

// SetJobEnabled pauses or resumes a job.
func (s *Service) SetJobEnabled(id string, enabled bool) (*job.Job, error) {
	if s.Jobs == nil {
		return nil, fmt.Errorf("job store not configured")
	}
	j, err := s.Jobs.Load(id)
	if err != nil {
		return nil, err
	}
	j.Enabled = enabled
	if enabled && j.Status.NextRunAt == nil {
		next, err := job.ComputeInitialNextRun(j.Schedule, time.Now().UTC())
		if err != nil {
			return nil, err
		}
		j.Status.NextRunAt = next
	}
	if err := s.Jobs.Save(j); err != nil {
		return nil, err
	}
	return j, nil
}
