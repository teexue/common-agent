import type {
  AgentClientOptions,
  AgentDetail,
  AgentEvent,
  AgentListItem,
  Message,
  RunOptions,
  SessionMeta,
  ToolInfo,
} from "./types.js"
import { readSSEStream } from "./sse.js"

/**
 * Client for interacting with a Common Agent server.
 *
 * @example
 * ```ts
 * import { AgentClient } from "@common-agent/sdk"
 *
 * const client = new AgentClient({ baseUrl: "http://localhost:8080" })
 *
 * // Stream events
 * for await (const event of client.run({ agent: "demo", prompt: "hello" })) {
 *   if (event.type === "text_delta") process.stdout.write(event.content)
 * }
 * ```
 */
export class AgentClient {
  private baseUrl: string
  private fetchFn: typeof globalThis.fetch

  constructor(options: AgentClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:8080").replace(/\/+$/, "")
    this.fetchFn = options.fetch ?? globalThis.fetch
  }

  /**
   * Run an agent and stream events via SSE.
   * Returns an AsyncGenerator that yields AgentEvents until a "done" event.
   */
  async *run(options: RunOptions): AsyncGenerator<AgentEvent> {
    const body: Record<string, unknown> = {
      agent: options.agent,
      prompt: options.prompt,
    }
    if (options.sessionId) body.session_id = options.sessionId
    if (options.messages?.length) body.messages = options.messages

    const res = await this.fetchFn(`${this.baseUrl}/v1/agents/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    })

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const errBody = await res.json()
        message = errBody.message ?? message
      } catch {
        // ignore parse error
      }
      throw new AgentError(message, res.status)
    }

    if (!res.body) {
      throw new AgentError("No response body", 0)
    }

    yield* readSSEStream(res.body, options.signal)
  }

  /**
   * Resolve a pending tool approval.
   */
  async approve(approvalId: string, approved: boolean): Promise<void> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/agents/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_id: approvalId, approved }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new AgentError(errBody?.message ?? `HTTP ${res.status}`, res.status)
    }
  }

  /**
   * List all registered tools.
   */
  async listTools(): Promise<ToolInfo[]> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/tools`)
    if (!res.ok) {
      throw new AgentError(`HTTP ${res.status}`, res.status)
    }
    return res.json() as Promise<ToolInfo[]>
  }

  /**
   * List all loaded agents.
   */
  async listAgents(): Promise<AgentListItem[]> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/agents`)
    if (!res.ok) {
      throw new AgentError(`HTTP ${res.status}`, res.status)
    }
    return res.json() as Promise<AgentListItem[]>
  }

  /**
   * Get details for a specific agent.
   */
  async getAgent(name: string): Promise<AgentDetail> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/agents/${encodeURIComponent(name)}`)
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new AgentError(errBody?.message ?? `HTTP ${res.status}`, res.status)
    }
    return res.json() as Promise<AgentDetail>
  }

  /**
   * List all persisted sessions.
   */
  async listSessions(): Promise<SessionMeta[]> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/sessions`)
    if (!res.ok) {
      throw new AgentError(`HTTP ${res.status}`, res.status)
    }
    return res.json() as Promise<SessionMeta[]>
  }

  /**
   * Get a specific session with its messages.
   */
  async getSession(id: string): Promise<SessionMeta & { messages: Message[] }> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/sessions/${encodeURIComponent(id)}`)
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new AgentError(errBody?.message ?? `HTTP ${res.status}`, res.status)
    }
    return res.json() as Promise<SessionMeta & { messages: Message[] }>
  }

  /**
   * Delete a persisted session.
   */
  async deleteSession(id: string): Promise<void> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new AgentError(errBody?.message ?? `HTTP ${res.status}`, res.status)
    }
  }
}

/**
 * Error thrown by AgentClient operations.
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "AgentError"
  }
}
