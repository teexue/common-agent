"""Tests for SSE parsing."""

import pytest

from common_agent_sdk.sse import parse_sse_line
from common_agent_sdk.types import EventType


class TestParseSSELine:
    def test_returns_none_for_non_data_lines(self):
        assert parse_sse_line("event: message") is None
        assert parse_sse_line("") is None
        assert parse_sse_line("data:") is None  # missing space
        assert parse_sse_line("retry: 3000") is None

    def test_parses_text_delta(self):
        event = parse_sse_line('data: {"type":"text_delta","content":"hello"}')
        assert event is not None
        assert event.type == EventType.TEXT_DELTA
        assert event.content == "hello"

    def test_parses_done_event(self):
        event = parse_sse_line('data: {"type":"done","status":"completed","turns":2}')
        assert event is not None
        assert event.type == EventType.DONE
        assert event.status == "completed"
        assert event.turns == 2

    def test_parses_tool_start(self):
        event = parse_sse_line(
            'data: {"type":"tool_start","tool":"echo","input":{"text":"hi"},"tool_call_id":"tc1"}'
        )
        assert event is not None
        assert event.type == EventType.TOOL_START
        assert event.tool == "echo"
        assert event.tool_call_id == "tc1"

    def test_parses_error_event(self):
        event = parse_sse_line(
            'data: {"type":"error","code":"run_error","message":"something failed"}'
        )
        assert event is not None
        assert event.type == EventType.ERROR
        assert event.code == "run_error"
        assert event.message == "something failed"

    def test_parses_compaction_event(self):
        event = parse_sse_line('data: {"type":"compaction","content":"compacted"}')
        assert event is not None
        assert event.type == EventType.COMPACTION

    def test_returns_none_for_invalid_json(self):
        assert parse_sse_line("data: {invalid json}") is None

    def test_parses_sub_agent_events(self):
        event = parse_sse_line('data: {"type":"sub_agent_start","tool":"worker","content":"task"}')
        assert event is not None
        assert event.type == EventType.SUB_AGENT_START
        assert event.tool == "worker"
