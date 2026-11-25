from __future__ import annotations

import os

# Keep LiteLLM offline in tests — no cost map or network calls
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")
os.environ.setdefault("LITELLM_OFFLINE_MODE", "true")

import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.llm.routing import ResolvedAnswer


@pytest.fixture
def test_settings(tmp_path):
    db_path = str(tmp_path / "test.db")
    return Settings(
        gemini_api_key="test-gemini",
        groq_api_key="test-groq",
        database_url=f"sqlite:///{db_path}",
        allowed_origins="http://localhost:3000",
        enable_failure_simulation=True,
        enable_rate_limiting=False,   # prevent test requests from hitting the limit
        enable_injection_detection=False,  # security tests use their own fixture
    )


@pytest.fixture
def mock_answer():
    return ResolvedAnswer(
        content="Test assistant response",
        model="gemini/gemini-3.1-flash-lite",
        key_id="key_1",
        input_tokens=10,
        output_tokens=5,
        cache_hit=False,
        fallback_attempts=0,
    )


@pytest.fixture
def client(test_settings, mock_answer, mocker):
    mocker.patch(
        "app.llm.routing.complete",
        new_callable=AsyncMock,
        return_value=mock_answer,
    )
    mocker.patch(
        "app.llm.cache.find_answer",
        new_callable=AsyncMock,
        return_value=None,
    )
    mocker.patch(
        "app.llm.cache.store_answer",
        new_callable=AsyncMock,
    )
    app = create_app(test_settings)
    with TestClient(app) as c:
        yield c
