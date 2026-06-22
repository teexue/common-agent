# @common-agent/sdk

TypeScript SDK for the [Common Agent](https://github.com/teexue/common-agent) runtime.

## Install

```bash
npm install @common-agent/sdk
# or
pnpm add @common-agent/sdk
```

## Quick Start

```ts
import { AgentClient } from "@common-agent/sdk"

const client = new AgentClient({ baseUrl: "http://localhost:8080" })

// Stream agent events
for await (const event of client.run({ agent: "demo", prompt: "hello" })) {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.content ?? "")
      break
    case "tool_start":
      console.log(`\n🔧 Tool: ${event.tool}`)
      break
    case "tool_result":
      console.log(`  ✅ Result: ${JSON.stringify(event.output)}`)
      break
    case "error":
      console.error(`\n❌ Error: ${event.message}`)
      break
    case "done":
      console.log(`\n\nDone in ${event.turns} turns`)
      break
  }
}
```

## API

### `AgentClient`

```ts
const client = new AgentClient({
  baseUrl: "http://localhost:8080", // default
  fetch: customFetch,               // optional custom fetch
})
```

### `client.run(options)`

Execute an agent and stream events via SSE. Returns `AsyncGenerator<AgentEvent>`.

```ts
for await (const event of client.run({
  agent: "demo",
  prompt: "hello",
  sessionId: "existing-session-id",  // optional: resume session
  messages: [{ role: "user", content: "history" }],  // optional
  signal: abortController.signal,    // optional: cancellation
})) {
  // handle events
}
```

### `client.approve(approvalId, approved)`

Resolve a pending tool approval.

```ts
await client.approve("approval-id-123", true)  // approve
await client.approve("approval-id-123", false) // deny
```

### `client.listTools()`

List all registered tools.

### `client.listAgents()`

List all loaded agents.

### `client.getAgent(name)`

Get details for a specific agent.

### `client.listSessions()`

List all persisted sessions.

### `client.getSession(id)`

Get a session with its messages.

### `client.deleteSession(id)`

Delete a persisted session.

## Event Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `text_delta` | Streaming text chunk | `content` |
| `reasoning_delta` | Model reasoning chunk | `content` |
| `tool_start` | Tool execution started | `tool`, `input`, `tool_call_id` |
| `tool_result` | Tool execution completed | `tool`, `output`, `tool_call_id` |
| `tool_approval_required` | Tool needs approval | `tool`, `approval_id` |
| `error` | Error occurred | `code`, `message` |
| `done` | Run completed | `status`, `turns` |

## Error Handling

```ts
import { AgentClient, AgentError } from "@common-agent/sdk"

try {
  for await (const event of client.run({ agent: "demo", prompt: "hi" })) {
    // ...
  }
} catch (e) {
  if (e instanceof AgentError) {
    console.error(`Agent error (HTTP ${e.status}): ${e.message}`)
  }
}
```

## Cancellation

```ts
const controller = new AbortController()

// Start the run
const run = client.run({
  agent: "demo",
  prompt: "write a long essay",
  signal: controller.signal,
})

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000)

for await (const event of run) {
  // Will throw AbortError when cancelled
}
```

## License

MIT
