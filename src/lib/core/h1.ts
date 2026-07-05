import type { AllProviders } from "$lib/providers/types";
import { getProvider } from "$lib/providers";
import type {
  H1Data,
  H1Program,
  H1Report,
  H1Signal,
  H1Stats,
  H1ViktorStatus,
} from "$lib/types";
import { safeParseJson } from "./utils.js";

const CACHE_TTL_MS = 60 * 60 * 1000;
const OPEN_REPORT_STATES = new Set([
  "new",
  "triaged",
  "needs-more-info",
  "pending-program-review",
]);

let programsCache: { programs: H1Program[]; fetchedAt: number } | null = null;

/** Reset in-memory H1 API cache (for tests). */
export function clearH1Cache(): void {
  programsCache = null;
}

/** Extract the first JSON value from mixed h1.sh stdout (human text + JSON). */
export function extractH1Json(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* mixed output — scan for JSON block */
  }

  const startObj = trimmed.indexOf("{");
  const startArr = trimmed.indexOf("[");
  let start = -1;
  if (startObj >= 0 && (startArr < 0 || startObj < startArr)) start = startObj;
  else if (startArr >= 0) start = startArr;
  if (start < 0) return null;

  const slice = trimmed.slice(start);
  for (let end = slice.length; end > 0; end--) {
    try {
      return JSON.parse(slice.slice(0, end));
    } catch {
      /* try shorter slice */
    }
  }
  return null;
}

interface H1ApiProgramRow {
  id?: string;
  attributes?: {
    handle?: string;
    name?: string;
    offers_bounties?: boolean;
    submission_state?: string;
  };
}

interface H1ApiReportRow {
  id?: string;
  attributes?: {
    title?: string;
    state?: string;
    severity_rating?: string;
    created_at?: string;
  };
  relationships?: {
    reporter?: { data?: { attributes?: { signal?: number; reputation?: number } } };
    program?: { data?: { attributes?: { handle?: string } } };
  };
}

/** Parse programs JSON from h1.sh programs output. */
export function parseH1Programs(raw: unknown): H1Program[] {
  const rows = (raw as { data?: H1ApiProgramRow[] })?.data;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      id: row.id ?? "",
      handle: row.attributes?.handle ?? "",
      name: row.attributes?.name ?? "",
      offersBounties: row.attributes?.offers_bounties ?? false,
      submissionState: row.attributes?.submission_state ?? "unknown",
    }))
    .filter((p) => p.id.length > 0);
}

/** Parse my-reports JSON from h1.sh output. */
export function parseH1Reports(raw: unknown): H1Report[] {
  const rows = (raw as { data?: H1ApiReportRow[] })?.data;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      id: row.id ?? "",
      title: row.attributes?.title ?? "",
      state: row.attributes?.state ?? "unknown",
      createdAt: row.attributes?.created_at ?? "",
      severity: row.attributes?.severity_rating,
      programHandle: row.relationships?.program?.data?.attributes?.handle,
    }))
    .filter((r) => r.id.length > 0);
}

/** Parse balance JSON from h1.sh balance output. */
export function parseH1Balance(raw: unknown): { amount: number; display: string } {
  const amount =
    (raw as { data?: { balance?: number } })?.data?.balance ?? NaN;
  if (Number.isFinite(amount)) {
    return { amount, display: `$${amount.toFixed(2)}` };
  }
  return { amount: 0, display: "unknown" };
}

/** Read signal + reputation from embedded reporter relationship in my-reports. */
export function parseH1SignalFromReports(raw: unknown): H1Signal | null {
  const rows = (raw as { data?: H1ApiReportRow[] })?.data;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const attrs = rows[0]?.relationships?.reporter?.data?.attributes;
  if (attrs?.signal == null && attrs?.reputation == null) return null;

  return {
    signal: attrs?.signal != null ? String(attrs.signal) : "?",
    reputation: attrs?.reputation != null ? String(attrs.reputation) : "?",
    trial: "0",
  };
}

