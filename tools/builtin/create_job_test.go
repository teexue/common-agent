package builtin_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/job"
	"github.com/teexue/common-agent/tools/builtin"
)

func newCreateJobStore(t *testing.T) job.Store {
	t.Helper()
	store, err := job.NewFileStore(t.TempDir())
	require.NoError(t, err)
	return store
}

func executeCreateJob(t *testing.T, tool builtin.CreateJob, args map[string]any) map[string]any {
	t.Helper()
	input, err := json.Marshal(args)
	require.NoError(t, err)
	res, err := tool.Execute(context.Background(), input)
	require.NoError(t, err)
	var out map[string]any
	require.NoError(t, json.Unmarshal(res.Output, &out))
	return out
}

func TestCreateJob(t *testing.T) {
	futureAt := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)

	tests := []struct {
		name        string
		args        map[string]any
		wantSummary string
		checkSched  func(t *testing.T, s job.Schedule)
	}{
		{
			name: "interval",
			args: map[string]any{
				"name":          "check-interval",
				"agent":         "chat-assistant",
				"prompt":        "check X",
				"schedule_type": "interval",
				"interval":      "30m",
			},
			wantSummary: "every 30m0s",
			checkSched: func(t *testing.T, s job.Schedule) {
				assert.Equal(t, job.ScheduleInterval, s.Type)
				assert.Equal(t, 30*time.Minute, s.Interval.Std())
			},
		},
		{
			name: "cron",
			args: map[string]any{
				"name":          "check-cron",
				"agent":         "chat-assistant",
				"prompt":        "check X",
				"schedule_type": "cron",
				"cron":          "0 9 * * *",
			},
			wantSummary: "cron: 0 9 * * *",
			checkSched: func(t *testing.T, s job.Schedule) {
				assert.Equal(t, job.ScheduleCron, s.Type)
				assert.Equal(t, "0 9 * * *", s.Cron)
			},
		},
		{
			name: "once",
			args: map[string]any{
				"name":          "check-once",
				"agent":         "chat-assistant",
				"prompt":        "check X",
				"schedule_type": "once",
				"at":            futureAt,
			},
			wantSummary: "once at " + futureAt,
			checkSched: func(t *testing.T, s job.Schedule) {
				assert.Equal(t, job.ScheduleOnce, s.Type)
				require.NotNil(t, s.At)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newCreateJobStore(t)
			tool := builtin.CreateJob{Store: store}

			out := executeCreateJob(t, tool, tt.args)

			id, ok := out["id"].(string)
			require.True(t, ok, "output missing id")
			assert.NotEmpty(t, id)
			assert.Equal(t, tt.args["name"], out["name"])
			assert.Equal(t, tt.args["agent"], out["agent"])
			assert.NotEmpty(t, out["next_run_at"], "output missing next_run_at")
			assert.Equal(t, tt.wantSummary, out["schedule_summary"])

			loaded, err := store.Load(id)
			require.NoError(t, err)
			assert.Equal(t, tt.args["name"], loaded.Name)
			assert.Equal(t, tt.args["agent"], loaded.Agent)
			assert.Equal(t, tt.args["prompt"], loaded.Prompt)
			assert.True(t, loaded.Enabled)
			assert.Equal(t, job.SessionNewEachRun, loaded.SessionMode)
			require.NotNil(t, loaded.Status.NextRunAt)
			tt.checkSched(t, loaded.Schedule)
		})
	}
}

func TestCreateJobSessionMode(t *testing.T) {
	store := newCreateJobStore(t)
	tool := builtin.CreateJob{Store: store}

	out := executeCreateJob(t, tool, map[string]any{
		"name":          "continue-session",
		"agent":         "chat-assistant",
		"prompt":        "check X",
		"schedule_type": "interval",
		"interval":      "1h",
		"session_mode":  "continue",
	})

	loaded, err := store.Load(out["id"].(string))
	require.NoError(t, err)
	assert.Equal(t, job.SessionContinue, loaded.SessionMode)
}

func TestCreateJobErrors(t *testing.T) {
	base := map[string]any{
		"name":          "job",
		"agent":         "chat-assistant",
		"prompt":        "check X",
		"schedule_type": "interval",
		"interval":      "30m",
	}
	withArgs := func(mutate func(m map[string]any)) map[string]any {
		m := make(map[string]any, len(base))
		for k, v := range base {
			m[k] = v
		}
		mutate(m)
		return m
	}

	tests := []struct {
		name string
		args map[string]any
	}{
		{"missing name", withArgs(func(m map[string]any) { delete(m, "name") })},
		{"missing agent", withArgs(func(m map[string]any) { delete(m, "agent") })},
		{"missing prompt", withArgs(func(m map[string]any) { delete(m, "prompt") })},
		{"interval missing interval", withArgs(func(m map[string]any) { delete(m, "interval") })},
		{"invalid interval", withArgs(func(m map[string]any) { m["interval"] = "abc" })},
		{"invalid cron", withArgs(func(m map[string]any) {
			m["schedule_type"] = "cron"
			m["cron"] = "not a cron"
			delete(m, "interval")
		})},
		{"once missing at", withArgs(func(m map[string]any) {
			m["schedule_type"] = "once"
			delete(m, "interval")
		})},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tool := builtin.CreateJob{Store: newCreateJobStore(t)}
			input, err := json.Marshal(tt.args)
			require.NoError(t, err)
			_, err = tool.Execute(context.Background(), input)
			require.Error(t, err)
		})
	}
}

func TestCreateJobNilStore(t *testing.T) {
	var tool builtin.CreateJob
	input, _ := json.Marshal(map[string]any{
		"name":          "job",
		"agent":         "chat-assistant",
		"prompt":        "check X",
		"schedule_type": "interval",
		"interval":      "30m",
	})
	_, err := tool.Execute(context.Background(), input)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "job store not configured")
}
