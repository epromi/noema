import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_RELAY_URL,
  getDevJobStatus,
  formatDevJobCountdown,
  getDevJobIndicatorState,
  type DevJobIndicatorState,
  type DevJobCountdown,
} from "$lib/core/noema-devjob";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(responses: Record<string, unknown>) {
  return vi.fn(async (url: string | URL | Request) => {
    const path = String(url).split("/").pop() ?? "";
    const body = responses[path];
    if (body === undefined) {
      throw new Error(`unexpected fetch: ${String(url)}`);
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  });
}

function mockFetchWithStatus(
  pathStatus: Record<string, { ok: boolean; status: number; json: unknown }>,
) {
  return vi.fn(async (url: string | URL | Request) => {
    const path = String(url).split("/").pop() ?? "";
    const entry = pathStatus[path];
    if (!entry) throw new Error(`unexpected fetch: ${String(url)}`);
    return {
      ok: entry.ok,
      status: entry.status,
      json: async () => entry.json,
    } as Response;
  });
}

// ---------------------------------------------------------------------------
// DEFAULT_RELAY_URL
// ---------------------------------------------------------------------------

describe("DEFAULT_RELAY_URL", () => {
  it("is the expected localhost relay address", () => {
    expect(DEFAULT_RELAY_URL).toBe("/api");
  });
});

// ---------------------------------------------------------------------------
// getDevJobStatus
// ---------------------------------------------------------------------------

describe("getDevJobStatus", () => {
  it("merges next-trigger and running responses", async () => {
    const fetchFn = mockFetch({
      "next-trigger": { nextMs: 154_000, queue: 2 },
      running: { running: "PKG-022-cron-sidebar" },
    });

    const status = await getDevJobStatus("http://127.0.0.1:18998", fetchFn);

    expect(status.nextMs).toBe(154_000);
    expect(status.queue).toBe(2);
    expect(status.running).toBe("PKG-022-cron-sidebar");
    expect(status.error).toBeUndefined();
    expect(status.updatedAt).toBeGreaterThan(0);
  });

  it("returns offline fallback when fetch rejects", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    const status = await getDevJobStatus("http://127.0.0.1:18998", fetchFn);

    expect(status).toEqual({
      nextMs: 0,
      queue: 0,
      running: null,
      updatedAt: expect.any(Number),
      error: "offline",
    });
  });

  it("returns offline fallback when next-trigger response is not ok", async () => {
    const fetchFn = mockFetchWithStatus({
      "next-trigger": {
        ok: false,
        status: 500,
        json: {},
      },
      running: {
        ok: true,
        status: 200,
        json: { running: "PKG-001" },
      },
    });

    const status = await getDevJobStatus("http://127.0.0.1:18998", fetchFn);

    expect(status.error).toBe("offline");
    expect(status.nextMs).toBe(0);
    expect(status.queue).toBe(0);
    expect(status.running).toBeNull();
  });

  it("returns offline fallback when running response is not ok", async () => {
    const fetchFn = mockFetchWithStatus({
      "next-trigger": {
        ok: true,
        status: 200,
        json: { nextMs: 5000, queue: 1 },
      },
      running: {
        ok: false,
        status: 503,
        json: {},
      },
    });

    const status = await getDevJobStatus("http://127.0.0.1:18998", fetchFn);

    expect(status.error).toBe("offline");
  });

  it("defaults missing nextMs and queue to 0", async () => {
    const fetchFn = mockFetch({
      "next-trigger": {},
      running: { running: null },
    });

    const status = await getDevJobStatus("http://127.0.0.1:18998", fetchFn);

    expect(status.nextMs).toBe(0);
    expect(status.queue).toBe(0);
    expect(status.running).toBeNull();
    expect(status.error).toBeUndefined();
  });

  it("uses the default relay URL when none provided", async () => {
    const fetchFn = mockFetch({
      "next-trigger": { nextMs: 10_000, queue: 0 },
      running: { running: null },
    });

    // Override globalThis.fetch for this test
    const status = await getDevJobStatus(
      undefined as unknown as string,
      fetchFn,
    );

    expect(status.nextMs).toBe(10_000);
  });
});

// ---------------------------------------------------------------------------
// formatDevJobCountdown
// ---------------------------------------------------------------------------

