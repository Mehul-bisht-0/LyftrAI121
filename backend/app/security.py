from __future__ import annotations

import re

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded  # noqa: F401 — re-exported for main.py


# ---------------------------------------------------------------------------
# Prompt-injection detection
# ---------------------------------------------------------------------------

_INJECTION_PATTERNS = [
    re.compile(r, re.IGNORECASE | re.DOTALL)
    for r in [
        # Direct instruction-override attempts
        r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
        r"disregard\s+(all\s+)?(previous|prior|above)?\s*instructions",
        r"forget\s+(all\s+)?(previous|prior|earlier)?\s*instructions",
        r"override\s+(all\s+)?(previous|prior|above)?\s*instructions",
        # Persona injection — "you are now DAN / an evil AI" etc.
        # Negative lookahead excludes benign completions like "you are now answering"
        r"you\s+are\s+now\s+(?!answering|helping|configured|set\s+to|ready)",
        r"pretend\s+(to\s+be|you\s+(are|were))\s+(?!helpful|kind|patient)",
        r"act\s+as\s+(?:if\s+you\s+(?:are|were)\s+)?(?!(?:an?\s+)?(?:helpful|kind|patient)|an?\s+(?:AI|assistant))",
        r"roleplay\s+as\s+(?!a\s+helpful|an?\s+assistant)",
        # Known jailbreak markers
        r"\bDAN\b",
        r"do\s+anything\s+now",
        r"\bjailbreak\b",
        r"developer\s+mode",
        # Structural / meta-prompt injection markers
        r"<\s*/?\s*system\s*>",   # <system> or </system>
        r"\[SYSTEM\]",
        r"###\s*(?:system|instruction)",
        r"<<SYS>>",
        r"\[\/INST\]",
        r"\[INST\]",
        # Prompt exfiltration
        r"(?:reveal|print|show|repeat|output|display)\s+(?:your|the)\s+(?:system\s+)?prompt",
        r"(?:reveal|expose|leak)\s+(?:your|the)\s+(?:system\s+)?instructions",
    ]
]

# Control characters except horizontal tab (\x09) and newline (\x0a / \x0d)
_CTRL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_input(text: str) -> str:
    """Remove null bytes and non-printable control chars (keep \\t, \\n, \\r)."""
    return _CTRL_CHARS.sub("", text)


def detect_injection(text: str) -> bool:
    """Return True if the text matches a known prompt-injection pattern."""
    return any(p.search(text) for p in _INJECTION_PATTERNS)


# ---------------------------------------------------------------------------
# Rate limiter (IP-based, in-memory — no Redis required)
# ---------------------------------------------------------------------------

def _get_client_ip(request: Request) -> str:
    """
    Use X-Forwarded-For when behind Railway / Vercel proxy; fall back to the
    direct socket IP.  When rate limiting is disabled (tests) return a unique
    per-request sentinel so each request gets its own bucket.
    """
    settings = getattr(request.app.state, "settings", None)
    if settings is not None and not settings.enable_rate_limiting:
        # Give every request a distinct key so tests never hit the limit.
        import uuid
        return f"test-{uuid.uuid4()}"

    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return (request.client.host if request.client else "unknown")


limiter = Limiter(key_func=_get_client_ip, storage_uri="memory://")
