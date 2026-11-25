import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AssistantMessage } from "../components/AssistantMessage";
import type { ReplyMetadata } from "../types";

const liveMetadata: ReplyMetadata = {
  resolution_source: "LIVE_INFERENCE",
  model: "gemini/gemini-3.1-flash-lite",
  latency_ms: 342,
  input_tokens: 15,
  output_tokens: 8,
  key_id: "key_1",
  fallback_attempts: 0,
};

const cacheMetadata: ReplyMetadata = {
  resolution_source: "LLM_CACHE",
  model: "gemini/gemini-3.1-flash-lite",
  latency_ms: 4,
  input_tokens: 15,
  output_tokens: 8,
  key_id: null,
  fallback_attempts: 0,
};

const fallbackMetadata: ReplyMetadata = {
  resolution_source: "LIVE_INFERENCE",
  model: "groq/qwen/qwen3.8-27b",
  latency_ms: 890,
  input_tokens: 20,
  output_tokens: 12,
  key_id: "key_2",
  fallback_attempts: 1,
};

describe("AssistantMessage", () => {
  it("renders all required data-testid attributes", () => {
    render(<AssistantMessage content="Hello" metadata={liveMetadata} />);
    expect(screen.getByTestId("assistant-message")).toBeInTheDocument();
    expect(screen.getByTestId("meta-source")).toBeInTheDocument();
    expect(screen.getByTestId("meta-model")).toBeInTheDocument();
    expect(screen.getByTestId("meta-latency")).toBeInTheDocument();
    expect(screen.getByTestId("meta-input-tokens")).toBeInTheDocument();
    expect(screen.getByTestId("meta-output-tokens")).toBeInTheDocument();
    expect(screen.getByTestId("metadata-key")).toBeInTheDocument();
    expect(screen.getByTestId("metadata-fallback")).toBeInTheDocument();
  });

  it("shows LIVE_INFERENCE source string", () => {
    render(<AssistantMessage content="hi" metadata={liveMetadata} />);
    expect(screen.getByTestId("meta-source").textContent).toContain("LIVE_INFERENCE");
  });

  it("shows LLM_CACHE source string", () => {
    render(<AssistantMessage content="hi" metadata={cacheMetadata} />);
    expect(screen.getByTestId("meta-source").textContent).toContain("LLM_CACHE");
  });

  it("shows full model name", () => {
    render(<AssistantMessage content="hi" metadata={liveMetadata} />);
    expect(screen.getByTestId("meta-model").textContent).toContain("gemini/gemini-3.1-flash-lite");
  });

  it("shows null key_id as 'cache'", () => {
    render(<AssistantMessage content="hi" metadata={cacheMetadata} />);
    expect(screen.getByTestId("metadata-key").textContent).toBe("cache");
  });

  it("shows key_id when present", () => {
    render(<AssistantMessage content="hi" metadata={liveMetadata} />);
    expect(screen.getByTestId("metadata-key").textContent).toBe("key_1");
  });

  it("shows fallback_attempts", () => {
    render(<AssistantMessage content="hi" metadata={fallbackMetadata} />);
    expect(screen.getByTestId("metadata-fallback").textContent).toContain("1");
  });

  it("shows latency_ms with space before ms", () => {
    render(<AssistantMessage content="hi" metadata={liveMetadata} />);
    expect(screen.getByTestId("meta-latency").textContent).toContain("342");
    expect(screen.getByTestId("meta-latency").textContent).toContain("ms");
  });

  it("shows input token count", () => {
    render(<AssistantMessage content="hi" metadata={liveMetadata} />);
    expect(screen.getByTestId("meta-input-tokens").textContent).toContain("15");
  });

  it("shows output token count", () => {
    render(<AssistantMessage content="hi" metadata={liveMetadata} />);
    expect(screen.getByTestId("meta-output-tokens").textContent).toContain("8");
  });

  it("renders reply content", () => {
    render(<AssistantMessage content="The answer is 42" metadata={liveMetadata} />);
    expect(screen.getByTestId("assistant-message").textContent).toContain("The answer is 42");
  });
});
