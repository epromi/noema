import { getAllData, getDevPackages } from "$lib/core";
import { getProvider } from "$lib/providers";
import type {
  AgentData,
  BillsData,
  CalendarData,
  CronData,
  DashboardData,
  DevPackagesData,
  H1Data,
  HealthData,
  NoemaData,
  ResearchData,
  ActionQueueData,
  BrainstormData,
  LogData,
  AuditTrailData,
} from "$lib/types";
import type { PageServerLoad } from "./$types";

function emptyCrons(): CronData {
  return {
    crons: [],
    healthy: 0,
    total: 0,
    byGroup: {
      NIGHT: { total: 0, healthy: 0 },
      MORNING: { total: 0, healthy: 0 },
      DAYTIME: { total: 0, healthy: 0 },
      EVENING: { total: 0, healthy: 0 },
      SPANNING: { total: 0, healthy: 0 },
    },
    updatedAt: Date.now(),
    error: "No data",
  };
}

function emptyAgents(): AgentData {
  return {
    agents: [],
    online: 0,
    total: 0,
    stale: 0,
    updatedAt: Date.now(),
    error: "No data",
  };
}

function emptyHealth(): HealthData {
  return {
    uptime: "N/A",
    disk: "N/A",
    ram: "N/A",
    gatewayStatus: "unknown",
    heartbeat: [],
    hookState: {},
    modelMappingAge: 999,
    updatedAt: Date.now(),
    error: "No data",
  };
}

function emptyH1(): H1Data {
  return {
    stats: {
      open: "N/A",
      signal: "N/A",
      reputation: "N/A",
      trial: "N/A",
      totalReports: 0,
      resolved: 0,
      duplicates: 0,
      pending: 0,
      notApplicable: 0,
    },
    balance: "N/A",
    balanceAmount: 0,
    programs: "N/A",
    programList: [],
    reports: [],
    signal: { signal: "N/A", reputation: "N/A", trial: "N/A" },
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
    updatedAt: Date.now(),
    error: "No data",
  };
}

function emptyCalendar(): CalendarData {
  return { events: [], upcoming: 0, updatedAt: Date.now(), error: "No data" };
}

function emptyBills(): BillsData {
  return { bills: [], openLoops: [], updatedAt: Date.now(), error: "No data" };
}

function emptyResearch(): ResearchData {
  return {
    totalFiles: 0,
    recentFiles: 0,
    latestDate: "N/A",
    proposals: [],
    autoFixCount: 0,
    proposeCount: 0,
    ottoRuns: [],
    updatedAt: Date.now(),
    error: "No data",
  };
}

function emptyActionQueue(): ActionQueueData {
  return {
    auto: [],
    alfred: [],
    andras: [],
    updatedAt: Date.now(),
    error: "No data",
  };
}

function emptyBrainstorm(): BrainstormData {
  return {
    sections: [],
    pending: 0,
    updatedAt: Date.now(),
    error: "No data",
  };
}

function emptyNoema(): NoemaData {
  return {
    metrics: {
      healthScore: 0,
      cronsHealthy: 0,
      cronsTotal: 0,
      totalLoc: 0,
      activeProposals: 0,
    },
    changelog: "",
    architecture: "",
    updatedAt: Date.now(),
    error: "No data",
  };
}

function emptyDevPackages(): DevPackagesData {
  return { packages: [], updatedAt: Date.now(), error: "No data" };
}

function emptyLogs(): LogData {
  return {
    entries: [],
    total: 0,
    counts: { error: 0, warn: 0, info: 0, other: 0 },
    updatedAt: Date.now(),
    error: "No data",
  };
}

function emptyAuditTrail(): AuditTrailData {
  return {
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
    updatedAt: Date.now(),
    error: "No data",
  };
}

/** Ensure every core module section is present and arrays are never null. */
function validatePageData(data: Partial<DashboardData>): DashboardData {
  const crons = data.crons ?? emptyCrons();
  const agents = data.agents ?? emptyAgents();

  return {
    meta: data.meta ?? { loadedAt: Date.now() },
    crons: {
      ...crons,
      crons: crons.crons ?? [],
    },
    agents: {
      ...agents,
      agents: agents.agents ?? [],
    },
    health: data.health ?? emptyHealth(),
    h1: {
      ...(data.h1 ?? emptyH1()),
      programList: data.h1?.programList ?? [],
      reports: data.h1?.reports ?? [],
    },
    calendar: {
      ...(data.calendar ?? emptyCalendar()),
      events: data.calendar?.events ?? [],
    },
    bills: {
      ...(data.bills ?? emptyBills()),
      bills: data.bills?.bills ?? [],
      openLoops: data.bills?.openLoops ?? [],
    },
    research: {
      ...(data.research ?? emptyResearch()),
      proposals: data.research?.proposals ?? [],
      ottoRuns: data.research?.ottoRuns ?? [],
    },
    brainstorm: {
      ...(data.brainstorm ?? emptyBrainstorm()),
      sections: data.brainstorm?.sections ?? [],
    },
    noema: data.noema ?? emptyNoema(),
    actionQueue: {
      ...(data.actionQueue ?? emptyActionQueue()),
      auto: data.actionQueue?.auto ?? [],
      alfred: data.actionQueue?.alfred ?? [],
      andras: data.actionQueue?.andras ?? [],
    },
    logs: {
      ...(data.logs ?? emptyLogs()),
      entries: data.logs?.entries ?? [],
    },
    auditTrail: {
      ...(data.auditTrail ?? emptyAuditTrail()),
      events: data.auditTrail?.events ?? [],
      sessions: data.auditTrail?.sessions ?? [],
      agents: data.auditTrail?.agents ?? [],
    },
  };
}

export const load: PageServerLoad = async () => {
  const providers = getProvider();

  const [dashboard, devPackages, hostnameRaw] = await Promise.all([
    getAllData(providers),
    getDevPackages(providers),
    providers.tool
      .execCommand('hostname 2>/dev/null || echo "N/A"')
      .catch(() => "N/A"),
  ]);

  const validated = validatePageData(dashboard);
  const devPackagesSafe = devPackages ?? emptyDevPackages();

  return {
    ...validated,
    devPackages: {
      ...devPackagesSafe,
      packages: devPackagesSafe.packages ?? [],
    },
    hostname: hostnameRaw.trim() || "N/A",
  };
};
