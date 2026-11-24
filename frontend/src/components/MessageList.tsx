import { useEffect, useRef } from "react";
import type { DisplayMessage } from "../types";
import { AssistantMessage } from "./AssistantMessage";

interface Props {
  messages: DisplayMessage[];
  pending: boolean;
}

export function MessageList({ messages, pending }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Start a conversation
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {msg.role === "user" && (
            <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] whitespace-pre-wrap leading-relaxed">
              {msg.content}
            </div>
          )}

          {msg.role === "assistant" && msg.metadata && (
            <AssistantMessage content={msg.content} metadata={msg.metadata} />
          )}

          {msg.role === "error" && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm">
              <span className="font-medium">Error: </span>
              {msg.content}
            </div>
          )}
        </div>
      ))}

      {pending && (
        <div className="flex justify-start">
          <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-gray-400 text-sm">
            <span className="animate-pulse">Thinking…</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
