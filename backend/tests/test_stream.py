"""Tests for the POST /chat/stream SSE endpoint."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from app.llm.cache import CachedAnswer
from app.llm.routing import ResolvedAnswer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_sse(text: str) -> list[dict]:
    """Extract all SSE data lines and parse as JSON."""
    return [
        json.loads(line[6:])
        for line in text.splitlines()
        if line.startswith("data: ")
    ]


def _stream_of(*chunks):
    """Return an async-generator function that yields the given chunks."""
    async def _gen(*args, **kwargs):
        for chunk in chunks:
            yield chunk
    return _gen


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def live_answer():
    return ResolvedAnswer(
        content="Streamed reply",
        model="gemini/gemini-3.1-flash-lite",
        key_id="key_1",
        input_tokens=10,
        output_tokens=5,
        cache_hit=False,
        fallback_attempts=0,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_stream_status_and_content_type(client, mocker, live_answer):
    mocker.patch(
        "app.llm.routing.stream_complete",
        new=_stream_of("hi", live_answer),
    )
    resp = client.post("/chat/stream", json={"session_id": "ct", "message": "hello"})
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]


def test_stream_delivers_delta_then_done(client, mocker, live_answer):
    mocker.patch(
        "app.llm.routing.stream_complete",
        new=_stream_of("Hello ", "world", live_answer),
    )
    resp = client.post("/chat/stream", json={"session_id": "d1", "message": "hi"})
    events = parse_sse(resp.text)

    deltas = [e for e in events if e.get("t") == "delta"]
    done   = [e for e in events if e.get("t") == "done"]

    assert len(deltas) >= 1
    assert len(done) == 1
    assert "".join(e["c"] for e in deltas) == "Hello world"


def test_stream_done_metadata_shape(client, mocker, live_answer):
    mocker.patch(
        "app.llm.routing.stream_complete",
        new=_stream_of("ok", live_answer),
    )
    resp = client.post("/chat/stream", json={"session_id": "d2", "message": "hi"})
    done = next(e for e in parse_sse(resp.text) if e.get("t") == "done")
    m = done["m"]

    assert m["resolution_source"] == "LIVE_INFERENCE"
    assert m["key_id"] == "key_1"
    assert m["fallback_attempts"] == 0
    assert m["input_tokens"] == 10
    assert m["output_tokens"] == 5
    assert isinstance(m["latency_ms"], int)


def test_stream_cache_hit_single_delta_llm_cache(client, mocker):
    cached = CachedAnswer(
        content="Cached reply",
        model="gemini/gemini-3.1-flash-lite",
        input_tokens=8,
        output_tokens=4,
    )
    mocker.patch(
        "app.llm.cache.find_answer",
        new_callable=AsyncMock,
        return_value=cached,
    )

    resp = client.post("/chat/stream", json={"session_id": "ch1", "message": "cached?"})
    events = parse_sse(resp.text)

    deltas = [e for e in events if e.get("t") == "delta"]
    done   = [e for e in events if e.get("t") == "done"]

    assert len(deltas) == 1
    assert deltas[0]["c"] == "Cached reply"
    assert done[0]["m"]["resolution_source"] == "LLM_CACHE"
    assert done[0]["m"]["key_id"] is None


def test_stream_history_committed(client, mocker, live_answer):
    mocker.patch(
        "app.llm.routing.stream_complete",
        new=_stream_of("My answer", live_answer),
    )
    client.post("/chat/stream", json={"session_id": "hist-s", "message": "Question?"})
    hist = client.get("/sessions/hist-s/messages").json()

    msgs = hist["messages"]
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "Question?"
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["metadata"]["resolution_source"] == "LIVE_INFERENCE"


def test_stream_different_sessions_independent(client, mocker, live_answer):
    mocker.patch(
        "app.llm.routing.stream_complete",
        new=_stream_of("Reply", live_answer),
    )
    client.post("/chat/stream", json={"session_id": "sess-a", "message": "first"})
    client.post("/chat/stream", json={"session_id": "sess-b", "message": "second"})

    hist_a = client.get("/sessions/sess-a/messages").json()["messages"]
    hist_b = client.get("/sessions/sess-b/messages").json()["messages"]

    assert len(hist_a) == 2
    assert len(hist_b) == 2
    assert hist_a[0]["content"] == "first"
    assert hist_b[0]["content"] == "second"


def test_stream_validates_empty_message(client):
    resp = client.post("/chat/stream", json={"session_id": "v1", "message": "   "})
    assert resp.status_code == 422


def test_stream_validates_message_too_long(client):
    resp = client.post("/chat/stream", json={"session_id": "v2", "message": "x" * 4001})
    assert resp.status_code == 422
