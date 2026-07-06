import type { AllProviders } from "$lib/providers/types";
import type { DashboardData } from "$lib/types";
import { getProvider } from "$lib/providers";
import { getAgents } from "./agents.js";
import { getBills } from "./bills.js";
import { getCalendar } from "./calendar.js";
import { getCrons } from "./crons.js";
import { getH1Data } from "./h1.js";
import { getHealth } from "./health.js";
import { getNoema, getActionQueue, getBrainstorm } from "./noema.js";
import { getResearch } from "./research.js";
import { getLogs } from "./logs.js";
import { getAuditTrail } from "./audit-trail.js";
import { getDecisionTraceData, getDecisionTrace } from "./decision-trace.js";
import {
  getDevLoopLog,
  getRunningDevLoop,
  getDevPackages,
} from "./dev-loop-log.js";
import {
  computePackageStats,
  filterPackages,
  groupPackages,
  isBlockedPackage,
  isDonePackage,
  phaseIcon,
  truncateName,
} from "./dev-packages.js";
import { getBuildIntegrity } from "./build-integrity.js";

export type { GroupedPackages, PackageStats } from "./dev-packages.js";

export async function getAllData(
  providers?: AllProviders,
): Promise<DashboardData> {
  const p = providers ?? getProvider();
  const [
    crons,
    agents,
    health,
    h1,
    calendar,
    bills,
    research,
    brainstorm,
    noema,
    actionQueue,
    logs,
    auditTrail,
    decisionTrace,
    buildIntegrity,
  ] = await Promise.all([
    getCrons(p),
    getAgents(p),
    getHealth(p),
    getH1Data(p),
    getCalendar(p),
    getBills(p),
    getResearch(p),
    getBrainstorm(p),
    getNoema(p),
    getActionQueue(p),
    getLogs(p),
    getAuditTrail(p),
    getDecisionTraceData(p),
    getBuildIntegrity(),
  ]);

  return {
    meta: { loadedAt: Date.now() },
    crons,
    agents,
    health,
    buildIntegrity,
    h1,
    calendar,
    bills,
    research,
    brainstorm,
    noema,
    actionQueue,
    logs,
    auditTrail,
    decisionTrace,
  };
}

export {
  getAgents,
  getBills,
  getCalendar,
  getCrons,
  getH1Data,
  getHealth,
  getLogs,
  getAuditTrail,
  getDecisionTrace,
  getDecisionTraceData,
  getNoema,
  getActionQueue,
  getBrainstorm,
  getResearch,
  getDevLoopLog,
  getRunningDevLoop,
  getDevPackages,
  computePackageStats,
  filterPackages,
  groupPackages,
  isBlockedPackage,
  isDonePackage,
  phaseIcon,
  truncateName,
  getBuildIntegrity,
};
