package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/teexue/common-agent/core/job"
	"github.com/teexue/common-agent/core/tool"
)

// CreateJob is a built-in tool that creates a persistent scheduled job
// from a chat conversation (e.g. "check X every morning at 9am").
type CreateJob struct {
	// Store persists the created job; nil means jobs are unavailable.
	Store job.Store
}

// createJobArgs is the decoded input for create_job.
type createJobArgs struct {
	Name         string `json:"name"`
	Agent        string `json:"agent"`
	Prompt       string `json:"prompt"`
	ScheduleType string `json:"schedule_type"`
	Interval     string `json:"interval"`
	Cron         string `json:"cron"`
	At           string `json:"at"`
	SessionMode  string `json:"session_mode"`
	WorkDir      string `json:"workdir"`
}

// Name returns the tool name.
func (c CreateJob) Name() string { return "create_job" }

// Description returns a human-readable description.
func (c CreateJob) Description() string {
	return "Create a scheduled or one-time job that runs an agent with a prompt. " +
		"Before calling this tool, show the parsed parameters to the user in human language " +
		"(e.g. the schedule in words) and get explicit confirmation. " +
		"The agent parameter must explicitly name the agent used in the current conversation."
}

// InputSchema returns the JSON Schema for the tool's input.
func (c CreateJob) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"name": map[string]any{
				"type":        "string",
				"description": "Name of the job",
			},
			"agent": map[string]any{
				"type":        "string",
				"description": "Name of the agent that executes the job",
			},
			"prompt": map[string]any{
				"type":        "string",
				"description": "Prompt executed on each run",
			},
			"schedule_type": map[string]any{
				"type":        "string",
				"enum":        []string{"once", "interval", "cron"},
				"description": "How the job is scheduled",
			},
			"interval": map[string]any{
				"type":        "string",
				"description": "Interval between runs (required when schedule_type=interval), e.g. \"30m\", \"2h\"",
			},
			"cron": map[string]any{
				"type":        "string",
				"description": "Standard 5-field cron expression (required when schedule_type=cron), e.g. \"0 9 * * *\"",
			},
			"at": map[string]any{
				"type":        "string",
				"description": "RFC3339 timestamp (required when schedule_type=once), e.g. \"2026-07-24T09:00:00+08:00\"",
			},
			"session_mode": map[string]any{
				"type":        "string",
				"enum":        []string{"continue", "new_each_run"},
				"description": "Whether runs reuse a session (optional, default new_each_run)",
			},
			"workdir": map[string]any{
				"type":        "string",
				"description": "Working directory for job runs (optional)",
			},
		},
		"required": []string{"name", "agent", "prompt", "schedule_type"},
	}
}

// Execute runs the tool.
func (c CreateJob) Execute(_ context.Context, input json.RawMessage) (tool.Result, error) {
	if c.Store == nil {
		return tool.Result{}, fmt.Errorf("job store not configured")
	}
	var args createJobArgs
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse create_job input: %w", err)
	}

	schedule, err := buildSchedule(args)
	if err != nil {
		return tool.Result{}, err
	}
	now := time.Now().UTC()
	j := &job.Job{
		ID:          job.NewID(),
		Name:        args.Name,
		Enabled:     true,
		Agent:       args.Agent,
		Prompt:      args.Prompt,
		WorkDir:     args.WorkDir,
		Schedule:    schedule,
		SessionMode: job.SessionMode(args.SessionMode),
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := j.Validate(); err != nil {
		return tool.Result{}, fmt.Errorf("validate job: %w", err)
	}
	next, err := job.ComputeInitialNextRun(j.Schedule, now)
	if err != nil {
		return tool.Result{}, fmt.Errorf("compute next run: %w", err)
	}
	j.Status.NextRunAt = next
	if err := c.Store.Save(j); err != nil {
		return tool.Result{}, fmt.Errorf("save job: %w", err)
	}

	out, err := json.Marshal(map[string]any{
		"id":               j.ID,
		"name":             j.Name,
		"agent":            j.Agent,
		"next_run_at":      formatTimePtr(j.Status.NextRunAt),
		"schedule_summary": scheduleSummary(j.Schedule),
	})
	if err != nil {
		return tool.Result{}, fmt.Errorf("marshal result: %w", err)
	}
	return tool.Result{Output: out}, nil
}

// buildSchedule assembles a job.Schedule from the tool arguments.
func buildSchedule(args createJobArgs) (job.Schedule, error) {
	s := job.Schedule{Type: job.ScheduleType(args.ScheduleType)}
	switch s.Type {
	case job.ScheduleInterval:
		if args.Interval == "" {
			return s, fmt.Errorf("interval is required for interval schedule")
		}
		d, err := time.ParseDuration(args.Interval)
		if err != nil {
			return s, fmt.Errorf("parse interval %q: %w", args.Interval, err)
		}
		s.Interval = job.Duration(d)
	case job.ScheduleCron:
		s.Cron = args.Cron
	case job.ScheduleOnce:
		if args.At == "" {
			return s, fmt.Errorf("at is required for once schedule")
		}
		at, err := time.Parse(time.RFC3339, args.At)
		if err != nil {
			return s, fmt.Errorf("parse at %q: %w", args.At, err)
		}
		s.At = &at
	case "":
		return s, fmt.Errorf("schedule_type is required")
	default:
		return s, fmt.Errorf("invalid schedule_type %q", args.ScheduleType)
	}
	return s, nil
}

// scheduleSummary returns a human-readable summary of the schedule.
func scheduleSummary(s job.Schedule) string {
	switch s.Type {
	case job.ScheduleInterval:
		return fmt.Sprintf("every %s", s.Interval.Std())
	case job.ScheduleCron:
		return fmt.Sprintf("cron: %s", s.Cron)
	case job.ScheduleOnce:
		if s.At != nil {
			return fmt.Sprintf("once at %s", s.At.Format(time.RFC3339))
		}
	}
	return string(s.Type)
}

// formatTimePtr formats a time pointer as RFC3339, empty when nil.
func formatTimePtr(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(time.RFC3339)
}
