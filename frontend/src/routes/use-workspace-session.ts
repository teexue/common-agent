import { useEffect, useRef } from "react"
import type { NavigateFunction } from "react-router"

interface SessionSyncOpts {
  sessionId: string | null
  resumeSession: (id: string) => Promise<{
    agent: string
    workdir: string | null
    model: string
    provider: string
  } | null>
  locationSearch: string
  locationPathname: string
  navigate: NavigateFunction
  onResumed: (r: {
    agent: string
    workdir: string | null
    model: string
    provider: string
  }) => void
}

/** Writes session id into the URL. Must not subscribe to location.search
 * or a resume that updates the URL would retrigger and loop. */
function useWriteSessionToUrl(
  sessionId: string | null,
  pathname: string,
  navigate: NavigateFunction,
  searchRef: React.MutableRefObject<string>
) {
  useEffect(() => {
    if (!sessionId) return
    const params = new URLSearchParams(searchRef.current)
    if (params.get("session") === sessionId) return
    params.set("session", sessionId)
    params.delete("resume")
    navigate(`${pathname}?${params.toString()}`, { replace: true })
  }, [sessionId, navigate, pathname, searchRef])
}

function useResumeFromSearch(opts: SessionSyncOpts) {
  const sessionIdRef = useRef(opts.sessionId)
  const resumeRef = useRef(opts.resumeSession)
  useEffect(() => {
    sessionIdRef.current = opts.sessionId
    resumeRef.current = opts.resumeSession
  })
  const { locationSearch, locationPathname, navigate, onResumed } = opts
  useEffect(() => {
    const params = new URLSearchParams(locationSearch)
    const id = params.get("session") || params.get("resume")
    if (!id) return
    if (sessionIdRef.current === id) {
      if (params.get("resume")) {
        params.set("session", id)
        params.delete("resume")
        navigate(`${locationPathname}?${params.toString()}`, { replace: true })
      }
      return
    }
    let cancelled = false
    void resumeRef.current(id).then((r) => {
      if (cancelled || !r) return
      onResumed(r)
      params.set("session", id)
      params.delete("resume")
      navigate(`${locationPathname}?${params.toString()}`, { replace: true })
    })
    return () => {
      cancelled = true
    }
  }, [locationSearch, locationPathname, navigate, onResumed])
}

/** Resume only when location.search changes; URL write ignores search. */
export function useWorkspaceSessionSync(opts: SessionSyncOpts) {
  const searchRef = useRef(opts.locationSearch)
  useEffect(() => {
    searchRef.current = opts.locationSearch
  })
  useWriteSessionToUrl(
    opts.sessionId,
    opts.locationPathname,
    opts.navigate,
    searchRef
  )
  useResumeFromSearch(opts)
}
