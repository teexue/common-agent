package job

import (
	"fmt"
	"time"

	"github.com/robfig/cron/v3"
)

var cronParser = cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor)

func parseCron(expr string) (cron.Schedule, error) {
	return cronParser.Parse(expr)
}

// NextRunAfter returns the next run time after `from` for the given schedule.
// For once schedules that are already past, it returns nil (no more runs).
func NextRunAfter(s Schedule, from time.Time) (*time.Time, error) {
	if err := s.Validate(); err != nil {
		return nil, err
	}
	switch s.Type {
	case ScheduleCron:
		sched, err := parseCron(s.Cron)
		if err != nil {
			return nil, fmt.Errorf("parse cron: %w", err)
		}
		next := sched.Next(from)
		return &next, nil
	case ScheduleInterval:
		next := from.Add(s.Interval.Std())
		return &next, nil
	case ScheduleOnce:
		if s.At == nil {
			return nil, fmt.Errorf("at is required")
		}
		if !s.At.After(from) {
			return nil, nil
		}
		at := s.At.UTC()
		return &at, nil
	default:
		return nil, fmt.Errorf("invalid schedule type %q", s.Type)
	}
}

// ComputeInitialNextRun sets the first next_run_at from now.
func ComputeInitialNextRun(s Schedule, now time.Time) (*time.Time, error) {
	switch s.Type {
	case ScheduleOnce:
		if s.At == nil {
			return nil, fmt.Errorf("at is required")
		}
		at := s.At.UTC()
		return &at, nil
	case ScheduleInterval:
		// First run is immediate (or very soon) so loops start quickly.
		next := now
		return &next, nil
	case ScheduleCron:
		return NextRunAfter(s, now)
	default:
		return NextRunAfter(s, now)
	}
}
