import { describe, it, expect, beforeEach } from "vitest";
import { setCache, getCache, getCacheUpdatedAt, clearCache } from "$lib/server/cache";
import type { DashboardData } from "$lib/types";

function makeMockData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    health: { uptime: "2d", disk: "50%", ram: "8G/16G", gatewayStatus: "online", heartbeat: [], hookState: {}, modelMappingAge: 0, updatedAt: Date.now() },
    crons: { sections: [], enabled: true, jobsTotal: 0, jobsEnabled: 0 },
    sessions: [],
    agents: [],
    subagents: [],
    research: { total: 0, open: 0, closed: 0, lastRun: null },
    noema: { devLoop: { packages: [], running: null, stats: { total: 0, active: 0, done: 0, blocked: 0, spec: 0, percent: 0 } }, actionQueue: { columns: [], total: 0 }, brainstorm: { items: [], pending: 0, total: 0 } },
    h1: { balance: 0, stats: { total: 0, new: 0, triaged: 0, resolved: 0, closed: 0, pending: 0 }, signal: 0, reputation: 0, programs: [], viktorStatus: null, recallTrend: [] },
    researchTopics: [],
    logs: { entries: [], filter: "All", errorCount: 0, warningCount: 0 },
    calendar: { events: [], displayDate: "", displayRange: "" },
    bills: { bills: [], openLoops: [] },
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("cache", () => {
  beforeEach(() => {
    clearCache();
  });

  it("starts with no cache", () => {
    expect(getCache()).toBeNull();
  });

  it("stores and returns cached data", () => {
    const data = makeMockData();
    setCache(data);
    const cached = getCache();
    expect(cached).not.toBeNull();
    expect(cached!.health.uptime).toBe("2d");
  });

  it("records updatedAt timestamp on set", () => {
    const before = Date.now();
    setCache(makeMockData());
    const at = getCacheUpdatedAt();
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });

  it("clearCache resets both cache and timestamp", () => {
    setCache(makeMockData());
    clearCache();
    expect(getCache()).toBeNull();
    expect(getCacheUpdatedAt()).toBe(0);
  });
});
