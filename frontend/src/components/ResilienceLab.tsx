import { useState } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

export interface ResilienceConfig {
  systemPrompt: string;
  simulationHeader: string;
}

interface Props {
  config: ResilienceConfig;
  onChange: (config: ResilienceConfig) => void;
}

const SIM_OPTIONS = [
  { label: "key_1 → 429", value: "key_1=429" },
  { label: "key_2 → 429", value: "key_2=429" },
  { label: "key_1 → 500", value: "key_1=500" },
  { label: "All providers → 429", value: "*=429" },
  { label: "All providers → 503", value: "*=503" },
];

export function ResilienceLab({ config, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function setSystemPrompt(value: string) {
    onChange({ ...config, systemPrompt: value });
  }

  function toggleSim(value: string) {
    if (config.simulationHeader === value) {
      onChange({ ...config, simulationHeader: "" });
    } else {
      onChange({ ...config, simulationHeader: value });
    }
  }

  function clearSim() {
    onChange({ ...config, simulationHeader: "" });
  }

  return (
    <div className="border-b border-gray-200 bg-gray-50">
      <button
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Resilience Lab {config.simulationHeader ? "🔴" : ""}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* System prompt */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Supplemental Context
              <span className="ml-1 text-gray-400 font-normal">(appended after core guardrails — cannot override them)</span>
            </label>
            <Textarea
              value={config.systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Optional extra context for the AI…"
              className="text-sm min-h-[60px]"
              rows={2}
            />
          </div>

          {/* Failure simulation */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Failure Simulation (X-Simulate-Failure)
            </label>
            <div className="flex flex-wrap gap-2">
              {SIM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleSim(opt.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    config.simulationHeader === opt.value
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-red-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {config.simulationHeader && (
                <button
                  onClick={clearSim}
                  className="px-3 py-1 rounded-full text-xs font-medium border border-gray-300 bg-white text-gray-500 hover:bg-gray-100"
                >
                  Clear
                </button>
              )}
            </div>
            {config.simulationHeader && (
              <p className="mt-1 text-xs text-red-500">
                Active: X-Simulate-Failure: {config.simulationHeader}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
