"""Validation contract tests — no real LLM calls."""
from __future__ import annotations

import pytest


def test_chat_missing_session_id(client):
    resp = client.post("/chat", json={"message": "hello"})
    assert resp.status_code == 422


def test_chat_blank_session_id(client):
    resp = client.post("/chat", json={"session_id": "", "message": "hello"})
    assert resp.status_code == 422


def test_chat_whitespace_session_id(client):
    resp = client.post("/chat", json={"session_id": "   ", "message": "hello"})
    assert resp.status_code == 422


def test_chat_session_id_too_long(client):
    resp = client.post("/chat", json={"session_id": "x" * 129, "message": "hello"})
    assert resp.status_code == 422


def test_chat_missing_message(client):
    resp = client.post("/chat", json={"session_id": "s1"})
    assert resp.status_code == 422


def test_chat_blank_message(client):
    resp = client.post("/chat", json={"session_id": "s1", "message": ""})
    assert resp.status_code == 422


def test_chat_whitespace_message(client):
    resp = client.post("/chat", json={"session_id": "s1", "message": "   "})
    assert resp.status_code == 422


def test_chat_message_too_long(client):
    resp = client.post("/chat", json={"session_id": "s1", "message": "x" * 4001})
    assert resp.status_code == 422


def test_chat_message_exactly_4000(client):
    resp = client.post("/chat", json={"session_id": "s1", "message": "x" * 4000})
    assert resp.status_code == 200


def test_chat_invalid_json(client):
    resp = client.post(
        "/chat",
        content=b"not json",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 422


def test_chat_wrong_type_session_id(client):
    resp = client.post("/chat", json={"session_id": 123, "message": "hello"})
    assert resp.status_code == 422


def test_simulation_header_unknown_key(client):
    resp = client.post(
        "/chat",
        json={"session_id": "s1", "message": "hi"},
        headers={"X-Simulate-Failure": "unknown_key=429"},
    )
    assert resp.status_code == 422


def test_simulation_header_bad_status(client):
    resp = client.post(
        "/chat",
        json={"session_id": "s1", "message": "hi"},
        headers={"X-Simulate-Failure": "key_1=400"},
    )
    assert resp.status_code == 422


def test_simulation_header_duplicate(client):
    resp = client.post(
        "/chat",
        json={"session_id": "s1", "message": "hi"},
        headers={"X-Simulate-Failure": "key_1=429,key_1=500"},
    )
    assert resp.status_code == 422


def test_simulation_header_malformed(client):
    resp = client.post(
        "/chat",
        json={"session_id": "s1", "message": "hi"},
        headers={"X-Simulate-Failure": "key_1"},
    )
    assert resp.status_code == 422


def test_health_response_shape(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["keys_configured"] == 2
    assert body["cache_enabled"] is True


def test_chat_success_shape(client):
    resp = client.post("/chat", json={"session_id": "shape-test", "message": "hello"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"] == "shape-test"
    assert body["reply"]
    meta = body["metadata"]
    for field in (
        "resolution_source", "model", "latency_ms",
        "input_tokens", "output_tokens", "fallback_attempts",
    ):
        assert field in meta, f"missing {field}"
    assert "key_id" in meta


def test_history_unknown_session(client):
    resp = client.get("/sessions/never-existed/messages")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "session not found"
