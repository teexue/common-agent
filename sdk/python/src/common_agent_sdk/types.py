"""Type definitions for the Common Agent SDK.

Mirrors the Go backend event types and API DTOs.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Event types emitted by the agent stream."""

    TEXT_DELTA = "text_delta"
    REASONING_DELTA = "reasoning_delta"
    TOOL_START = "tool_start"
    TOOL_RESULT = "tool_result"
    TOOL_APPROVAL_REQUIRED = "tool_approval_required"
    COMPACTION = "compaction"
    SUB_AGENT_START = "sub_agent_start"
    SUB_AGENT_END = "sub_agent_end"
    ERROR = "error"
    DONE = "done"


class AgentEvent(BaseModel):
    """A single agent stream event."""

    type: EventType
    content: Optional[str] = None
    tool: Optional[str] = None
    input: Optional[Any] = None
    output: Optional[Any] = None
    tool_call_id: Optional[str] = Field(None, alias="tool_call_id")
    approval_id: Optional[str] = Field(None, alias="approval_id")
    code: Optional[str] = None
    message: Optional[str] = None
    status: Optional[str] = None
    turns: Optional[int] = None

    model_config = {"populate_by_name": True}


class Message(BaseModel):
    """Conversation message sent to the API."""

    role: str
    content: str


class RunOptions(BaseModel):
    """Options for AgentClient.run()."""

    agent: str
    prompt: str
    session_id: Optional[str] = None
    messages: Optional[list[Message]] = None


class ToolInfo(BaseModel):
    """Tool information returned by the API."""

    name: str
    description: str
    parameters: dict[str, Any] = {}


class AgentListItem(BaseModel):
    """Agent list item returned by the API."""

    name: str
    provider: str
    model: str
    tools: list[str] = []
    max_turns: int = 0


class AgentDetail(BaseModel):
    """Full agent details returned by the API."""

    name: str
    provider: str
    model: str
    system_prompt: str = ""
    tools: list[str] = []
    max_turns: int = 0
    max_tokens: int = 0


class SessionMeta(BaseModel):
    """Session metadata."""

    id: str
    agent: str = ""
    metadata: Optional[dict[str, str]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
