"""Tests for AgentClient."""

import json

import httpx
import pytest
import respx

from common_agent_sdk.client import AgentClient, AgentError
from common_agent_sdk.types import EventType, Message


def sse_response(events: list[dict]) -> str:
    """Build an SSE response body from a list of event dicts."""
    lines = []
    for ev in events:
        lines.append(f"data: {json.dumps(ev)}\n\n")
    return "".join(lines)


@pytest.fixture
def mock_api():
    with respx.mock(base_url="http://test.local") as respx_mock:
        yield respx_mock


class TestRun:
    @pytest.mark.asyncio
    async def test_streams_events(self, mock_api):
        events = [
            {"type": "text_delta", "content": "hello"},
            {"type": "text_delta", "content": " world"},
            {"type": "done", "status": "completed", "turns": 1},
        ]
        mock_api.post("/v1/agents/run").respond(
            200,
            text=sse_response(events),
            headers={"Content-Type": "text/event-stream"},
        )

        async with AgentClient("http://test.local") as client:
            received = []
            async for ev in client.run(agent="test", prompt="hi"):
                received.append(ev)

        assert len(received) == 3
        assert received[0].type == EventType.TEXT_DELTA
        assert received[0].content == "hello"
        assert received[2].type == EventType.DONE

    @pytest.mark.asyncio
    async def test_sends_session_id_and_messages(self, mock_api):
        route = mock_api.post("/v1/agents/run").respond(
            200,
            text=sse_response([{"type": "done", "status": "completed"}]),
            headers={"Content-Type": "text/event-stream"},
        )

        async with AgentClient("http://test.local") as client:
            async for _ in client.run(
                agent="test",
                prompt="hi",
                session_id="sess-123",
                messages=[Message(role="user", content="prev")],
            ):
                pass

        request = route.calls.last.request
        body = json.loads(request.content)
        assert body["session_id"] == "sess-123"
        assert body["messages"] == [{"role": "user", "content": "prev"}]

    @pytest.mark.asyncio
    async def test_raises_on_http_error(self, mock_api):
        mock_api.post("/v1/agents/run").respond(
            400,
            json={"code": "agent_error", "message": "agent not found"},
        )

        with pytest.raises(AgentError) as exc_info:
            async with AgentClient("http://test.local") as client:
                async for _ in client.run(agent="bad", prompt="hi"):
                    pass

        assert exc_info.value.status == 400
        assert "agent not found" in str(exc_info.value)


class TestApprove:
    @pytest.mark.asyncio
    async def test_sends_approval(self, mock_api):
        route = mock_api.post("/v1/agents/approve").respond(200, json={"resolved": True})

        async with AgentClient("http://test.local") as client:
            await client.approve("ap-123", True)

        request = route.calls.last.request
        body = json.loads(request.content)
        assert body == {"approval_id": "ap-123", "approved": True}

    @pytest.mark.asyncio
    async def test_raises_on_error(self, mock_api):
        mock_api.post("/v1/agents/approve").respond(
            404, json={"message": "no pending approval"}
        )

        with pytest.raises(AgentError):
            async with AgentClient("http://test.local") as client:
                await client.approve("bad-id", True)


class TestListTools:
    @pytest.mark.asyncio
    async def test_returns_tools(self, mock_api):
        tools = [
            {"name": "echo", "description": "Echo", "parameters": {}},
            {"name": "get_time", "description": "Time", "parameters": {}},
        ]
        mock_api.get("/v1/tools").respond(200, json=tools)

        async with AgentClient("http://test.local") as client:
            result = await client.list_tools()

        assert len(result) == 2
        assert result[0].name == "echo"


class TestListAgents:
    @pytest.mark.asyncio
    async def test_returns_agents(self, mock_api):
        agents = [
            {"name": "demo", "provider": "openai", "model": "gpt-4o", "tools": ["echo"], "max_turns": 10},
        ]
        mock_api.get("/v1/agents").respond(200, json=agents)

        async with AgentClient("http://test.local") as client:
            result = await client.list_agents()

        assert len(result) == 1
        assert result[0].name == "demo"


class TestGetAgent:
    @pytest.mark.asyncio
    async def test_returns_detail(self, mock_api):
        detail = {
            "name": "demo",
            "provider": "openai",
            "model": "gpt-4o",
            "system_prompt": "helpful",
            "tools": ["echo"],
            "max_turns": 10,
            "max_tokens": 4096,
        }
        mock_api.get("/v1/agents/demo").respond(200, json=detail)

        async with AgentClient("http://test.local") as client:
            result = await client.get_agent("demo")

        assert result.name == "demo"
        assert result.provider == "openai"

    @pytest.mark.asyncio
    async def test_raises_on_404(self, mock_api):
        mock_api.get("/v1/agents/missing").respond(404, json={"message": "not found"})

        with pytest.raises(AgentError):
            async with AgentClient("http://test.local") as client:
                await client.get_agent("missing")


class TestSessions:
    @pytest.mark.asyncio
    async def test_list_sessions(self, mock_api):
        sessions = [{"id": "s1", "agent": "demo", "updated_at": "2026-01-01"}]
        mock_api.get("/v1/sessions").respond(200, json=sessions)

        async with AgentClient("http://test.local") as client:
            result = await client.list_sessions()

        assert len(result) == 1
        assert result[0].id == "s1"

    @pytest.mark.asyncio
    async def test_get_session(self, mock_api):
        session = {"id": "s1", "agent": "demo", "messages": [{"role": "user", "content": "hi"}]}
        mock_api.get("/v1/sessions/s1").respond(200, json=session)

        async with AgentClient("http://test.local") as client:
            result = await client.get_session("s1")

        assert result["id"] == "s1"

    @pytest.mark.asyncio
    async def test_delete_session(self, mock_api):
        mock_api.delete("/v1/sessions/s1").respond(200)

        async with AgentClient("http://test.local") as client:
            await client.delete_session("s1")


class TestConstructor:
    @pytest.mark.asyncio
    async def test_strips_trailing_slashes(self, mock_api):
        mock_api.get("/v1/tools").respond(200, json=[])

        async with AgentClient("http://test.local///") as client:
            await client.list_tools()

        assert client.base_url == "http://test.local"
