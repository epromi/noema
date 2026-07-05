import { describe, it, expect } from "vitest";
import {
  computeNextRun,
  formatClock,
  formatCountdown,
  formatLastRunMs,
  isSpanningSched,
  parseDisplayMinutes,
  parseLastRun,
} from "$lib/core/cron-schedule";

describe("cron-schedule", () => {
  it("parseDisplayMinutes handles common formats", () => {
    expect(parseDisplayMinutes("01:30 daily")).toBe(90);
    expect(parseDisplayMinutes("06-23 hourly")).toBe(360);
    expect(parseDisplayMinutes("12,15,18,21")).toBe(720);
    expect(parseDisplayMinutes("auto")).toBeNull();
    expect(parseDisplayMinutes(null)).toBeNull();
  });

  it("parseLastRun parses ISO and display formats", () => {
    expect(parseLastRun("2026-07-05 12:30")?.getHours()).toBe(12);
    expect(parseLastRun("07-05 14:00")?.getMinutes()).toBe(0);
    expect(parseLastRun("—")).toBeNull();
  });

  it("formatLastRunMs formats epoch to string", () => {
    const ms = new Date("2026-07-05T12:30:00").getTime();
    expect(formatLastRunMs(ms)).toBe("2026-07-05 12:30");
    expect(formatLastRunMs(undefined)).toBeNull();
  });

  it("isSpanningSched detects range and multi-time schedules", () => {
    expect(isSpanningSched("06-23 hourly")).toBe(true);
    expect(isSpanningSched("12,15,18,21")).toBe(true);
    expect(isSpanningSched("every 2h")).toBe(true);
    expect(isSpanningSched("01:30 daily")).toBe(false);
    expect(isSpanningSched("auto")).toBe(false);
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
    const afterRange = new Date("2026-07-05T23:30:00");
    expect(computeNextRun("06-23 hourly", null, afterRange)).toBe(
      new Date("2026-07-06T06:00:00").getTime(),
    );
  });

  it("computeNextRun for comma-separated hours", () => {
    const now = new Date("2026-07-05T16:00:00");
    expect(computeNextRun("12,15,18,21", null, now)).toBe(
      new Date("2026-07-05T18:00:00").getTime(),
    );
  });

  it("computeNextRun for weekday schedule", () => {
    const tue = new Date("2026-07-07T10:00:00");
    const next = computeNextRun("15:30 Tue", null, tue);
    expect(next).toBe(new Date("2026-07-07T15:30:00").getTime());
  });

  it("computeNextRun for every N hours with last run", () => {
    const now = new Date("2026-07-05T14:29:00");
    const next = computeNextRun("every 2h", "2026-07-05 12:30", now);
    expect(next).toBe(new Date("2026-07-05T14:30:00").getTime());
  });

  it("computeNextRun for plus-separated times", () => {
    const now = new Date("2026-07-05T16:00:00");
    const next = computeNextRun("03:00 + 03:35", null, now);
    expect(next).toBe(new Date("2026-07-06T03:00:00").getTime());
  });

  it("computeNextRun for interval days", () => {
    const now = new Date("2026-07-05T16:00:00");
    const next = computeNextRun("08:00 /2d", "2026-07-03 08:00", now);
    expect(next).toBe(new Date("2026-07-07T08:00:00").getTime());
  });

  it("computeNextRun returns null for auto and empty", () => {
    expect(computeNextRun("auto", null, new Date())).toBeNull();
    expect(computeNextRun("—", null, new Date())).toBeNull();
    expect(computeNextRun(null, null, new Date())).toBeNull();
  });

  it("formatCountdown formats remaining time", () => {
    const now = Date.now();
    expect(formatCountdown(now + 28 * 60_000, now)).toBe("in 28m");
    expect(formatCountdown(now + 90 * 60_000, now)).toBe("in 1h 30m");
    expect(formatCountdown(now - 1000, now)).toBe("overdue");
    expect(formatCountdown(null, now)).toBe("—");
  });

  it("formatClock returns HH:MM:SS", () => {
    expect(formatClock(new Date("2026-07-05T16:57:03"))).toBe("16:57:03");
  });
});
