import { useState } from "react";
import { postChat } from "./api";
import type { DisplayMessage, ReplyMetadata } from "./types";
import { ApiError } from "./types";
import { MessageList } from "./components/MessageList";
import { ChatComposer } from "./components/ChatComposer";
import { ResilienceLab, type ResilienceConfig } from "./components/ResilienceLab";

// Generate once per page load — React.StrictMode double-invokes in dev, but
// the session is attached to the module scope, not component state.
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

    const userMsg: DisplayMessage = {
      id: nextId(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setPending(true);

    try {
      const resp = await postChat(
        {
          session_id: SESSION_ID,
          message: text,
          ...(resilience.systemPrompt
            ? { system_prompt: resilience.systemPrompt }
            : {}),
        },
        {
          simulationHeader: resilience.simulationHeader || undefined,
        }
      );

      const assistantMsg: DisplayMessage = {
        id: nextId(),
        role: "assistant",
        content: resp.reply,
        metadata: resp.metadata,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const detail =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Unknown error";
      const errorMsg: DisplayMessage = {
        id: nextId(),
        role: "error",
        content: detail,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Relay AI</h1>
          <p className="text-xs text-gray-400">Session: {SESSION_ID.slice(0, 8)}…</p>
        </div>
        <span className="text-xs text-gray-400 hidden sm:block">
          Fault-tolerant · Gemini + Groq · LiteLLM
        </span>
      </header>

      {/* Resilience Lab (P1) */}
      <ResilienceLab config={resilience} onChange={setResilience} />

      {/* Messages */}
      <MessageList messages={messages} pending={pending} />

      {/* Composer */}
      <ChatComposer onSend={handleSend} disabled={pending} />
    </div>
  );
}
