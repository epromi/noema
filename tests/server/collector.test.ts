import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startCollector, stopCollector, collectOnce, COLLECT_INTERVAL_MS } from "$lib/server/collector";

describe("collector", () => {
  afterEach(() => {
    stopCollector();
  });

  it("exports a COLLECT_INTERVAL_MS constant", () => {
    expect(COLLECT_INTERVAL_MS).toBe(60_000);
  });

  it("startCollector is idempotent — calling twice does not throw", () => {
    startCollector();
    startCollector(); // should not throw or create duplicate interval
    expect(() => stopCollector()).not.toThrow();
  });

  it("stopCollector clears interval safely when not started", () => {
    expect(() => stopCollector()).not.toThrow();
  });

  it("collectOnce is callable and returns a Promise", () => {
    const p = collectOnce();
    expect(p).toBeInstanceOf(Promise);
  }, 10_000);
});
