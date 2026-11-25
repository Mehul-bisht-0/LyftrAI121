import { useState } from "react";
import { Shield } from "lucide-react";
import { postChat, streamChat } from "./api";
import type { DisplayMessage, ReplyMetadata } from "./types";
import { ApiError } from "./types";
import { MessageList } from "./components/MessageList";
import { ChatComposer } from "./components/ChatComposer";
import { ResilienceLab, type ResilienceConfig } from "./components/ResilienceLab";

const SESSION_ID = crypto.randomUUID();

let msgCounter = 0;
function nextId() {
  return String(++msgCounter);
}

export default function App() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [resilience, setResilience] = useState<ResilienceConfig>({
    systemPrompt: "",
    simulationHeader: "",
  });

  async function handleSend(text: string) {
    if (pending) return;

    const userMsg: DisplayMessage = { id: nextId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setPending(true);

    const reqBody = {
      session_id: SESSION_ID,
      message: text,
      ...(resilience.systemPrompt ? { system_prompt: resilience.systemPrompt } : {}),
    };

    // Simulation path: use non-streaming endpoint (simulation + streaming not combined)
    if (resilience.simulationHeader) {
      try {
        const resp = await postChat(reqBody, {
          simulationHeader: resilience.simulationHeader,
        });
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", content: resp.reply, metadata: resp.metadata },
        ]);
      } catch (err) {
        const detail =
          err instanceof ApiError ? err.message
          : err instanceof Error  ? err.message
          : "Unknown error";
        setMessages((prev) => [...prev, { id: nextId(), role: "error", content: detail }]);
      } finally {
        setPending(false);
      }
      return;
    }

    // Normal path: streaming
    const streamId = nextId();
    setMessages((prev) => [
      ...prev,
      { id: streamId, role: "assistant", content: "", streaming: true },
    ]);

    try {
      let content = "";
      for await (const event of streamChat(reqBody)) {
        if (event.t === "delta") {
          content += event.c;
          setMessages((prev) =>
            prev.map((m) => (m.id === streamId ? { ...m, content } : m))
          );
        } else if (event.t === "override") {
          content = event.c;
          setMessages((prev) =>
            prev.map((m) => (m.id === streamId ? { ...m, content } : m))
          );
        } else if (event.t === "done") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId
                ? { ...m, metadata: event.m as ReplyMetadata, streaming: false }
                : m
            )
          );
        } else if (event.t === "error") {
          throw new ApiError(0, (event as { t: "error"; d: string }).d);
        }
      }
      // Ensure streaming flag removed if stream ended without a done event
      setMessages((prev) =>
        prev.map((m) => (m.id === streamId ? { ...m, streaming: false } : m))
      );
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.message
        : err instanceof Error  ? err.message
        : "Unknown error";
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== streamId),
        { id: nextId(), role: "error", content: detail },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "hsl(var(--bg))" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="shrink-0 flex items-center justify-between px-5 py-3 border-b"
        style={{
          background: "hsl(var(--surface))",
          borderColor: "hsl(var(--border-dim))",
        }}
      >
        {/* Brand wordmark */}
        <div className="flex items-center gap-2.5">
          {/* Relay node icon */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="shrink-0"
          >
            {/* left node */}
            <circle cx="4" cy="11" r="2.5" fill="hsl(var(--accent))" opacity="0.9" />
            {/* connector line */}
            <line x1="6.5" y1="11" x2="15.5" y2="11" stroke="hsl(var(--accent))" strokeWidth="1.25" strokeOpacity="0.4" strokeLinecap="round" />
            {/* right node */}
            <circle cx="18" cy="11" r="2.5" fill="hsl(var(--accent))" opacity="0.55" />
            {/* top branch */}
            <line x1="11" y1="11" x2="11" y2="5" stroke="hsl(var(--accent))" strokeWidth="1.25" strokeOpacity="0.3" strokeLinecap="round" />
            <circle cx="11" cy="4" r="1.5" fill="hsl(var(--accent))" opacity="0.35" />
          </svg>

          <div className="flex items-center gap-2 leading-none">
            <span
              className="text-sm font-bold tracking-tight select-none"
              style={{ color: "hsl(var(--text))", letterSpacing: "-0.02em" }}
            >
              RELAY
            </span>
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded select-none"
              style={{
                background: "hsl(var(--accent-bg))",
                color: "hsl(var(--accent))",
                border: "1px solid hsl(var(--accent) / 0.25)",
                letterSpacing: "0.02em",
              }}
            >
              AI
            </span>
          </div>
        </div>

        {/* Right badges */}
        <div className="flex items-center gap-2">
          <span
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border"
            style={{
              color: "hsl(var(--success))",
              borderColor: "hsl(var(--success) / 0.2)",
              background: "hsl(var(--success) / 0.06)",
            }}
          >
            <Shield size={10} strokeWidth={2.5} />
            Guardrails active
          </span>
          <span
            className="hidden md:block text-xs px-2 py-1 rounded border font-mono"
            style={{
              color: "hsl(var(--text-dim))",
              background: "hsl(var(--elevated))",
              borderColor: "hsl(var(--border-dim))",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
            }}
          >
            Gemini + Groq
          </span>
        </div>
      </header>

      {/* ── Resilience Lab ─────────────────────────────────── */}
      <ResilienceLab config={resilience} onChange={setResilience} />

      {/* ── Messages ───────────────────────────────────────── */}
      <MessageList messages={messages} pending={pending} onSuggest={handleSend} />

      {/* ── Composer ───────────────────────────────────────── */}
      <ChatComposer onSend={handleSend} disabled={pending} />
    </div>
  );
}