/** Parse signal/reputation/trial from at-a-glance.md H1 section. */
export function parseH1FromAtAGlance(atAGlance: string): H1Signal & { open: string } {
  const hs =
    atAGlance.match(/📊 H1 Dashboard[\s\S]*?(?=\n## |\n---|$)/)?.[0] ??
    atAGlance;

  const open =
    hs.match(/\|\s*Open\s*\|\s*(\d+)/)?.[1] ??
    hs.match(/(\d+)\s+Open/)?.[1] ??
    atAGlance.match(/(\d+)\s+Open/)?.[1] ??
    "?";

  const signal =
    atAGlance.match(/Signal[\s:|]+([-0-9.]+)/)?.[1] ??
    hs.match(/Signal[\s:|]+([-0-9.]+)/)?.[1] ??
    "?";

  const reputation =
    atAGlance.match(/Reputation[\s:|]+(\d+)/)?.[1] ??
    hs.match(/Reputation[\s:|]+(\d+)/)?.[1] ??
    "?";

  const trial =
    hs.match(/Trial reports\s*\|\s*(\d+)/)?.[1] ??
    hs.match(/Trial\s*\|\s*(\d+)/)?.[1] ??
    atAGlance.match(/trial reports?:?\s*(\d+)/i)?.[1] ??
    "0";

  return { open, signal, reputation, trial };
}

/** Aggregate report counts for dashboard stats. */
export function getH1Stats(
  reports: H1Report[],
  signalData: H1Signal,
  openOverride?: string,
): H1Stats {
  let resolved = 0;
  let duplicates = 0;
  let pending = 0;
  let notApplicable = 0;

  for (const report of reports) {
    if (report.state === "resolved") resolved++;
    else if (report.state === "duplicate") duplicates++;
    else if (report.state === "not-applicable") notApplicable++;
    else if (OPEN_REPORT_STATES.has(report.state)) pending++;
  }

  const open =
    openOverride ??
    (pending > 0 ? String(pending) : reports.length > 0 ? "0" : "?");

  return {
    open,
    signal: signalData.signal,
    reputation: signalData.reputation,
    trial: signalData.trial,
    totalReports: reports.length,
    resolved,
    duplicates,
    pending,
    notApplicable,
  };
}

/** Combine API reporter fields with at-a-glance fallbacks. */
export function getH1Signal(
  reportsRaw: unknown,
  atAGlance: string,
): H1Signal & { open: string } {
  const fromReports = parseH1SignalFromReports(reportsRaw);
  const fromMemory = parseH1FromAtAGlance(atAGlance);

  return {
    open: fromMemory.open,
    signal: fromReports?.signal ?? fromMemory.signal,
    reputation: fromReports?.reputation ?? fromMemory.reputation,
    trial: fromMemory.trial,
  };
}

function formatProgramsSummary(
  programs: H1Program[],
  scoutStatus: string,
): string {
  const rows = scoutStatus
    .split("\n")
    .filter(
      (line) =>
        line.match(/^\|.*\|.*\|/) &&
        !line.includes("---") &&
        !line.includes("Type"),
    );
  if (rows.length > 0) return `${rows.length} accessible programs`;

  if (programs.length > 0) {
    const bbp = programs.filter((p) => p.offersBounties).length;
    return `${programs.length} programs (${bbp} BBP)`;
  }

  return "⛔ Signal limited programs";
}

/** Parse Viktor autoresearch pipeline state. */
export function parseH1ViktorStatus(raw: unknown): H1ViktorStatus {
  const state = raw as {
    totalCompleted?: number;
    repos?: Array<{ status?: string; recallX?: number; recallY?: number }>;
    activeLabel?: string;
    circuitBreaker?: { tripped?: boolean };
    transferValidation?: {
      h1FindingsSubmitted?: number;
      h1FindingsAccepted?: number;
    };
  };

  const repos = state.repos ?? [];
  const withRecall = repos.filter(
    (r) => r.recallX != null && r.recallY != null && (r.recallY ?? 0) > 0,
  );
  let recall = 0;
  if (withRecall.length > 0) {
    const x = withRecall.reduce((sum, r) => sum + (r.recallX ?? 0), 0);
    const y = withRecall.reduce((sum, r) => sum + (r.recallY ?? 0), 0);
    recall = y > 0 ? Math.round((x / y) * 100) : 0;
  }

  return {
    totalCompleted:
      state.totalCompleted ?? repos.filter((r) => r.status === "done").length,
    recall,
    h1Submitted: state.transferValidation?.h1FindingsSubmitted ?? 0,
    h1Accepted: state.transferValidation?.h1FindingsAccepted ?? 0,
    activeLabel: state.activeLabel ?? "",
    circuit: state.circuitBreaker?.tripped ? "TRIPPED" : "Normal",
  };
}

export async function getH1Balance(
  providers?: AllProviders,
): Promise<{ amount: number; display: string }> {
  const p = providers ?? getProvider();
  try {
    const raw = await p.tool.h1Command("balance");
    return parseH1Balance(extractH1Json(raw));
  } catch {
    return { amount: 0, display: "unknown" };
  }
}

export async function getH1Programs(
  providers?: AllProviders,
): Promise<H1Program[]> {
  if (
    programsCache &&
    Date.now() - programsCache.fetchedAt < CACHE_TTL_MS
  ) {
    return programsCache.programs;
  }

  const p = providers ?? getProvider();
  try {
    const raw = await p.tool.h1Command("programs");
    const programs = parseH1Programs(extractH1Json(raw));
    programsCache = { programs, fetchedAt: Date.now() };
    return programs;
  } catch {
    return programsCache?.programs ?? [];
  }
}

export async function getH1Reports(
  providers?: AllProviders,
): Promise<H1Report[]> {
  const p = providers ?? getProvider();
  try {
    const raw = await p.tool.h1Command("my-reports");
    return parseH1Reports(extractH1Json(raw));
  } catch {
    return [];
  }
}

export async function getH1ViktorStatus(
  providers?: AllProviders,
): Promise<H1ViktorStatus> {
  const p = providers ?? getProvider();
  try {
    const raw = await p.filesystem.readResearch(
      "viktor-benchmark/autoresearch-state.json",
    );
    return parseH1ViktorStatus(safeParseJson(raw, {}));
  } catch {
    return {
      totalCompleted: 0,
      recall: 0,
      h1Submitted: 0,
      h1Accepted: 0,
      activeLabel: "",
      circuit: "Normal",
    };
  }
}

export async function getH1Data(providers?: AllProviders): Promise<H1Data> {
  const p = providers ?? getProvider();

  try {
    const [atAGlance, balanceResult, reportsRaw, programs, viktor] =
      await Promise.all([
        p.filesystem.readMemory("at-a-glance.md").catch(() => ""),
        getH1Balance(p),
        p.tool
          .h1Command("my-reports")
          .then((raw) => extractH1Json(raw))
          .catch(() => null),
        getH1Programs(p),
        getH1ViktorStatus(p),
      ]);

    const reports = parseH1Reports(reportsRaw);
    const signalData = getH1Signal(reportsRaw, atAGlance);
    const stats = getH1Stats(reports, signalData, signalData.open);

    let programsSummary = formatProgramsSummary(programs, "");
    try {
      const scout = await p.filesystem.readAgentStatus("scout");
      programsSummary = formatProgramsSummary(programs, scout.content);
    } catch {
      programsSummary = formatProgramsSummary(programs, "");
    }

    return {
      stats,
      balance: balanceResult.display,
      balanceAmount: balanceResult.amount,
      programs: programsSummary,
      programList: programs,
      reports,
      signal: {
        signal: signalData.signal,
        reputation: signalData.reputation,
        trial: signalData.trial,
      },
      viktor,
      updatedAt: Date.now(),
    };
  } catch (err) {
    return {
      stats: {
        open: "?",
        signal: "?",
        reputation: "?",
        trial: "0",
        totalReports: 0,
        resolved: 0,
        duplicates: 0,
        pending: 0,
        notApplicable: 0,
      },
      balance: "unknown",
      balanceAmount: 0,
      programs: "unknown",
      programList: [],
      reports: [],
      signal: { signal: "?", reputation: "?", trial: "0" },
      viktor: {
        totalCompleted: 0,
        recall: 0,
        h1Submitted: 0,
        h1Accepted: 0,
        activeLabel: "",
        circuit: "Normal",
      },
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}
