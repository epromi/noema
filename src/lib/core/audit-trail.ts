import type {
  AllProviders,
  CronRun,
  Session,
  Subagent,
} from "$lib/providers/types";
import { getProvider } from "$lib/providers";
import type {
  AuditEvent,
  AuditEventCounts,
  AuditTrailData,
  AuditTrailFilter,
} from "$lib/types";
import { safeParseJson } from "./utils.js";

const MAX_EVENTS = 200;
const MAX_CRON_JOBS = 20;

const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * MS_24H;

interface ActionJsonlEntry {
  id?: string;
  action?: string;
  description?: string;
  status?: string;
  ts?: string;
  updatedAt?: string;
}

function emptyCounts(): AuditEventCounts {
  return {
    SESSION_START: 0,
    AGENT_SPAWN: 0,
    CRON_TRIGGER: 0,
    CRON_COMPLETE: 0,
    ERROR: 0,
    ACTION: 0,
  };
}

function parseIsoMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

function isErrorStatus(status: string | undefined): boolean {
  if (!status) return false;
  const lower = status.toLowerCase();
  return (
    lower.includes("error") ||
    lower.includes("fail") ||
    lower === "dead" ||
    lower === "err"
  );
}

/** Estimate session start time from updatedAt and ageMs. */
export function sessionStartMs(session: Session): number | undefined {
  if (session.updatedAt != null && session.ageMs != null) {
    return Math.max(0, session.updatedAt - session.ageMs);
  }
  return session.updatedAt;
}

/** Build SESSION_START events from active sessions. */
export function buildSessionEvents(sessions: Session[]): AuditEvent[] {
  const events: AuditEvent[] = [];

  for (const session of sessions) {
    const timestampMs = sessionStartMs(session);
    if (timestampMs == null) continue;

    const agentId = session.agentId ?? "unknown";
    events.push({
      id: `session:${session.key}:${timestampMs}`,
      type: "SESSION_START",
      timestampMs,
      title: `Session started — ${agentId}`,
      detail: session.key,
      agentId,
      sessionKey: session.key,
      severity: "info",
    });
  }

  return events;
}

/** Build cron trigger, complete, and error events from run history. */
export function buildCronEvents(
  runs: CronRun[],
  jobNames: Map<string, string>,
): AuditEvent[] {
  const events: AuditEvent[] = [];

  for (const run of runs) {
    const jobName = jobNames.get(run.jobId) ?? run.jobId;

    if (run.startedAtMs != null) {
      events.push({
        id: `cron:start:${run.jobId}:${run.startedAtMs}`,
        type: "CRON_TRIGGER",
        timestampMs: run.startedAtMs,
        title: `Cron triggered — ${jobName}`,
        detail: run.jobId,
        cronJobId: run.jobId,
        severity: "warn",
      });
    }

    const finishedAt = run.finishedAtMs ?? run.startedAtMs;
    if (finishedAt == null) continue;

    if (isErrorStatus(run.status) || run.error) {
      events.push({
        id: `cron:error:${run.jobId}:${finishedAt}`,
        type: "ERROR",
        timestampMs: finishedAt,
        title: `Cron failed — ${jobName}`,
        detail: run.error ?? run.status ?? "failed",
        cronJobId: run.jobId,
        severity: "error",
      });
      continue;
    }

    events.push({
      id: `cron:done:${run.jobId}:${finishedAt}`,
      type: "CRON_COMPLETE",
      timestampMs: finishedAt,
      title: `Cron completed — ${jobName}`,
      detail:
        run.durationMs != null
          ? `${Math.round(run.durationMs / 1000)}s`
          : run.status,
      cronJobId: run.jobId,
      severity: "info",
    });
  }

  return events;
}

/** Build AGENT_SPAWN events from subagent tasks. */
export function buildSpawnEvents(subagents: Subagent[]): AuditEvent[] {
  const events: AuditEvent[] = [];

  for (const sub of subagents) {
    const timestampMs = sub.startedAtMs;
    if (timestampMs == null) continue;

    const agentId = sub.agentId ?? "unknown";
    events.push({
      id: `spawn:${sub.id}:${timestampMs}`,
      type: "AGENT_SPAWN",
      timestampMs,
      title: `Agent spawned — ${agentId}`,
      detail: sub.label ?? sub.target,
      agentId,
      sessionKey: sub.target,
      severity: "info",
    });
  }

  return events;
}

