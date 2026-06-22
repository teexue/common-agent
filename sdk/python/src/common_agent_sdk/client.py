"""AgentClient — async HTTP client for the Common Agent runtime."""

from __future__ import annotations

from typing import Any, AsyncIterator, Optional

import httpx

from .sse import read_sse_stream
from .types import (
    AgentDetail,
    AgentEvent,
    AgentListItem,
    Message,
    RunOptions,
    SessionMeta,
    ToolInfo,
)


class AgentError(Exception):
    """Error returned by the Agent API."""

    def __init__(self, message: str, status: int = 0) -> None:
        super().__init__(message)
        self.status = status


class AgentClient:
    """Async client for interacting with a Common Agent server.

    Example::

        async with AgentClient("http://localhost:8080") as client:
            async for event in client.run(agent="demo", prompt="hello"):
                if event.type == EventType.TEXT_DELTA:
                    print(event.content, end="")
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = http_client
        self._owns_client = http_client is None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(120.0))
            self._owns_client = True
        return self._client

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> AgentClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

    async def run(
        self,
        agent: str,
        prompt: str,
        *,
        session_id: Optional[str] = None,
        messages: Optional[list[Message]] = None,
    ) -> AsyncIterator[AgentEvent]:
        """Run an agent and stream events via SSE.

        Yields AgentEvent objects until a 'done' event.
        """
        client = await self._get_client()

        body: dict[str, Any] = {"agent": agent, "prompt": prompt}
        if session_id:
            body["session_id"] = session_id
        if messages:
            body["messages"] = [m.model_dump() for m in messages]

        async with client.stream(
            "POST",
            f"{self.base_url}/v1/agents/run",
            json=body,
            headers={"Accept": "text/event-stream"},
        ) as response:
            if response.status_code != 200:
                error_body = await response.aread()
                try:
                    import json

                    err = json.loads(error_body)
                    msg = err.get("message", f"HTTP {response.status_code}")
                except Exception:
                    msg = f"HTTP {response.status_code}"
                raise AgentError(msg, response.status_code)

            async for event in read_sse_stream(response):
                yield event

    async def approve(self, approval_id: str, approved: bool) -> None:
        """Resolve a pending tool approval."""
        client = await self._get_client()
        resp = await client.post(
            f"{self.base_url}/v1/agents/approve",
            json={"approval_id": approval_id, "approved": approved},
        )
        if resp.status_code != 200:
            self._raise_error(resp)

    async def list_tools(self) -> list[ToolInfo]:
        """List all registered tools."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v1/tools")
        if resp.status_code != 200:
            self._raise_error(resp)
        return [ToolInfo(**t) for t in resp.json()]

    async def list_agents(self) -> list[AgentListItem]:
        """List all loaded agents."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v1/agents")
        if resp.status_code != 200:
            self._raise_error(resp)
        return [AgentListItem(**a) for a in resp.json()]

    async def get_agent(self, name: str) -> AgentDetail:
        """Get details for a specific agent."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v1/agents/{name}")
        if resp.status_code != 200:
            self._raise_error(resp)
        return AgentDetail(**resp.json())

    async def list_sessions(self) -> list[SessionMeta]:
        """List all persisted sessions."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v1/sessions")
        if resp.status_code != 200:
            self._raise_error(resp)
        return [SessionMeta(**s) for s in resp.json()]

    async def get_session(self, session_id: str) -> dict[str, Any]:
        """Get a session with its messages."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v1/sessions/{session_id}")
        if resp.status_code != 200:
            self._raise_error(resp)
        return resp.json()

    async def delete_session(self, session_id: str) -> None:
        """Delete a persisted session."""
        client = await self._get_client()
        resp = await client.delete(f"{self.base_url}/v1/sessions/{session_id}")
        if resp.status_code != 200:
            self._raise_error(resp)

    def _raise_error(self, resp: httpx.Response) -> None:
        try:
            body = resp.json()
            msg = body.get("message", f"HTTP {resp.status_code}")
        except Exception:
            msg = f"HTTP {resp.status_code}"
        raise AgentError(msg, resp.status_code)
