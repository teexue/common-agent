package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/job"
	"github.com/teexue/common-agent/core/service"
)

func (s *Server) handleJobsList(c *gin.Context) {
	if s.svc.Jobs == nil {
		respondError(c, http.StatusServiceUnavailable, "job_error", "api.error.job_not_configured")
		return
	}
	jobs, err := s.svc.ListJobs()
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "job_error", "api.error.job_error", err.Error())
		return
	}
	if jobs == nil {
		jobs = []*job.Job{}
	}
	c.JSON(http.StatusOK, jobs)
}

func (s *Server) handleJobsGet(c *gin.Context) {
	if s.svc.Jobs == nil {
		respondError(c, http.StatusServiceUnavailable, "job_error", "api.error.job_not_configured")
		return
	}
	j, err := s.svc.GetJob(c.Param("id"))
	if err != nil {
		if errors.Is(err, job.ErrNotFound) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.job_not_found")
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "job_error", "api.error.job_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, j)
}

func (s *Server) handleJobsCreate(c *gin.Context) {
	if s.svc.Jobs == nil {
		respondError(c, http.StatusServiceUnavailable, "job_error", "api.error.job_not_configured")
		return
	}
	var req service.CreateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	j, err := s.svc.CreateJob(req)
	if err != nil {
		var arg *service.ArgError
		if errors.As(err, &arg) {
			respondErrorDetails(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request", err.Error())
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "job_error", "api.error.job_error", err.Error())
		return
	}
	c.JSON(http.StatusCreated, j)
}

func (s *Server) handleJobsUpdate(c *gin.Context) {
	if s.svc.Jobs == nil {
		respondError(c, http.StatusServiceUnavailable, "job_error", "api.error.job_not_configured")
		return
	}
	var req service.UpdateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	j, err := s.svc.UpdateJob(c.Param("id"), req)
	if err != nil {
		if errors.Is(err, job.ErrNotFound) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.job_not_found")
			return
		}
		var arg *service.ArgError
		if errors.As(err, &arg) {
			respondErrorDetails(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request", err.Error())
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "job_error", "api.error.job_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, j)
}

func (s *Server) handleJobsDelete(c *gin.Context) {
	if s.svc.Jobs == nil {
		respondError(c, http.StatusServiceUnavailable, "job_error", "api.error.job_not_configured")
		return
	}
	id := c.Param("id")
	if err := s.svc.DeleteJob(id); err != nil {
		if errors.Is(err, job.ErrNotFound) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.job_not_found")
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "job_error", "api.error.job_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

func (s *Server) handleJobsPause(c *gin.Context) {
	s.setJobEnabled(c, false)
}

func (s *Server) handleJobsResume(c *gin.Context) {
	s.setJobEnabled(c, true)
}

func (s *Server) setJobEnabled(c *gin.Context, enabled bool) {
	if s.svc.Jobs == nil {
		respondError(c, http.StatusServiceUnavailable, "job_error", "api.error.job_not_configured")
		return
	}
	j, err := s.svc.SetJobEnabled(c.Param("id"), enabled)
	if err != nil {
		if errors.Is(err, job.ErrNotFound) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.job_not_found")
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "job_error", "api.error.job_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, j)
}

func (s *Server) handleJobsRun(c *gin.Context) {
	if s.scheduler == nil {
		respondError(c, http.StatusServiceUnavailable, "job_error", "api.error.job_scheduler_unavailable")
		return
	}
	id := c.Param("id")
	if err := s.scheduler.TriggerNow(c.Request.Context(), id); err != nil {
		if errors.Is(err, job.ErrNotFound) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.job_not_found")
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "job_error", "api.error.job_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"triggered": id})
}

func (s *Server) handleJobsRuns(c *gin.Context) {
	if s.svc.Jobs == nil {
		respondError(c, http.StatusServiceUnavailable, "job_error", "api.error.job_not_configured")
		return
	}
	runs, err := s.svc.ListJobRuns(c.Param("id"), 50)
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "job_error", "api.error.job_error", err.Error())
		return
	}
	if runs == nil {
		runs = []*job.RunRecord{}
	}
	c.JSON(http.StatusOK, runs)
}
