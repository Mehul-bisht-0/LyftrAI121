# Relay AI

Fault-tolerant, multi-provider LLM chatbot — Lyftr AI Full-Stack Engineering Assignment.

[![CI](https://github.com/mehulbisht/relay-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/mehulbisht/relay-ai/actions/workflows/ci.yml)

---

## 1. Live URLs

| Service  | URL |
|----------|-----|
| Frontend | `https://<your-vercel-url>` |
| Backend  | `https://<your-railway-url>` |

Both are public, require no login, and are connected to each other.

Quick sanity check:
```bash
curl https://<your-railway-url>/health
# {"status":"ok","keys_configured":2,"cache_enabled":true}
```

---

## 2. Run locally: with Docker and without

### With Docker (recommended)

```bash
# 1. Clone
git clone https://github.com/mehulbisht/relay-ai && cd relay-ai

# 2. Configure
cp .env.example .env
# Edit .env — set LLM_API_KEYS=<gemini_key>,<groq_key>

# 3. Start the full stack
make up
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:8000

make down   # stop containers (volume data persists)
make logs   # tail logs from both services
```

The `docker-compose.yml` creates a named volume mounted at `/data` in the backend container, so SQLite history survives `make down / make up` cycles.

### Without Docker

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.in
LLM_API_KEYS=<gemini_key>,<groq_key> uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
VITE_API_BASE_URL=http://localhost:8000 npm run dev
# → http://localhost:3000
```

### Environment variables

| Variable | Required | Meaning |
|----------|----------|---------|
| `LLM_API_KEYS` | Yes* | Comma-separated key pool: `key1,key2`. Key ids assigned as `key_1`, `key_2`, … |
| `GEMINI_API_KEY` | Yes* | Gemini API key (alternative to `LLM_API_KEYS`) |
| `GROQ_API_KEY` | Yes* | Groq API key (alternative to `LLM_API_KEYS`) |
| `DATABASE_URL` | No | SQLite path (default: `sqlite:///./data/app.db`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `ENABLE_FAILURE_SIMULATION` | No | `true` enables `X-Simulate-Failure` header |

*Either `LLM_API_KEYS` or both individual key vars must be set.

---

## 3. Design decisions: key fallback, caching, SQLite session storage

### Key fallback

LiteLLM Router is configured with two deployment groups: `primary` (Gemini `gemini/gemini-3.1-flash-lite`, `key_1`) and `fallback` (Groq `groq/qwen/qwen3.8-27b`, `key_2`). The Router's `fallbacks=[{"primary": ["fallback"]}]` setting triggers automatic failover on 429, 500, 502, 503, and timeout errors.

For the `X-Simulate-Failure` test hook, the Router is bypassed entirely in favour of a manual attempt loop — this guarantees isolation (each request's simulated failures live in a `ContextVar`, invisible to other concurrent requests).

### Caching

LiteLLM's built-in `Cache(type="local")` is used, but with an explicit SHA-256 cache key: `SHA256([1, model, messages])`. This key includes the full message list (system prompt + history + new message) so:
- Two identical first messages in two different sessions share the same cache entry.
- Any change in conversation history produces a cache miss.
- The model name is part of the key so a Gemini response is never returned as a Groq response.

Simulated requests bypass cache reads and writes entirely — a cache hit would defeat the failover demonstration.

### SQLite session storage

`aiosqlite` with WAL mode gives concurrent reads without blocking the async event loop. A per-session `asyncio.Lock` ensures that turns within the same session are serialised: history is read, the LLM is called, and the result is committed atomically, with no other turn for that session able to interleave.

The `messages` table schema matches the assignment spec; `metadata` is stored as a JSON string on assistant rows.

---

## 4. Verification: how to see failover, cache hits and per-message token usage

Set `API=https://<your-railway-url>` for the commands below.

### Cache hit

```bash
# First call — LIVE_INFERENCE
curl -s -X POST $API/chat -H "Content-Type: application/json" \
  -d '{"session_id":"demo-cache","message":"What is 2+2?"}' | jq .metadata.resolution_source
# "LIVE_INFERENCE"

# Same session, same first message — LLM_CACHE (faster latency, same token counts)
curl -s -X POST $API/chat -H "Content-Type: application/json" \
  -d '{"session_id":"demo-cache","message":"What is 2+2?"}' | jq .metadata
# resolution_source: "LLM_CACHE", key_id: null
```

### Failover

```bash
# Primary key simulated as 429 → fallback key_2 answers
curl -s -X POST $API/chat -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: key_1=429" \
  -d '{"session_id":"demo-failover","message":"Hello"}' | jq '{key_id,fallback_attempts}' .metadata
# key_id: "key_2", fallback_attempts: 1

# All keys fail → 503
curl -s -X POST $API/chat -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: *=429" \
  -d '{"session_id":"demo-all-fail","message":"Hello"}'
# 503 {"detail":"all providers unavailable"}
```

### Per-message token usage

```bash
curl -s -X POST $API/chat -H "Content-Type: application/json" \
  -d '{"session_id":"demo-tokens","message":"Ping"}' | jq '.metadata | {input_tokens, output_tokens}'
```

Each reply in the UI also shows input and output tokens for that individual request.

### Session history

```bash
curl -s $API/sessions/demo-cache/messages | jq .
```

---

## 5. Setup Used: your editor and AI tools

**Editor:** Cursor (VS Code fork)

**AI tools used throughout:**
- **Claude Code (Anthropic)** — primary coding assistant: architecture design, feature implementation, test generation, debugging, and code review
- **Claude claude.ai** — referenced for API documentation and LiteLLM integration patterns
- **LiteLLM docs** — official documentation for Router configuration and streaming

No AI-generated code was accepted without review; all logic was verified against the assignment spec and tested.

---

## 6. Bonus features (if any): what you added beyond the requirements and why

| Feature | Why |
|---------|-----|
| **Relay AI identity & guardrails** | Server-enforced system prompt gives the bot a consistent identity; output filter catches jailbreak-compliance attempts before they're cached or stored |
| **Prompt-injection detection** | 37-pattern regex guard on all inputs rejects known injection attempts at the API boundary, before any LLM call |
| **SSE streaming** | Tokens stream live to the browser via `POST /chat/stream`, eliminating the perceived wait for long replies |
| **Markdown rendering** | `react-markdown` + `remark-gfm` renders headings, bold, code blocks, tables, and lists in assistant replies |
| **Dark premium UI** | Full CSS-custom-property dark theme with animations, blinking streaming cursor, and metadata chip row per reply |
| **Resilience Lab** | In-browser panel to inject `X-Simulate-Failure` headers and set a supplemental system prompt without curl |
| **Security headers** | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control` on every response |
| **Rate limiting** | `slowapi` in-process rate limiter (configurable via `CHAT_RATE_LIMIT`); returns `Retry-After: 60` on 429 |

---

## Known limitations

- **In-memory cache** — cleared on every backend restart; cold start returns `LIVE_INFERENCE` for previously cached queries.
- **SQLite single-writer** — WAL mode handles concurrent reads, but writes are serialised per session. Not suitable for horizontal scaling, which is intentional for the one-worker assignment.
- **Groq TPM ceiling** — Groq's free tier is limited to 6,000 TPM; at ~500 tokens/request the effective rate cap is ~12 req/min.
