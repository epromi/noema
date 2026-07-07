import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockWatch = vi.fn();
const mockCollectOnce = vi.fn();
const closeFns: Array<ReturnType<typeof vi.fn>> = [];

vi.mock("node:fs", () => ({
  watch: (...args: unknown[]) => mockWatch(...args),
}));

vi.mock("$lib/server/collector", () => ({
  collectOnce: (...args: unknown[]) => mockCollectOnce(...args),
}));

import {
  PKG_DEBOUNCE_MS,
  isRelevantPkgChange,
  startPkgWatcher,
  stopPkgWatcher,
} from "$lib/server/pkg-watcher";

type WatchListener = (event: string, filename: string | null) => void;

function extractListener(...args: unknown[]): WatchListener {
  const last = args[args.length - 1];
  if (typeof last === "function") return last as WatchListener;
  throw new Error("expected watch listener");
}

describe("pkg-watcher", () => {
  let indexListener: WatchListener;
  let dirListener: WatchListener;

  beforeEach(() => {
    vi.useFakeTimers();
    closeFns.length = 0;
    mockWatch.mockImplementation((path: string, ...rest: unknown[]) => {
      const listener = extractListener(...rest);
      if (String(path).endsWith("INDEX.md")) {
        indexListener = listener;
      } else {
        dirListener = listener;
      }
      const close = vi.fn();
      closeFns.push(close);
      return { close };
    });
    mockCollectOnce.mockResolvedValue({});
  });

  afterEach(() => {
    stopPkgWatcher();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("exports PKG_DEBOUNCE_MS as 500", () => {
    expect(PKG_DEBOUNCE_MS).toBe(500);
  });

  describe("isRelevantPkgChange", () => {
    it("accepts INDEX.md and markdown/json files", () => {
      expect(isRelevantPkgChange("INDEX.md")).toBe(true);
      expect(isRelevantPkgChange("spec.md")).toBe(true);
      expect(isRelevantPkgChange("todo.json")).toBe(true);
    });

    it("rejects null and unrelated filenames", () => {
      expect(isRelevantPkgChange(null)).toBe(false);
      expect(isRelevantPkgChange("generate.cjs")).toBe(false);
      expect(isRelevantPkgChange("PKG-037")).toBe(false);
    });
  });

  it("startPkgWatcher is idempotent", () => {
    startPkgWatcher();
    startPkgWatcher();
    expect(mockWatch).toHaveBeenCalledTimes(2);
  });

  it("watches INDEX.md and dev/packages directory", () => {
    startPkgWatcher();
    const paths = mockWatch.mock.calls.map((call) => String(call[0]));
    expect(paths.some((p) => p.endsWith("INDEX.md"))).toBe(true);
    expect(paths.some((p) => p.endsWith("dev/packages"))).toBe(true);
    expect(mockWatch.mock.calls[1]?.[1]).toEqual({ recursive: false });
  });

  it("debounces multiple changes into one collectOnce", async () => {
    startPkgWatcher();
    indexListener("change", "INDEX.md");
    dirListener("change", "spec.md");
    indexListener("change", "INDEX.md");

    expect(mockCollectOnce).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(PKG_DEBOUNCE_MS);
    expect(mockCollectOnce).toHaveBeenCalledTimes(1);
  });

  it("ignores irrelevant file changes", async () => {
    startPkgWatcher();
    dirListener("change", "generate.cjs");
    await vi.advanceTimersByTimeAsync(PKG_DEBOUNCE_MS);
    expect(mockCollectOnce).not.toHaveBeenCalled();
  });

  it("collectOnce errors are swallowed", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCollectOnce.mockRejectedValue(new Error("collect failed"));
    startPkgWatcher();
    indexListener("change", "INDEX.md");
    await vi.advanceTimersByTimeAsync(PKG_DEBOUNCE_MS);
    await vi.waitFor(() => {
      expect(errSpy).toHaveBeenCalled();
    });
    errSpy.mockRestore();
  });

  it("start failure does not throw and resets watcher state", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockWatch.mockImplementation(() => {
      throw new Error("fs.watch unavailable");
    });
    expect(() => startPkgWatcher()).not.toThrow();
    expect(errSpy).toHaveBeenCalled();

    mockWatch.mockImplementation((path: string, ...rest: unknown[]) => {
      const listener = extractListener(...rest);
      if (String(path).endsWith("INDEX.md")) {
        indexListener = listener;
      } else {
        dirListener = listener;
      }
      const close = vi.fn();
      closeFns.push(close);
      return { close };
    });

    startPkgWatcher();
    expect(mockWatch).toHaveBeenCalledTimes(3);
    errSpy.mockRestore();
  });

  it("stopPkgWatcher closes all watchers and clears debounce", async () => {
    startPkgWatcher();
    indexListener("change", "INDEX.md");
    stopPkgWatcher();
    await vi.advanceTimersByTimeAsync(PKG_DEBOUNCE_MS);
    expect(mockCollectOnce).not.toHaveBeenCalled();
    expect(closeFns.every((close) => close.mock.calls.length === 1)).toBe(true);
  });
});
