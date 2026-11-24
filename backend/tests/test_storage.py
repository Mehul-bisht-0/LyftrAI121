"""Storage layer tests — real SQLite, no LLM calls."""
from __future__ import annotations

import pytest
from app import storage


@pytest.fixture
async def db(tmp_path):
    path = str(tmp_path / "test.db")
    await storage.initialize(path)
    return path


async def test_check_ready(db):
    assert await storage.check_ready(db) is True


async def test_check_ready_missing(tmp_path):
    assert await storage.check_ready(str(tmp_path / "missing.db")) is False


async def test_read_context_empty_session(db):
    history, prompt = await storage.read_context(db, "new-session")
    assert history == []
    assert prompt is None


async def test_commit_and_read_context(db):
    await storage.commit_turn(
        db, "s1", "Be helpful", "Hello", "Hi there!",
        {"resolution_source": "LIVE_INFERENCE", "model": "m", "latency_ms": 100,
         "input_tokens": 5, "output_tokens": 3, "key_id": "key_1", "fallback_attempts": 0},
    )
    history, prompt = await storage.read_context(db, "s1")
    assert len(history) == 2
    assert history[0] == {"role": "user", "content": "Hello"}
    assert history[1] == {"role": "assistant", "content": "Hi there!"}
    assert prompt == "Be helpful"


async def test_read_history_unknown_session(db):
    result = await storage.read_history(db, "ghost")
    assert result is None


async def test_read_history_known_session(db):
    await storage.commit_turn(
        db, "s2", None, "What is 2+2?", "4",
        {"resolution_source": "LIVE_INFERENCE", "model": "m", "latency_ms": 50,
         "input_tokens": 4, "output_tokens": 1, "key_id": "key_1", "fallback_attempts": 0},
    )
    history = await storage.read_history(db, "s2")
    assert history is not None
    assert len(history) == 2
    # User message has no metadata
    assert "metadata" not in history[0]
    # Assistant message has metadata
    assert history[1]["metadata"]["model"] == "m"


async def test_session_isolation(db):
    await storage.commit_turn(
        db, "sess-a", None, "msg a", "reply a",
        {"resolution_source": "LIVE_INFERENCE", "model": "m", "latency_ms": 1,
         "input_tokens": 1, "output_tokens": 1, "key_id": "key_1", "fallback_attempts": 0},
    )
    history_b, _ = await storage.read_context(db, "sess-b")
    assert history_b == []


async def test_multi_turn_ordering(db):
    for i in range(3):
        await storage.commit_turn(
            db, "turns", None, f"Q{i}", f"A{i}",
            {"resolution_source": "LIVE_INFERENCE", "model": "m", "latency_ms": i,
             "input_tokens": 1, "output_tokens": 1, "key_id": "key_1", "fallback_attempts": 0},
        )
    history, _ = await storage.read_context(db, "turns")
    contents = [m["content"] for m in history]
    assert contents == ["Q0", "A0", "Q1", "A1", "Q2", "A2"]
