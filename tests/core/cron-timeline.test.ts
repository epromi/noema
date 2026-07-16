import { describe, it, expect } from "vitest";
import { buildCronTimeline } from "$lib/core/cron-timeline";
import type { CronEntry } from "$lib/types";

function makeCron(overrides: Partial<CronEntry> = {}): CronEntry {
  return {
    id: "c1",
    name: "Test Cron",
    agentId: "system",
    schedule: "02:00 daily",
    group: "NIGHT",
    lastResult: "ok",
    enabled: true,
    consecutiveErrors: 0,
    ...overrides,
  };
}

describe("cron-timeline", () => {
  const now = new Date("2026-07-16T18:00:00Z").getTime();
  const dayMs = 24 * 3600_000;

  it("returns one row per cron sorted by name", () => {
    const data = buildCronTimeline(
      [makeCron({ id: "b", name: "Bravo" }), makeCron({ id: "a", name: "Alpha" })],
      now,
    );
    expect(data.rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(data.windowStartMs).toBe(now - dayMs);
    expect(data.windowEndMs).toBe(now);
    expect(data.updatedAt).toBeGreaterThan(0);
  });

  it("creates an ok block for a healthy cron that ran within the window", () => {
    const lastRunAtMs = now - 3600_000;
    const data = buildCronTimeline(
      [makeCron({ lastResult: "ok", lastRunAtMs })],
      now,
    );
    expect(data.rows[0]?.blocks).toHaveLength(1);
    const block = data.rows[0]!.blocks[0]!;
    expect(block.status).toBe("ok");
    expect(block.startMs).toBe(lastRunAtMs);
    expect(block.endMs).toBeGreaterThan(block.startMs);
    expect(block.label).toContain("Test Cron");
  });

  it("creates an error block for a failing cron", () => {
    const data = buildCronTimeline(
      [
        makeCron({
          lastResult: "error",
          lastRunAtMs: now - 1000,
          consecutiveErrors: 2,
        }),
      ],
      now,
    );
    expect(data.rows[0]?.blocks[0]?.status).toBe("error");
  });

  it("marks disabled crons as skipped regardless of lastResult", () => {
    const data = buildCronTimeline(
      [makeCron({ enabled: false, lastResult: "ok", lastRunAtMs: now - 1000 })],
      now,
    );
    expect(data.rows[0]?.blocks[0]?.status).toBe("skipped");
  });

  it("falls back to unknown status for unrecognized lastResult values", () => {
    const data = buildCronTimeline(
      [makeCron({ lastResult: "queued", lastRunAtMs: now - 1000 })],
      now,
    );
    expect(data.rows[0]?.blocks[0]?.status).toBe("unknown");
  });

  it("omits blocks when lastRunAtMs is missing", () => {
    const data = buildCronTimeline([makeCron({ lastRunAtMs: undefined })], now);
    expect(data.rows[0]?.blocks).toEqual([]);
  });

  it("omits blocks when lastRunAtMs falls outside the 24h window", () => {
    const data = buildCronTimeline(
      [makeCron({ lastRunAtMs: now - dayMs - 3600_000 })],
      now,
    );
    expect(data.rows[0]?.blocks).toEqual([]);
  });

  it("clamps a block's end time to the window end", () => {
    const data = buildCronTimeline(
      [makeCron({ lastRunAtMs: now - 1000 })],
      now,
    );
    expect(data.rows[0]?.blocks[0]?.endMs).toBeLessThanOrEqual(now);
  });

  it("returns an empty row set for no crons", () => {
    const data = buildCronTimeline([], now);
    expect(data.rows).toEqual([]);
    expect(data.error).toBeUndefined();
  });

  it("supports a custom window size", () => {
    const lastRunAtMs = now - 5 * 3600_000;
    const data = buildCronTimeline([makeCron({ lastRunAtMs })], now, 4);
    expect(data.windowStartMs).toBe(now - 4 * 3600_000);
    expect(data.rows[0]?.blocks).toEqual([]);
  });

  it("returns an error payload if given malformed input", () => {
    // @ts-expect-error — intentionally invalid input to exercise the catch path
    const data = buildCronTimeline(null, now);
    expect(data.rows).toEqual([]);
    expect(data.error).toBeDefined();
  });
});
