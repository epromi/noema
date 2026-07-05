import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseDisplayMinutes,
  computeNextRun,
  formatCountdown,
  isSpanningSched,
  cronPeriod,
} = require("../lib/cron-schedule.cjs");

describe("cron-schedule", () => {
  it("parseDisplayMinutes handles common formats", () => {
    expect(parseDisplayMinutes("01:30 daily")).toBe(90);
    expect(parseDisplayMinutes("06-23 hourly")).toBe(360);
    expect(parseDisplayMinutes("12,15,18,21")).toBe(720);
    expect(parseDisplayMinutes("auto")).toBeNull();
  });

  it("isSpanningSched detects range and multi-time schedules", () => {
    expect(isSpanningSched("06-23 hourly")).toBe(true);
    expect(isSpanningSched("12,15,18,21")).toBe(true);
    expect(isSpanningSched("every 2h")).toBe(true);
    expect(isSpanningSched("01:30 daily")).toBe(false);
  });

  it("computeNextRun for daily fixed time", () => {
    const now = new Date("2026-07-05T16:00:00");
    const next = computeNextRun("17:00 daily", null, now);
    expect(next).toBe(new Date("2026-07-05T17:00:00").getTime());
    const past = computeNextRun("01:30 daily", null, now);
    expect(past).toBe(new Date("2026-07-06T01:30:00").getTime());
  });

  it("computeNextRun for hourly range", () => {
    const now = new Date("2026-07-05T16:32:00");
    const next = computeNextRun("06-23 hourly", null, now);
    expect(next).toBe(new Date("2026-07-05T17:00:00").getTime());
    const before = new Date("2026-07-05T05:00:00");
    expect(computeNextRun("06-23 hourly", null, before)).toBe(
      new Date("2026-07-05T06:00:00").getTime(),
    );
  });

  it("computeNextRun for comma-separated hours", () => {
    const now = new Date("2026-07-05T16:00:00");
    expect(computeNextRun("12,15,18,21", null, now)).toBe(
      new Date("2026-07-05T18:00:00").getTime(),
    );
  });

  it("computeNextRun for weekday schedule", () => {
    const tue = new Date("2026-07-07T10:00:00"); // Tuesday
    const next = computeNextRun("15:30 Tue", null, tue);
    expect(next).toBe(new Date("2026-07-07T15:30:00").getTime());
  });

  it("computeNextRun for every N hours with last run", () => {
    const now = new Date("2026-07-05T14:29:00");
    const next = computeNextRun("every 2h", "2026-07-05 12:30", now);
    expect(next).toBe(new Date("2026-07-05T14:30:00").getTime());
  });

  it("computeNextRun returns null for auto", () => {
    expect(computeNextRun("auto", null, new Date())).toBeNull();
  });

  it("formatCountdown formats remaining time", () => {
    const now = Date.now();
    expect(formatCountdown(now + 28 * 60000, now)).toBe("in 28m");
    expect(formatCountdown(now + 90 * 60000, now)).toBe("in 1h 30m");
  });

  it("cronPeriod assigns day sections", () => {
    expect(cronPeriod(90)).toBe("night");
    expect(cronPeriod(420)).toBe("morning");
    expect(cronPeriod(600)).toBe("day");
    expect(cronPeriod(1200)).toBe("evening");
  });
});
