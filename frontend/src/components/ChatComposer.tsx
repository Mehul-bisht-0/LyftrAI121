import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

const MAX_CHARS = 4000;

export function ChatComposer({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const remaining = MAX_CHARS - value.length;
  const nearLimit = remaining < 400;
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      className="shrink-0 px-4 py-3 border-t"
      style={{
        background: "hsl(var(--surface))",
        borderColor: "hsl(var(--border-dim))",
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className="flex items-end gap-3 rounded-2xl border px-4 py-3 transition-all duration-200"
          style={{
            background: "hsl(var(--elevated))",
            borderColor: "hsl(var(--border))",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(var(--accent) / 0.5)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px hsl(var(--accent) / 0.1)";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(var(--border))";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Relay AI…"
            disabled={disabled}
            rows={1}
            maxLength={MAX_CHARS}
            className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed placeholder:text-sm"
            style={{
              color: "hsl(var(--text))",
              minHeight: "24px",
              maxHeight: "160px",
            }}
          />

          {/* Right side: char counter + send button */}
          <div className="flex items-center gap-2 shrink-0 self-end">
            {nearLimit && (
              <span
                className="text-xs tabular-nums"
                style={{ color: remaining < 100 ? "hsl(var(--error))" : "hsl(var(--text-dim))" }}
              >
                {remaining}
              </span>
            )}
            <button
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send"
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 shrink-0"
              style={
                canSend
                  ? {
                      background: "hsl(var(--accent))",
                      color: "white",
                      boxShadow: "0 0 12px hsl(var(--accent) / 0.4)",
                    }
                  : {
                      background: "hsl(var(--border))",
                      color: "hsl(var(--text-dim))",
                    }
              }
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-xs mt-2" style={{ color: "hsl(var(--text-dim))" }}>
          <kbd className="font-mono">Enter</kbd> to send ·{" "}
          <kbd className="font-mono">Shift+Enter</kbd> for newline
        </p>
      </div>
    </div>
  );
}
