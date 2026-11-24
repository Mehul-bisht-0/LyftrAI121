import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AssistantMessage } from "../components/AssistantMessage";
import type { ReplyMetadata } from "../types";

const liveMetadata: ReplyMetadata = {
  resolution_source: "LIVE_INFERENCE",
  model: "gemini/gemini-2.5-flash-lite",
  latency_ms: 342,
  input_tokens: 15,
  output_tokens: 8,
  key_id: "key_1",
  fallback_attempts: 0,
};

const cacheMetadata: ReplyMetadata = {
  resolution_source: "LLM_CACHE",
  model: "gemini/gemini-2.5-flash-lite",
  latency_ms: 4,
  input_tokens: 15,
  output_tokens: 8,
  key_id: null,
  fallback_attempts: 0,
};

const fallbackMetadata: ReplyMetadata = {
  resolution_source: "LIVE_INFERENCE",
  model: "groq/llama-3.1-8b-instant",
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
    expect(screen.getByTestId("metadata-source")).toBeInTheDocument();
    expect(screen.getByTestId("metadata-model")).toBeInTheDocument();
    expect(screen.getByTestId("metadata-latency")).toBeInTheDocument();
    expect(screen.getByTestId("metadata-tokens")).toBeInTheDocument();
    expect(screen.getByTestId("metadata-key")).toBeInTheDocument();
    expect(screen.getByTestId("metadata-fallback")).toBeInTheDocument();
  });

  it("shows LIVE_INFERENCE source", () => {
    render(<AssistantMessage content="hi" metadata={liveMetadata} />);
    expect(screen.getByTestId("metadata-source").textContent).toContain("live");
  });

  it("shows LLM_CACHE source", () => {
    render(<AssistantMessage content="hi" metadata={cacheMetadata} />);
    expect(screen.getByTestId("metadata-source").textContent).toContain("cache");
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

  it("shows latency_ms", () => {
    render(<AssistantMessage content="hi" metadata={liveMetadata} />);
    expect(screen.getByTestId("metadata-latency").textContent).toContain("342");
  });

  it("shows token counts", () => {
    render(<AssistantMessage content="hi" metadata={liveMetadata} />);
    const tokenEl = screen.getByTestId("metadata-tokens");
    expect(tokenEl.textContent).toContain("15");
    expect(tokenEl.textContent).toContain("8");
  });

  it("renders reply content", () => {
    render(<AssistantMessage content="The answer is 42" metadata={liveMetadata} />);
    expect(screen.getByTestId("assistant-message").textContent).toContain("The answer is 42");
  });
});
