import { describe, it, expect } from "vitest";
import {
  buildCronSidebarRows,
  getCronEmoji,
  getCronStatus,
  refreshCronSidebarData,
  shortenCronName,
} from "$lib/core/cron-sidebar";
import type { CronEntry } from "$lib/types";

const sampleCrons: CronEntry[] = [
  {
    id: "cron-1",
    name: "Daytime Fact Sync",
    agentId: "alfred",
    schedule: "17:00 daily",
    group: "DAYTIME",
    lastResult: "ok",
    enabled: true,
    consecutiveErrors: 0,
  },
  {
    id: "cron-2",
    name: "Nightly Backup",
    agentId: "otto",
    schedule: "23:05 daily",
    group: "EVENING",
    lastResult: "error",
    enabled: true,
    consecutiveErrors: 2,
  },
  {
    id: "cron-3",
    name: "Disabled Job",
    agentId: "system",
    schedule: "12:00 daily",
    group: "DAYTIME",
    lastResult: "ok",
    enabled: false,
    consecutiveErrors: 0,
  },
];

describe("cron-sidebar", () => {
  it("getCronEmoji maps known agents", () => {
    expect(getCronEmoji("alfred")).toBe("👔");
    expect(getCronEmoji("unknown")).toBe("🤖");
  });

  it("getCronStatus maps health states", () => {
    expect(getCronStatus("ok", 0)).toBe("ok");
    expect(getCronStatus("error", 0)).toBe("error");
    expect(getCronStatus("unknown", 1)).toBe("error");
    expect(getCronStatus("skipped", 0)).toBe("warning");
  });

  it("shortenCronName truncates long names", () => {
    expect(shortenCronName("Short")).toBe("Short");
    expect(shortenCronName("A very long cron job name here")).toBe(
      "A very long cron job …",
    );
  });

  it("buildCronSidebarRows includes enabled crons and NOW marker", () => {
    const now = new Date("2026-07-05T16:57:00");
    const data = buildCronSidebarRows(sampleCrons, now);

    expect(data.rows.some((r) => r.kind === "now")).toBe(true);
    expect(data.rows.filter((r) => r.kind === "cron")).toHaveLength(2);
    expect(data.clockLabel).toBe("16:57:00");
    expect(data.nextCronId).toBe("cron-1");
  });

  it("buildCronSidebarRows marks next cron and statuses", () => {
    const now = new Date("2026-07-05T16:57:00");
    const data = buildCronSidebarRows(sampleCrons, now);
    const cronRows = data.rows.filter((r) => r.kind === "cron");

    const next = cronRows.find((r) => r.id === "cron-1");
    expect(next?.isNext).toBe(true);
    expect(next?.status).toBe("ok");
    expect(next?.countdown).toBe("in 3m");

    const evening = cronRows.find((r) => r.id === "cron-2");
    expect(evening?.status).toBe("error");
  });

  it("refreshCronSidebarData updates countdowns", () => {
    const start = new Date("2026-07-05T16:57:00");
    const initial = buildCronSidebarRows(sampleCrons, start);
    const later = new Date("2026-07-05T16:58:30");
    const refreshed = refreshCronSidebarData(initial, later);

    const cronRow = refreshed.rows.find(
      (r): r is Extract<typeof r, { kind: "cron" }> =>
        r.kind === "cron" && r.id === "cron-1",
    );
    expect(cronRow?.countdown).toBe("in 1m");
    expect(refreshed.clockLabel).toBe("16:58:30");
  });
});
