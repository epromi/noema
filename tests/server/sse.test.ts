import { describe, it, expect, beforeEach } from "vitest";
import type { DashboardData } from "$lib/types";
import {
  addClient,
  broadcast,
  clearClients,
  getClientCount,
} from "$lib/server/sse";
import { clearCache, getCache, setCache } from "$lib/server/cache";

function minimalDashboardData(): DashboardData {
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
      uptime: "N/A",
      disk: "N/A",
      ram: "N/A",
      gatewayStatus: "unknown",
      heartbeat: [],
      hookState: {},
      modelMappingAge: 0,
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
  };
}

describe("sse", () => {
  beforeEach(() => {
    clearClients();
    clearCache();
  });

  it("addClient registers and unsubscribes cleanly", () => {
    const received: DashboardData[] = [];
    const unsubscribe = addClient((data) => received.push(data));

    expect(getClientCount()).toBe(1);

    const payload = minimalDashboardData();
    broadcast(payload);
    expect(received).toHaveLength(1);
    expect(received[0]?.meta.loadedAt).toBe(payload.meta.loadedAt);

    unsubscribe();
    expect(getClientCount()).toBe(0);

    broadcast(payload);
    expect(received).toHaveLength(1);
  });

  it("broadcast removes clients that throw", () => {
    addClient(() => {
      throw new Error("broken client");
    });
    addClient(() => {});

    expect(getClientCount()).toBe(2);

    broadcast(minimalDashboardData());
    expect(getClientCount()).toBe(1);
  });

  it("cache stores and returns latest dashboard snapshot", () => {
    expect(getCache()).toBeNull();

    const first = minimalDashboardData();
    setCache(first);
    expect(getCache()?.meta.loadedAt).toBe(first.meta.loadedAt);

    const second = {
      ...first,
      meta: { loadedAt: first.meta.loadedAt + 1000 },
    };
    setCache(second);
    expect(getCache()?.meta.loadedAt).toBe(second.meta.loadedAt);
  });

  it("supports reconnect by re-registering after unsubscribe", () => {
    const firstClient: DashboardData[] = [];
    const secondClient: DashboardData[] = [];

    const unsubscribe = addClient((data) => firstClient.push(data));
    broadcast(minimalDashboardData());
    unsubscribe();

    addClient((data) => secondClient.push(data));
    broadcast(minimalDashboardData());

    expect(firstClient).toHaveLength(1);
    expect(secondClient).toHaveLength(1);
    expect(getClientCount()).toBe(1);
  });
});
