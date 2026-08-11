import { useMemo } from "react"

export const SECTIONS = [
  "overview",
  "auth",
  "run",
  "events",
  "approve",
  "session",
  "errors",
] as const

export type SectionId = (typeof SECTIONS)[number]

export function useBaseURL() {
  return useMemo(() => {
    if (typeof window === "undefined") return "http://localhost:8080"
    return window.location.origin
  }, [])
}
