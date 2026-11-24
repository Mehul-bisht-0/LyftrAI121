# Relay AI

Fault-tolerant, multi-provider LLM chatbot built for the Lyftr AI Full-Stack Engineering Assignment.

**Live demo:** `https://<vercel-url>` · **API:** `https://<railway-url>`

[![CI](https://github.com/<owner>/relay-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/relay-ai/actions/workflows/ci.yml)

---

## Overview

Relay AI is a full-stack chat application that demonstrates:

- **Fault-tolerant LLM routing** — Gemini 2.5 Flash Lite as primary (`key_1`), Groq Llama 3.1 8B as automatic fallback (`key_2`) on 429/5xx errors
- **Response caching** — LiteLLM in-memory local cache with SHA-256 identity keyed on model + full conversation context
- **Multi-turn memory** — conversation history stored in SQLite, reconstructed server-side for every request
- **Resilience Lab** — optional system prompt and per-request failure simulation via `X-Simulate-Failure` header
- **Zero external dependencies** — no Redis, no PostgreSQL, no separate proxy

**Stack:** React 18 + TypeScript + Vite + Tailwind · FastAPI + Python 3.11 · LiteLLM 1.110.3 · SQLite + aiosqlite · Railway + Vercel

---

## Setup

### Prerequisites

- Python 3.11+ and Node.js 20+
- Docker and Docker Compose (for local stack)
- API keys: [Google AI Studio](https://aistudio.google.com) (Gemini) and [Groq Console](https://console.groq.com) (Groq)

### Local development

```bash
# 1. Clone
git clone https://github.com/<owner>/relay-ai && cd relay-ai

# 2. Configure
cp .env.example .env
# Fill in GEMINI_API_KEY and GROQ_API_KEY in .env

# 3. Start the full stack
make up
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:8000
```

### Native backend (without Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements-dev.in
GEMINI_API_KEY=... GROQ_API_KEY=... uvicorn app.main:app --reload
```

### Native frontend

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

---

## Architecture

```
Browser (Vercel)
  └─ React SPA — session_id = crypto.randomUUID() per page load
       └─ POST /chat  {session_id, message, [system_prompt]}
            └─ FastAPI (Railway · 1 Uvicorn worker · 1 replica)
                 ├─ Pydantic validation
                 ├─ Per-session asyncio.Lock (serialises concurrent turns)
                 ├─ aiosqlite (WAL · foreign keys · busy_timeout=5s)
                 ├─ LiteLLM local Cache (SHA-256 keyed on model + messages)
                 │    ├─ HIT  → skip provider, return cached answer
                 │    └─ MISS → LiteLLM Router
                 │         ├─ key_1  gemini/gemini-2.5-flash-lite   (primary)
                 │         └─ key_2  groq/llama-3.1-8b-instant      (fallback on 429/5xx)
                 └─ Atomic SQLite commit (upsert session + insert user + assistant)
```

**Key design decisions:**
- One process, one worker, one Railway replica — the in-memory cache and lock registry are process-local by design
- Cache identity: `SHA-256([1, model, messages])` — model and conversation context are both part of the key; a cache hit for session A cannot appear in session B
- Simulation bypass: `X-Simulate-Failure` skips both cache read and write; the winning real provider is called; ContextVar ensures isolation between concurrent requests
- No write transaction spans an LLM call — context read, inference, and commit are separate operations within the session lock

---

## API

Base URL: `https://<railway-url>`

### `GET /health`

```json
{"status":"ok","keys_configured":2,"cache_enabled":true}
```

### `POST /chat`

**Request:**
```json
{
  "session_id": "s-7f3a",
  "message": "What is the capital of France?",
  "system_prompt": "Answer in one sentence."
}
```

**Response (200):**
```json
{
  "session_id": "s-7f3a",
  "reply": "Paris is the capital of France.",
  "metadata": {
    "resolution_source": "LIVE_INFERENCE",
    "model": "gemini/gemini-2.5-flash-lite",
    "latency_ms": 412,
    "input_tokens": 18,
    "output_tokens": 9,
    "key_id": "key_1",
    "fallback_attempts": 0
  }
}
```

**Error responses:** `422` (validation), `503` (all providers unavailable), `404` (unknown session in GET)

### `GET /sessions/{session_id}/messages`

Returns full conversation history ordered oldest-first. User messages have no `metadata`. Assistant messages include all 7 metadata fields.

### Failure simulation

Enable with `ENABLE_FAILURE_SIMULATION=true` on the backend. Send:

```
X-Simulate-Failure: key_1=429
```

Allowed values: `key_1=429`, `key_2=500`, `*=503`, etc. Status codes: `429`, `500`, `502`, `503`.

---

## Testing

### Backend (zero real API calls)

```bash
cd backend
pip install -r requirements-dev.in
pytest -v
```

### Frontend

```bash
cd frontend
npm install && npm test
```

### Cache verification

```bash
API=https://<railway-url>

# First request — LIVE_INFERENCE
curl -s -X POST $API/chat -H "Content-Type: application/json" \
  -d '{"session_id":"cache-demo","message":"What is 2+2?"}' | jq .metadata

# Same session, same message — LLM_CACHE (same usage counts, faster latency)
curl -s -X POST $API/chat -H "Content-Type: application/json" \
  -d '{"session_id":"cache-demo","message":"What is 2+2?"}' | jq .metadata
```

### Failover verification

```bash
# Simulate primary failure — fallback_attempts=1, key_id=key_2
curl -s -X POST $API/chat -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: key_1=429" \
  -d '{"session_id":"failover-demo","message":"Hello"}' | jq .metadata

# Simulate all-providers failure — 503
curl -s -X POST $API/chat -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: *=429" \
  -d '{"session_id":"all-fail","message":"Hello"}' | jq .
```

---

## Deployment

### Railway (backend)

1. Connect GitHub repo → New Service → set Root Directory: `backend`
2. Add Volume → mount path: `/data`
3. Set environment variables:
   ```
   GEMINI_API_KEY=<your-key>
   GROQ_API_KEY=<your-key>
   DATABASE_URL=sqlite:////data/app.db
   ENABLE_FAILURE_SIMULATION=true
   ALLOWED_ORIGINS=https://<your-vercel-url>
   ```
4. Deploy and confirm `GET /health` returns 200

> **Cost note:** Railway's free tier provides $1/month credit (insufficient for always-on). New users receive a one-time $5 credit. Render.com is a free-tier alternative; the same Dockerfile works unchanged.

### Vercel (frontend)

1. Import repo → Framework: Vite → Root Directory: `frontend`
2. Set environment variable: `VITE_API_BASE_URL=https://<your-railway-url>`
3. Deploy and confirm the app loads in an incognito window

### Local Docker stack

```bash
make up      # starts backend:8000 + frontend:3000
make down    # stops and removes containers (volume data persists)
make logs    # tail logs from both services
```

---

## Known Limitations

- **In-memory cache** — cleared on every backend restart; a cold start returns `LIVE_INFERENCE` for previously cached queries
- **SQLite** — single-writer; not suitable for horizontal scaling, but correct for the assignment's one-worker requirement
- **Groq TPM ceiling** — Groq's free tier is limited to 6,000 TPM; at ~500 tokens/request the effective rate cap is ~12 req/min, lower than the 30 RPM headline
- **Railway cost gate** — Railway's free plan ($1/month credit) is insufficient for persistent deployment; Render.com free tier is the documented fallback
