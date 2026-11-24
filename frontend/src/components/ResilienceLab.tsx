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
        className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium transition-colors duration-150"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ color: "hsl(var(--text-muted))" }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "hsl(var(--hover))")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "")
        }
      >
        <span className="flex items-center gap-2">
          <FlaskConical size={13} strokeWidth={2} />
          Resilience Lab
          {hasActive && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold"
              style={{
                background: "hsl(var(--error) / 0.12)",
                color: "hsl(var(--error))",
              }}
            >
              <AlertTriangle size={9} strokeWidth={2.5} />
              {config.simulationHeader}
            </span>
          )}
        </span>
        {open
          ? <ChevronUp size={13} strokeWidth={2} />
          : <ChevronDown size={13} strokeWidth={2} />
        }
      </button>

      {/* Expanded content */}
      {open && (
        <div
          className="px-5 pb-4 pt-1 space-y-4 border-t"
          style={{ borderColor: "hsl(var(--border-dim))" }}
        >
          {/* Supplemental context */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "hsl(var(--text-muted))" }}
            >
              Supplemental context
              <span className="ml-1 font-normal" style={{ color: "hsl(var(--text-dim))" }}>
                · appended after core guardrails
              </span>
            </label>
            <textarea
              value={config.systemPrompt}
              onChange={(e) => onChange({ ...config, systemPrompt: e.target.value })}
              placeholder="Optional extra context for the AI…"
              rows={2}
              className="w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none transition-colors"
              style={{
                background: "hsl(var(--elevated))",
                borderColor: "hsl(var(--border))",
                color: "hsl(var(--text))",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "hsl(var(--accent) / 0.5)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "hsl(var(--border))")
              }
            />
          </div>

          {/* Failure simulation */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "hsl(var(--text-muted))" }}
            >
              Failure simulation
              <span className="ml-1 font-normal" style={{ color: "hsl(var(--text-dim))" }}>
                · sends X-Simulate-Failure header
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
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
                    className="px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-150"
                    style={
                      isActive
                        ? {
                            background: "hsl(var(--error) / 0.15)",
                            borderColor: "hsl(var(--error) / 0.4)",
                            color: "hsl(var(--error))",
                          }
                        : {
                            background: "hsl(var(--elevated))",
                            borderColor: "hsl(var(--border))",
                            color: "hsl(var(--text-muted))",
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
                  className="px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1 transition-all duration-150"
                  style={{
                    background: "hsl(var(--elevated))",
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--text-dim))",
                  }}
                >
                  <X size={10} strokeWidth={2.5} /> Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
