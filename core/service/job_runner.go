package service

import (
	"context"
	"fmt"

	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/job"
	"github.com/teexue/common-agent/core/loop"
)

// JobRunner returns a job.Runner that executes via PrepareRun + loop.Run.
func (s *Service) JobRunner() job.Runner {
	return func(ctx context.Context, req job.RunRequest) (string, error) {
		result, err := s.PrepareRun(ctx, RunRequest{
			Agent:     req.Agent,
			Prompt:    req.Prompt,
			WorkDir:   req.WorkDir,
			SessionID: req.SessionID,
		}, nil)
		if err != nil {
			return "", err
		}
		defer func() {
			result.Cleanup(s.Registry)
		}()

		events, err := loop.Run(ctx, result.Config)
		if err != nil {
			return result.Session.ID, err
		}
		var runErr error
		for ev := range events {
			if ev.Type == event.TypeError {
				msg := ev.Message
				if msg == "" {
					msg = ev.Content
				}
				if msg != "" {
					runErr = fmt.Errorf("%s", msg)
				}
			}
		}
		return result.Session.ID, runErr
	}
}