/** Build ACTION events from noema-actions.jsonl lines. */
export function buildActionEvents(raw: string): AuditEvent[] {
  const events: AuditEvent[] = [];

  for (const line of raw.trim().split("\n")) {
    if (!line.trim()) continue;
    const entry = safeParseJson<ActionJsonlEntry>(line, {});
    const timestampMs =
      parseIsoMs(entry.updatedAt) ?? parseIsoMs(entry.ts) ?? Date.now();
    const action = entry.action ?? "action";
    const id = entry.id ?? "unknown";

    events.push({
      id: `action:${id}:${timestampMs}`,
      type: "ACTION",
      timestampMs,
      title: `Dashboard action — ${action}`,
      detail: entry.description ?? entry.status ?? id,
      severity: isErrorStatus(entry.status) ? "error" : "warn",
    });
  }

  return events;
}

/** Merge and sort events newest-first. */
export function mergeAuditEvents(events: AuditEvent[]): AuditEvent[] {
  return [...events].sort((a, b) => b.timestampMs - a.timestampMs);
}

function countEvents(events: AuditEvent[]): AuditEventCounts {
  const counts = emptyCounts();
  for (const event of events) {
    counts[event.type]++;
  }
  return counts;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/** Filter audit events by session, agent, type, and time range. */
export function filterAuditEvents(
  events: AuditEvent[],
  filter: AuditTrailFilter,
  nowMs = Date.now(),
): AuditEvent[] {
  let result = events;

  if (filter.sessionKey && filter.sessionKey !== "all") {
    result = result.filter((e) => e.sessionKey === filter.sessionKey);
  }

  if (filter.agentId && filter.agentId !== "all") {
    result = result.filter((e) => e.agentId === filter.agentId);
  }

  if (filter.eventType && filter.eventType !== "all") {
    result = result.filter((e) => e.type === filter.eventType);
  }

  const range = filter.timeRange ?? "all";
  if (range === "24h") {
    const cutoff = nowMs - MS_24H;
    result = result.filter((e) => e.timestampMs >= cutoff);
  } else if (range === "7d") {
    const cutoff = nowMs - MS_7D;
    result = result.filter((e) => e.timestampMs >= cutoff);
  }

  return result;
}

/**
 * Unified activity timeline from sessions, cron runs, spawns, and actions.
 */
export async function getAuditTrail(
  providers?: AllProviders,
): Promise<AuditTrailData> {
  const p = providers ?? getProvider();
  const nowMs = Date.now();

  try {
    const [sessions, jobs, subagents, actionsRaw] = await Promise.all([
      p.session.listSessions({ limit: 500 }),
      p.cron.listCrons(),
      p.agent.listSubagents().catch(() => [] as Subagent[]),
      p.filesystem.readState("noema-actions.jsonl").catch(() => ""),
    ]);

    const jobNames = new Map(jobs.map((job) => [job.id, job.name]));
    const cronJobs = jobs.slice(0, MAX_CRON_JOBS);
    const runGroups = await Promise.all(
      cronJobs.map((job) =>
        p.cron.getCronRuns(job.id).catch(() => [] as CronRun[]),
      ),
    );
    const runs = runGroups.flat();

    const merged = mergeAuditEvents([
      ...buildSessionEvents(sessions),
      ...buildCronEvents(runs, jobNames),
      ...buildSpawnEvents(subagents),
      ...buildActionEvents(actionsRaw),
    ]);

    const events = merged.slice(0, MAX_EVENTS);
    const sessionsList = uniqueSorted(
      events
        .map((e) => e.sessionKey)
        .filter((key): key is string => Boolean(key)),
    );
    const agents = uniqueSorted(
      events.map((e) => e.agentId).filter((id): id is string => Boolean(id)),
    );

    return {
      events,
      total: merged.length,
      sessions: sessionsList,
      agents,
      counts: countEvents(events),
      updatedAt: nowMs,
    };
  } catch (err) {
    return {
      events: [],
      total: 0,
      sessions: [],
      agents: [],
      counts: emptyCounts(),
      updatedAt: nowMs,
      error: String(err),
    };
  }
}