describe("formatDevJobCountdown", () => {
  it("renders MM:SS countdown", () => {
    const now = 1_000_000;
    const result = formatDevJobCountdown(now + 154_000, false, now);

    expect(result.text).toBe("02:34");
    expect(result.soon).toBe(false);
    expect(result.expired).toBe(false);
  });

  it("marks soon state under one minute", () => {
    const now = 1_000_000;
    const result = formatDevJobCountdown(now + 45_000, false, now);

    expect(result.text).toBe("00:45");
    expect(result.soon).toBe(true);
    expect(result.expired).toBe(false);
  });

  it("shows offline label when offline flag is set", () => {
    const result = formatDevJobCountdown(0, true);

    expect(result.text).toBe("offline");
    expect(result.soon).toBe(false);
    expect(result.expired).toBe(false);
  });

  it("returns dash when nextMs is zero or negative", () => {
    const result = formatDevJobCountdown(0, false);

    expect(result.text).toBe("—");
    expect(result.soon).toBe(false);
    expect(result.expired).toBe(false);
  });

  it("returns dash when nextMs is negative", () => {
    const result = formatDevJobCountdown(-1, false);

    expect(result.text).toBe("—");
  });

  it("shows expired state when diff is zero or negative", () => {
    const now = 1_000_000;
    const result = formatDevJobCountdown(now, false, now);

    expect(result.text).toBe("most...");
    expect(result.soon).toBe(true);
    expect(result.expired).toBe(true);
  });

  it("shows expired state when already past", () => {
    const now = 2_000_000;
    const result = formatDevJobCountdown(1_000_000, false, now);

    expect(result.text).toBe("most...");
    expect(result.soon).toBe(true);
    expect(result.expired).toBe(true);
  });

  it("shows offline even when nextMs is set", () => {
    const result = formatDevJobCountdown(1_000_000, true);

    expect(result.text).toBe("offline");
  });

  it("formats seconds with padding under 10", () => {
    const now = 0;
    const result = formatDevJobCountdown(9_000, false, now);

    expect(result.text).toBe("00:09");
  });

  it("formats exactly 1 minute", () => {
    const now = 0;
    const result = formatDevJobCountdown(60_000, false, now);

    expect(result.text).toBe("01:00");
    expect(result.soon).toBe(false); // not < 60000
  });

  it("formats exactly 59 seconds as soon", () => {
    const now = 0;
    const result = formatDevJobCountdown(59_000, false, now);

    expect(result.soon).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getDevJobIndicatorState
// ---------------------------------------------------------------------------

describe("getDevJobIndicatorState", () => {
  const baseStatus = {
    nextMs: 0,
    queue: 0,
    running: null as string | null,
    updatedAt: Date.now(),
  };

  it("is offline when error is set", () => {
    expect(getDevJobIndicatorState({ ...baseStatus, error: "offline" })).toBe(
      "offline",
    );
  });

  it("is active when a package is running", () => {
    expect(
      getDevJobIndicatorState({
        ...baseStatus,
        running: "PKG-026-dev-job-indicator",
      }),
    ).toBe("active");
  });

  it("is active even when nextMs is close", () => {
    // running takes priority over soon
    const now = Date.now();
    expect(
      getDevJobIndicatorState(
        {
          nextMs: now + 30_000,
          queue: 1,
          running: "PKG-001",
          updatedAt: now,
        },
        now,
      ),
    ).toBe("active");
  });

  it("is soon when next run is under one minute", () => {
    const now = Date.now();
    expect(
      getDevJobIndicatorState(
        {
          ...baseStatus,
          nextMs: now + 30_000,
        },
        now,
      ),
    ).toBe("soon");
  });

  it("is soon when nextMs is exactly 59999 ms away", () => {
    const now = Date.now();
    expect(
      getDevJobIndicatorState(
        {
          ...baseStatus,
          nextMs: now + 59_999,
        },
        now,
      ),
    ).toBe("soon");
  });

  it("is idle when nextMs is exactly 60000 ms away", () => {
    const now = Date.now();
    expect(
      getDevJobIndicatorState(
        {
          ...baseStatus,
          nextMs: now + 60_000,
        },
        now,
      ),
    ).toBe("idle");
  });

  it("is idle when no running, no error, and nextMs is far", () => {
    const now = Date.now();
    expect(
      getDevJobIndicatorState(
        {
          ...baseStatus,
          nextMs: now + 120_000,
        },
        now,
      ),
    ).toBe("idle");
  });

  it("is idle when nextMs is 0 and no running, no error", () => {
    expect(getDevJobIndicatorState(baseStatus)).toBe("idle");
  });

  it("uses Date.now() as default for now parameter", () => {
    // Just verify it doesn't throw
    const state = getDevJobIndicatorState({
      ...baseStatus,
      nextMs: Date.now() + 120_000,
    });
    expect(state).toBe("idle");
  });
});
