import { useCallback, type Dispatch, type MutableRefObject } from "react"
import { fetchSession } from "@/lib/api"
import { buildSendPrompt, imagesFromAttachments } from "@/lib/attachments"
import type { FileAttachment } from "@/types/agent"
import type { ChatAction } from "./use-chat-state"
import { fromBackendMessages } from "./use-chat-messages"
import type { BackendMsg } from "./use-chat-messages"
import { sendRunRequest } from "./chat-run"

type AbortRef = MutableRefObject<AbortController | null>
type SessionRef = MutableRefObject<string | null>

export interface SendMessageOpts {
  text: string
  agent: string
  workDir?: string
  attachments?: FileAttachment[]
  model?: string
  provider?: string
}

function cancelStream(
  dispatch: Dispatch<ChatAction>,
  abortRef: AbortRef
): void {
  abortRef.current?.abort()
  abortRef.current = null
  dispatch({
    type: "STREAM_DONE",
    entryId: "",
    status: "cancelled",
    turns: 0,
  })
}

export function useChatSend(
  dispatch: Dispatch<ChatAction>,
  abortRef: AbortRef,
  sessionIdRef: SessionRef
) {
  return useCallback(
    async (opts: SendMessageOpts) => {
      cancelStream(dispatch, abortRef)
      const controller = new AbortController()
      abortRef.current = controller
      dispatch({
        type: "ADD_USER_MESSAGE",
        text: opts.text,
        attachments: opts.attachments,
      })
      const entryId = `assistant-${Date.now()}`
      dispatch({ type: "START_ASSISTANT", entryId })
      try {
        await sendRunRequest({
          agent: opts.agent,
          prompt: buildSendPrompt(opts.text, opts.attachments ?? []),
          sessionId: sessionIdRef.current,
          workDir: opts.workDir,
          signal: controller.signal,
          entryId,
          dispatch,
          images: imagesFromAttachments(opts.attachments),
          model: opts.model,
          provider: opts.provider,
        })
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        dispatch({
          type: "STREAM_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
        })
      }
    },
    [dispatch, abortRef, sessionIdRef]
  )
}

export function useChatSessionOps(
  dispatch: Dispatch<ChatAction>,
  abortRef: AbortRef
) {
  const abort = useCallback(
    () => cancelStream(dispatch, abortRef),
    [dispatch, abortRef]
  )
  const clear = useCallback(() => {
    abort()
    dispatch({ type: "CLEAR" })
  }, [abort, dispatch])
  const loadSession = useCallback(
    async (
      sessionId: string,
      messages: BackendMsg[],
      metadata?: Record<string, string>
    ) => {
      abort()
      dispatch({
        type: "LOAD_SESSION",
        sessionId,
        messages: fromBackendMessages(messages),
        metadata,
      })
    },
    [abort, dispatch]
  )
  const resumeSession = useResumeSession(abort, loadSession)
  const setSessionId = useCallback(
    (sessionId: string | null) => {
      dispatch({ type: "SET_SESSION_ID", sessionId })
    },
    [dispatch]
  )
  return { abort, clear, loadSession, resumeSession, setSessionId }
}

function useResumeSession(
  abort: () => void,
  loadSession: (
    sessionId: string,
    messages: BackendMsg[],
    metadata?: Record<string, string>
  ) => Promise<void>
) {
  return useCallback(
    async (
      sessionId: string
    ): Promise<{
      agent: string
      workdir: string | null
      model: string
      provider: string
    } | null> => {
      abort()
      try {
        const sess = await fetchSession(sessionId)
        await loadSession(
          sessionId,
          sess.messages as BackendMsg[],
          sess.metadata
        )
        return {
          agent: sess.agent,
          workdir: sess.metadata?.workdir || null,
          model: sess.metadata?.model || "",
          provider: sess.metadata?.provider || "",
        }
      } catch (err) {
        console.error("Failed to resume session:", err)
        return null
      }
    },
    [abort, loadSession]
  )
}
