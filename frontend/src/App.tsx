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
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm select-none shrink-0"
            style={{
              background: "linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(239 90% 55%) 100%)",
              boxShadow: "0 0 12px hsl(var(--accent) / 0.4)",
            }}
          >
            R
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-none" style={{ color: "hsl(var(--text))" }}>
              Relay AI
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--text-dim))" }}>
              {SESSION_ID.slice(0, 8)}…
            </p>
          </div>
        </div>

        {/* Right badges */}
        <div className="flex items-center gap-2">
          <span
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
            style={{
              color: "hsl(var(--success))",
              borderColor: "hsl(var(--success) / 0.25)",
              background: "hsl(var(--success) / 0.08)",
            }}
          >
            <Shield size={11} strokeWidth={2.5} />
            Guardrails active
          </span>
          <span
            className="hidden md:block text-xs px-2 py-0.5 rounded"
            style={{
              color: "hsl(var(--text-dim))",
              background: "hsl(var(--elevated))",
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
