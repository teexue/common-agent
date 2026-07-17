package job_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/job"
)

func TestNextRunAfterCron(t *testing.T) {
	from := time.Date(2026, 7, 17, 8, 0, 0, 0, time.UTC)
	next, err := job.NextRunAfter(job.Schedule{Type: job.ScheduleCron, Cron: "0 9 * * *"}, from)
	require.NoError(t, err)
	require.NotNil(t, next)
	assert.Equal(t, 9, next.Hour())
	assert.Equal(t, 17, next.Day())
}

func TestNextRunAfterInterval(t *testing.T) {
	from := time.Date(2026, 7, 17, 8, 0, 0, 0, time.UTC)
	next, err := job.NextRunAfter(job.Schedule{Type: job.ScheduleInterval, Interval: job.Duration(5 * time.Minute)}, from)
	require.NoError(t, err)
	require.NotNil(t, next)
	assert.Equal(t, from.Add(5*time.Minute), *next)
}

func TestNextRunAfterOncePast(t *testing.T) {
	at := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	next, err := job.NextRunAfter(job.Schedule{Type: job.ScheduleOnce, At: &at}, time.Now().UTC())
	require.NoError(t, err)
	assert.Nil(t, next)
}

func TestComputeInitialNextRunIntervalIsNow(t *testing.T) {
	now := time.Now().UTC()
	next, err := job.ComputeInitialNextRun(job.Schedule{Type: job.ScheduleInterval, Interval: job.Duration(time.Minute)}, now)
	require.NoError(t, err)
	require.NotNil(t, next)
	assert.WithinDuration(t, now, *next, time.Second)
}

func TestJobValidate(t *testing.T) {
	j := &job.Job{Name: "x", Agent: "a", Prompt: "p", Schedule: job.Schedule{Type: job.ScheduleInterval, Interval: job.Duration(time.Minute)}}
	require.NoError(t, j.Validate())
	assert.Equal(t, job.SessionNewEachRun, j.SessionMode)
	assert.Equal(t, job.OverlapSkip, j.Policy.Overlap)
}

func TestFileStoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	store, err := job.NewFileStore(dir)
	require.NoError(t, err)

	now := time.Now().UTC()
	j := &job.Job{
		ID:      job.NewID(),
		Name:    "daily",
		Enabled: true,
		Agent:   "coder",
		Prompt:  "report",
		Schedule: job.Schedule{
			Type:     job.ScheduleInterval,
			Interval: job.Duration(10 * time.Minute),
		},
		SessionMode: job.SessionContinue,
		Policy:      job.Policy{Overlap: job.OverlapSkip, Timeout: job.Duration(5 * time.Minute)},
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	require.NoError(t, j.Validate())
	next, err := job.ComputeInitialNextRun(j.Schedule, now)
	require.NoError(t, err)
	j.Status.NextRunAt = next
	require.NoError(t, store.Save(j))

	loaded, err := store.Load(j.ID)
	require.NoError(t, err)
	assert.Equal(t, "daily", loaded.Name)
	assert.Equal(t, job.Duration(10*time.Minute), loaded.Schedule.Interval)
	assert.Equal(t, job.SessionContinue, loaded.SessionMode)

	list, err := store.List()
	require.NoError(t, err)
	require.Len(t, list, 1)

	rec := &job.RunRecord{
		ID:        job.NewRunID(),
		JobID:     j.ID,
		Status:    "ok",
		SessionID: "sess_1",
		StartedAt: now,
		EndedAt:   now.Add(time.Second),
	}
	require.NoError(t, store.SaveRun(rec))
	runs, err := store.ListRuns(j.ID, 10)
	require.NoError(t, err)
	require.Len(t, runs, 1)
	assert.Equal(t, "ok", runs[0].Status)

	require.NoError(t, store.Delete(j.ID))
	_, err = store.Load(j.ID)
	assert.ErrorIs(t, err, job.ErrNotFound)
}

func TestDurationJSON(t *testing.T) {
	d := job.Duration(5 * time.Minute)
	b, err := d.MarshalJSON()
	require.NoError(t, err)
	assert.Equal(t, `"5m0s"`, string(b))

	var out job.Duration
	require.NoError(t, out.UnmarshalJSON([]byte(`"10m"`)))
	assert.Equal(t, 10*time.Minute, out.Std())
}
