"""SSE (Server-Sent Events) parsing utilities."""

from __future__ import annotations

import json
from typing import AsyncIterator, Optional

from .types import AgentEvent, EventType


def parse_sse_line(line: str) -> Optional[AgentEvent]:
    """Parse a single SSE 'data:' line into an AgentEvent.

    Returns None for non-data lines or parse failures.
    """
    if not line.startswith("data: "):
        return None
    try:
        data = json.loads(line[6:])
        return AgentEvent(**data)
    except (json.JSONDecodeError, Exception):
        return None


async def read_sse_stream(response) -> AsyncIterator[AgentEvent]:
    """Read an SSE stream from an httpx Response and yield AgentEvents.

    Handles buffering, line splitting, and the done event.
    """
    buffer = ""
    async for chunk in response.aiter_text():
        buffer += chunk
        lines = buffer.split("\n")
        buffer = lines.pop() if lines else ""

        for line in lines:
            line = line.strip()
            if not line:
                continue

            event = parse_sse_line(line)
            if event is not None:
                yield event
                if event.type == EventType.DONE:
                    return

    # Process remaining buffer.
    if buffer.strip():
        event = parse_sse_line(buffer.strip())
        if event is not None:
            yield event
