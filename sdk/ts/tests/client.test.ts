import { describe, it, expect } from "vitest"
import { AgentClient, AgentError } from "../src/client.js"
import type { AgentEvent } from "../src/types.js"

// Helper to create an SSE response from events.
function sseResponse(events: Record<string, unknown>[], status = 200): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
      }
      controller.close()
    },
  })
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  })
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ code: "error", message }, status)
}

// Create a mock fetch that records calls and returns configured responses.
function createMockFetch(responses: Map<string, Response>) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchFn = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString()
    calls.push({ url, init })
    const res = responses.get(url)
    if (res) return res
    return errorResponse("not found", 404)
  }
  return { fetchFn, calls }
}

describe("AgentClient", () => {
  describe("run", () => {
    it("streams events from SSE endpoint", async () => {
      const events: AgentEvent[] = [
        { type: "text_delta", content: "hello" },
        { type: "text_delta", content: " world" },
        { type: "done", status: "completed", turns: 1 },
      ]
      const { fetchFn, calls } = createMockFetch(
        new Map([["http://test.local/v1/agents/run", sseResponse(events)]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      const received: AgentEvent[] = []
      for await (const ev of client.run({ agent: "test", prompt: "hi" })) {
        received.push(ev)
      }

      expect(received).toHaveLength(3)
      expect(received[0]).toEqual({ type: "text_delta", content: "hello" })
      expect(received[1]).toEqual({ type: "text_delta", content: " world" })
      expect(received[2]).toEqual({ type: "done", status: "completed", turns: 1 })

      // Verify request was made correctly.
      expect(calls).toHaveLength(1)
      const body = JSON.parse(calls[0].init!.body as string)
      expect(body).toEqual({ agent: "test", prompt: "hi" })
    })

    it("throws AgentError on non-OK response", async () => {
      const { fetchFn } = createMockFetch(
        new Map([["http://test.local/v1/agents/run", errorResponse("agent not found", 400)]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      await expect(async () => {
        for await (const _ of client.run({ agent: "bad", prompt: "hi" })) {
          // consume
        }
      }).rejects.toThrow(AgentError)
    })

    it("sends session_id and messages in request body", async () => {
      const { fetchFn, calls } = createMockFetch(
        new Map([["http://test.local/v1/agents/run", sseResponse([{ type: "done", status: "completed" }])]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      for await (const _ of client.run({
        agent: "test",
        prompt: "hi",
        sessionId: "sess-123",
        messages: [{ role: "user", content: "prev" }],
      })) {
        // consume
      }

      const body = JSON.parse(calls[0].init!.body as string)
      expect(body).toEqual({
        agent: "test",
        prompt: "hi",
        session_id: "sess-123",
        messages: [{ role: "user", content: "prev" }],
      })
    })

    it("throws AgentError with status code", async () => {
      const { fetchFn } = createMockFetch(
        new Map([["http://test.local/v1/agents/run", errorResponse("server error", 500)]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      try {
        for await (const _ of client.run({ agent: "test", prompt: "hi" })) {
          // consume
        }
        expect.fail("should have thrown")
      } catch (e) {
        expect(e).toBeInstanceOf(AgentError)
        expect((e as AgentError).status).toBe(500)
        expect((e as AgentError).message).toBe("server error")
      }
    })
  })

  describe("approve", () => {
    it("sends approval request", async () => {
      const { fetchFn, calls } = createMockFetch(
        new Map([["http://test.local/v1/agents/approve", jsonResponse({ resolved: true })]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      await client.approve("ap-123", true)

      expect(calls).toHaveLength(1)
      const body = JSON.parse(calls[0].init!.body as string)
      expect(body).toEqual({ approval_id: "ap-123", approved: true })
    })

    it("throws on error response", async () => {
      const { fetchFn } = createMockFetch(
        new Map([["http://test.local/v1/agents/approve", errorResponse("no pending approval", 404)]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      await expect(client.approve("bad-id", true)).rejects.toThrow(AgentError)
    })
  })

  describe("listTools", () => {
    it("returns tool list", async () => {
      const tools = [
        { name: "echo", description: "Echo tool", parameters: {} },
        { name: "get_time", description: "Get time", parameters: {} },
      ]
      const { fetchFn } = createMockFetch(
        new Map([["http://test.local/v1/tools", jsonResponse(tools)]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      const result = await client.listTools()
      expect(result).toEqual(tools)
    })
  })

  describe("listAgents", () => {
    it("returns agent list", async () => {
      const agents = [
        { name: "demo", provider: "openai", model: "gpt-4o", tools: ["echo"], max_turns: 10 },
      ]
      const { fetchFn } = createMockFetch(
        new Map([["http://test.local/v1/agents", jsonResponse(agents)]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      const result = await client.listAgents()
      expect(result).toEqual(agents)
    })
  })

  describe("getAgent", () => {
    it("returns agent details", async () => {
      const detail = {
        name: "demo",
        provider: "openai",
        model: "gpt-4o",
        system_prompt: "You are helpful.",
        tools: ["echo"],
        max_turns: 10,
        max_tokens: 4096,
      }
      const { fetchFn } = createMockFetch(
        new Map([["http://test.local/v1/agents/demo", jsonResponse(detail)]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      const result = await client.getAgent("demo")
      expect(result).toEqual(detail)
    })

    it("throws on 404", async () => {
      const { fetchFn } = createMockFetch(new Map())
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      await expect(client.getAgent("missing")).rejects.toThrow(AgentError)
    })
  })

  describe("sessions", () => {
    it("lists sessions", async () => {
      const sessions = [
        { id: "s1", agent: "demo", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      ]
      const { fetchFn } = createMockFetch(
        new Map([["http://test.local/v1/sessions", jsonResponse(sessions)]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      const result = await client.listSessions()
      expect(result).toEqual(sessions)
    })

    it("gets a session", async () => {
      const session = {
        id: "s1",
        agent: "demo",
        messages: [{ role: "user", content: "hello" }],
      }
      const { fetchFn } = createMockFetch(
        new Map([["http://test.local/v1/sessions/s1", jsonResponse(session)]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      const result = await client.getSession("s1")
      expect(result).toEqual(session)
    })

    it("deletes a session", async () => {
      let deleted = false
      const { fetchFn, calls } = createMockFetch(
        new Map([["http://test.local/v1/sessions/s1", new Response(null, { status: 200 })]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local", fetch: fetchFn })

      await client.deleteSession("s1")
      expect(calls).toHaveLength(1)
      expect(calls[0].init!.method).toBe("DELETE")
    })
  })

  describe("constructor", () => {
    it("uses default baseUrl", () => {
      const client = new AgentClient()
      // Just verify it doesn't throw.
      expect(client).toBeDefined()
    })

    it("strips trailing slashes from baseUrl", async () => {
      const { fetchFn, calls } = createMockFetch(
        new Map([["http://test.local/v1/tools", jsonResponse([])]]),
      )
      const client = new AgentClient({ baseUrl: "http://test.local///", fetch: fetchFn })

      await client.listTools()
      expect(calls[0].url).toBe("http://test.local/v1/tools")
    })
  })
})
