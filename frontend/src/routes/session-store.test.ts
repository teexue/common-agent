import { describe, expect, it } from "vitest"
import { applyRunningFlags } from "./session-store"
import type { SessionMeta } from "@/types/agent"

function sess(id: string, running?: boolean): SessionMeta {
  return {
    id,
    agent: "demo",
    created_at: "",
    updated_at: "",
    ...(running !== undefined ? { running } : {}),
  }
}

describe("applyRunningFlags", () => {
  it("clears stale running badges after a run ends", () => {
    const next = applyRunningFlags(
      [sess("s1", true), sess("s2", true)],
      new Set()
    )
    expect(next.map((s) => s.running)).toEqual([false, false])
  })

  it("marks only sessions that are still running", () => {
    const next = applyRunningFlags(
      [sess("s1"), sess("s2", true)],
      new Set(["s1"])
    )
    expect(next[0].running).toBe(true)
    expect(next[1].running).toBe(false)
  })
})
