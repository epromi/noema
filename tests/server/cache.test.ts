import { describe, it, expect, beforeEach } from "vitest";
import {
  setCache,
  getCache,
  getCacheUpdatedAt,
  clearCache,
} from "$lib/server/cache";
import type { DashboardData } from "$lib/types";

function makeMockData(overrides: Partial<DashboardData> = {}): DashboardData {
  const now = Date.now();
  const emptyGroup = {
    NIGHT: { total: 0, healthy: 0 },
    MORNING: { total: 0, healthy: 0 },
    DAYTIME: { total: 0, healthy: 0 },
    EVENING: { total: 0, healthy: 0 },
    SPANNING: { total: 0, healthy: 0 },
  };

  return {
    meta: { loadedAt: now },
    crons: {
      crons: [],
      healthy: 0,
      total: 0,
      byGroup: emptyGroup,
      updatedAt: now,
    },
    agents: { agents: [], online: 0, total: 0, stale: 0, updatedAt: now },
    health: {
      uptime: "2d",
      disk: "50%",
      ram: "8G/16G",
      gatewayStatus: "online",
      heartbeat: [],
      hookState: {},
      modelMappingAge: 0,
      updatedAt: now,
    },
    buildIntegrity: {
      ok: true,
      alert: false,
      consecutiveFailures: 0,
      lastCheckAt: now,
      updatedAt: now,
    },
    h1: {
      stats: {
        open: "0",
        signal: "0",
        reputation: "0",
        trial: "0",
        totalReports: 0,
        resolved: 0,
        duplicates: 0,
        pending: 0,
        notApplicable: 0,
      },
      balance: "0",
      balanceAmount: 0,
      programs: "0",
      programList: [],
      reports: [],
      signal: { signal: "0", reputation: "0", trial: "0" },
      viktor: {
        totalCompleted: 0,
        recall: 0,
        h1Submitted: 0,
        h1Accepted: 0,
        activeLabel: "N/A",
        circuit: "N/A",
        pending: 0,
        failed: 0,
        recallTrend: [],
        blindSpots: [],
        pendingRepos: [],
      },
      updatedAt: now,
    },
    calendar: { events: [], upcoming: 0, updatedAt: now },
    bills: { bills: [], openLoops: [], updatedAt: now },
    research: {
      totalFiles: 0,
      recentFiles: 0,
      latestDate: "N/A",
      proposals: [],
      autoFixCount: 0,
      proposeCount: 0,
      ottoRuns: [],
      updatedAt: now,
    },
    brainstorm: { sections: [], pending: 0, updatedAt: now },
    noema: {
      metrics: {
        healthScore: 0,
        cronsHealthy: 0,
        cronsTotal: 0,
        totalLoc: 0,
        activeProposals: 0,
      },
      changelog: "",
      architecture: "",
      updatedAt: now,
    },
    actionQueue: { auto: [], alfred: [], andras: [], updatedAt: now },
    logs: {
      entries: [],
      total: 0,
      counts: { error: 0, warn: 0, info: 0, other: 0 },
      updatedAt: now,
    },
    auditTrail: {
      events: [],
      total: 0,
      sessions: [],
      agents: [],
      counts: {
        SESSION_START: 0,
        AGENT_SPAWN: 0,
        CRON_TRIGGER: 0,
        CRON_COMPLETE: 0,
        ERROR: 0,
        ACTION: 0,
      },
      updatedAt: now,
    },
    decisionTrace: {
      sessions: [],
      traces: {},
      defaultSessionKey: "",
      updatedAt: now,
    },
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
