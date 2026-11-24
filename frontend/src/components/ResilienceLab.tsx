import { useState } from "react";
import { FlaskConical, ChevronDown, ChevronUp, AlertTriangle, X } from "lucide-react";

export interface ResilienceConfig {
  systemPrompt: string;
  simulationHeader: string;
}

interface Props {
  config: ResilienceConfig;
  onChange: (config: ResilienceConfig) => void;
}

const SIM_OPTIONS = [
  { label: "key_1 → 429",   value: "key_1=429",  color: "warn" },
  { label: "key_2 → 429",   value: "key_2=429",  color: "warn" },
  { label: "key_1 → 500",   value: "key_1=500",  color: "error" },
  { label: "All → 429",     value: "*=429",      color: "error" },
  { label: "All → 503",     value: "*=503",      color: "error" },
];

export function ResilienceLab({ config, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const hasActive = !!config.simulationHeader;

  return (
    <div
      className="shrink-0 border-b"
      style={{
        background: "hsl(var(--surface))",
        borderColor: "hsl(var(--border-dim))",
      }}
    >
      {/* Toggle row */}
      <button
        className="w-full flex items-center justify-between px-5 py-2 transition-colors duration-100"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ color: "hsl(var(--text-dim))" }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "hsl(var(--hover))")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "")
        }
      >
        <span className="flex items-center gap-2 font-mono" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
          <FlaskConical size={12} strokeWidth={1.75} />
          Resilience Lab
          {hasActive && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono"
              style={{
                background: "hsl(var(--error) / 0.1)",
                color: "hsl(var(--error))",
                border: "1px solid hsl(var(--error) / 0.2)",
                fontSize: "10px",
              }}
            >
              <AlertTriangle size={8} strokeWidth={2.5} />
              {config.simulationHeader}
            </span>
          )}
        </span>
        {open
          ? <ChevronUp size={12} strokeWidth={2} />
          : <ChevronDown size={12} strokeWidth={2} />
        }
      </button>

      {/* Expanded content */}
      {open && (
        <div
          className="px-5 pb-4 pt-2 space-y-3.5 border-t"
          style={{
            borderColor: "hsl(var(--border-dim))",
            borderLeftWidth: "2px",
            borderLeftColor: "hsl(var(--accent) / 0.2)",
          }}
        >
          {/* Supplemental context */}
          <div>
            <label
              className="block mb-1.5"
              style={{ color: "hsl(var(--text-muted))", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}
            >
              Supplemental context
              <span className="ml-1" style={{ color: "hsl(var(--text-dim))" }}>
                · appended after core guardrails
              </span>
            </label>
            <textarea
              data-testid="system-prompt-input"
              value={config.systemPrompt}
              onChange={(e) => onChange({ ...config, systemPrompt: e.target.value })}
              placeholder="Optional extra context for the AI…"
              rows={2}
              className="w-full resize-none rounded-md border px-3 py-2 outline-none transition-colors"
              style={{
                background: "hsl(var(--elevated))",
                borderColor: "hsl(var(--border))",
                color: "hsl(var(--text))",
                fontSize: "12px",
                fontFamily: "inherit",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "hsl(var(--accent) / 0.4)";
                e.currentTarget.style.boxShadow = "0 0 0 2px hsl(var(--accent) / 0.07)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "hsl(var(--border))";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Failure simulation */}
          <div>
            <label
              className="block mb-1.5"
              style={{ color: "hsl(var(--text-muted))", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}
            >
              Failure simulation
              <span className="ml-1" style={{ color: "hsl(var(--text-dim))" }}>
                · sends X-Simulate-Failure header
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SIM_OPTIONS.map((opt) => {
                const isActive = config.simulationHeader === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      onChange({
                        ...config,
                        simulationHeader: isActive ? "" : opt.value,
                      })
                    }
                    className="px-2 py-1 rounded border transition-colors duration-100 font-mono"
                    style={
                      isActive
                        ? {
                            background: "hsl(var(--error) / 0.1)",
                            borderColor: "hsl(var(--error) / 0.35)",
                            color: "hsl(var(--error))",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "11px",
                          }
                        : {
                            background: "hsl(var(--elevated))",
                            borderColor: "hsl(var(--border-dim))",
                            color: "hsl(var(--text-dim))",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "11px",
                          }
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
              {hasActive && (
                <button
                  onClick={() => onChange({ ...config, simulationHeader: "" })}
                  className="px-2 py-1 rounded border flex items-center gap-1 transition-colors duration-100 font-mono"
                  style={{
                    background: "transparent",
                    borderColor: "hsl(var(--border-dim))",
                    color: "hsl(var(--text-dim))",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11px",
                  }}
                >
                  <X size={9} strokeWidth={2.5} /> Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
