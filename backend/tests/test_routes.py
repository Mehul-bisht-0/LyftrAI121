"""End-to-end route tests via TestClient."""
from __future__ import annotations

import pytest


def test_chat_returns_all_metadata_fields(client):
    resp = client.post("/chat", json={"session_id": "meta-test", "message": "hello"})
    assert resp.status_code == 200
    meta = resp.json()["metadata"]
    assert meta["resolution_source"] == "LIVE_INFERENCE"
    assert meta["model"] == "gemini/gemini-3.1-flash-lite"
    assert meta["key_id"] == "key_1"
    assert meta["fallback_attempts"] == 0
    assert meta["latency_ms"] >= 0
    assert meta["input_tokens"] == 10
    assert meta["output_tokens"] == 5


def test_chat_session_id_preserved(client):
    resp = client.post("/chat", json={"session_id": "my-session", "message": "hi"})
    assert resp.json()["session_id"] == "my-session"


def test_history_after_chat(client):
    client.post("/chat", json={"session_id": "hist-test", "message": "What is 2+2?"})
    resp = client.get("/sessions/hist-test/messages")
    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"] == "hist-test"
    msgs = body["messages"]
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"
    assert "metadata" in msgs[1]
    assert "metadata" not in msgs[0]


def test_multi_turn_context(client, mocker):
    from app.llm.routing import ResolvedAnswer

    answers = [
        ResolvedAnswer(content="My name is Relay.", model="gemini/gemini-3.1-flash-lite",
                       key_id="key_1", input_tokens=10, output_tokens=5,
                       cache_hit=False, fallback_attempts=0),
        ResolvedAnswer(content="Your name is Relay.", model="gemini/gemini-3.1-flash-lite",
                       key_id="key_1", input_tokens=20, output_tokens=5,
                       cache_hit=False, fallback_attempts=0),
    ]
    mocker.patch("app.llm.routing.complete", side_effect=answers)

    client.post("/chat", json={"session_id": "multi", "message": "What is your name?"})
    resp2 = client.post("/chat", json={"session_id": "multi", "message": "What did I just ask?"})
    assert resp2.status_code == 200


def test_503_on_all_providers_fail(client, mocker):
    from app.llm.routing import AllProvidersUnavailableError
    mocker.patch(
        "app.llm.routing.complete",
        side_effect=AllProvidersUnavailableError("all failed"),
    )
    resp = client.post("/chat", json={"session_id": "fail-test", "message": "hi"})
    assert resp.status_code == 503
    assert resp.json()["detail"] == "all providers unavailable"


def test_503_does_not_mutate_history(client, mocker):
    from app.llm.routing import AllProvidersUnavailableError
    mocker.patch(
        "app.llm.routing.complete",
        side_effect=AllProvidersUnavailableError("all failed"),
    )
    client.post("/chat", json={"session_id": "no-history", "message": "first"})
    resp = client.get("/sessions/no-history/messages")
    assert resp.status_code == 404  # Session was never committed


def test_simulation_header_ignored_when_disabled(test_settings, mocker, mock_answer):
    test_settings_no_sim = test_settings.model_copy(
        update={"enable_failure_simulation": False}
    )
    mocker.patch("app.llm.routing.complete", return_value=mock_answer)
    mocker.patch("app.llm.cache.find_answer", return_value=None)
    mocker.patch("app.llm.cache.store_answer")
    from app.main import create_app
    app = create_app(test_settings_no_sim)
    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        resp = c.post(
            "/chat",
            json={"session_id": "s1", "message": "hi"},
            headers={"X-Simulate-Failure": "key_1=429"},
        )
        assert resp.status_code == 200
