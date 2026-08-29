import i18n from "@/i18n"
import type { RequestLogRecord, UsageSummary } from "@/types/agent"

import { ensureOK, langHeaders } from "./client"

/** Resolves a pending tool approval request. */
export async function resolveApproval(
  approvalId: string,
  approved: Promise<boolean> | boolean
): Promise<void> {
  const res = await fetch("/v1/agents/approve", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      approval_id: approvalId,
      approved: await approved,
    }),
  })
  if (!res.ok) {
    throw new Error(i18n.t("api.resolveApprovalFailed", { status: res.status }))
  }
}

/** Fetches recent LLM request audit records, newest first. List responses
 * carry only summaries; fetch full request/response payloads via
 * fetchRequestLogDetail. */
export async function fetchRequestLogs(params: {
  sessionId?: string
  source?: string
  limit?: number
}): Promise<RequestLogRecord[]> {
  const qs = new URLSearchParams()
  if (params.sessionId) qs.set("session_id", params.sessionId)
  if (params.source) qs.set("source", params.source)
  if (params.limit) qs.set("limit", String(params.limit))
  const res = await fetch(`/v1/audit/requests?${qs.toString()}`, {
    headers: langHeaders(),
  })
  await ensureOK(res, "api.fetchRequestLogsFailed")
  return (await res.json()) ?? []
}

/** Fetches the full detail (request/response payloads) of one audited LLM
 * request, identified by its timestamp string and optional session id. */
export async function fetchRequestLogDetail(
  ts: string,
  sessionId?: string
): Promise<RequestLogRecord> {
  const qs = new URLSearchParams({ ts })
  if (sessionId) qs.set("session_id", sessionId)
  const res = await fetch(`/v1/audit/requests/detail?${qs.toString()}`, {
    headers: langHeaders(),
  })
  await ensureOK(res, "api.fetchRequestLogDetailFailed")
  return res.json()
}

/** Fetches the aggregated token usage report built from the request logs.
 * `days` limits the lookback window (0/undefined = all), `all` lets admins
 * aggregate across every user. */
export async function fetchUsageSummary(params?: {
  days?: number
  all?: boolean
}): Promise<UsageSummary> {
  const qs = new URLSearchParams()
  if (params?.days) qs.set("days", String(params.days))
  if (params?.all) qs.set("all", "1")
  const suffix = qs.size > 0 ? `?${qs.toString()}` : ""
  const res = await fetch(`/v1/usage/summary${suffix}`, {
    headers: langHeaders(),
  })
  await ensureOK(res, "api.fetchUsageSummaryFailed")
  return res.json()
}
