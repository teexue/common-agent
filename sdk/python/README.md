# common-agent-sdk

Python SDK for the [Common Agent](https://github.com/teexue/common-agent) runtime.

## Install

```bash
pip install common-agent-sdk
```

## Quick Start

```python
import asyncio
from common_agent_sdk import AgentClient, EventType

async def main():
    async with AgentClient("http://localhost:8080") as client:
        async for event in client.run(agent="demo", prompt="hello"):
            if event.type == EventType.TEXT_DELTA:
                print(event.content, end="")
            elif event.type == EventType.DONE:
                print(f"\n\nDone in {event.turns} turns")

asyncio.run(main())
```

## API

### `AgentClient`

```python
client = AgentClient(
    base_url="http://localhost:8080",  # default
    http_client=custom_httpx_client,   # optional
)

# Or use as context manager
async with AgentClient("http://localhost:8080") as client:
    ...
```

### `client.run(agent, prompt, ...)`

Execute an agent and stream events via SSE. Returns an `AsyncIterator[AgentEvent]`.

```python
async for event in client.run(
    agent="demo",
    prompt="hello",
    session_id="existing-session-id",  # optional
    messages=[Message(role="user", content="history")],  # optional
):
    # handle events
    pass
```

### `client.approve(approval_id, approved)`

Resolve a pending tool approval.

### `client.list_tools()`

List all registered tools. Returns `list[ToolInfo]`.

### `client.list_agents()`

List all loaded agents. Returns `list[AgentListItem]`.

### `client.get_agent(name)`

Get details for a specific agent. Returns `AgentDetail`.

### `client.list_sessions()`

List all persisted sessions. Returns `list[SessionMeta]`.

### `client.get_session(session_id)`

Get a session with its messages.

### `client.delete_session(session_id)`

Delete a persisted session.

## Event Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `TEXT_DELTA` | Streaming text chunk | `content` |
| `REASONING_DELTA` | Model reasoning chunk | `content` |
| `TOOL_START` | Tool execution started | `tool`, `input`, `tool_call_id` |
| `TOOL_RESULT` | Tool execution completed | `tool`, `output`, `tool_call_id` |
| `TOOL_APPROVAL_REQUIRED` | Tool needs approval | `tool`, `approval_id` |
| `COMPACTION` | Context compacted | `content` |
| `SUB_AGENT_START` | Sub-agent started | `tool`, `content` |
| `SUB_AGENT_END` | Sub-agent completed | `tool`, `content` |
| `ERROR` | Error occurred | `code`, `message` |
| `DONE` | Run completed | `status`, `turns` |

## Error Handling

```python
from common_agent_sdk import AgentClient, AgentError

try:
    async with AgentClient() as client:
        async for event in client.run(agent="demo", prompt="hi"):
            pass
except AgentError as e:
    print(f"Agent error (HTTP {e.status}): {e}")
```

## License

MIT
