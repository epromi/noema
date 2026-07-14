/** @file Agent roster data fetching and enrichment for the Agents tab. */

import type { AllProviders } from "$lib/providers/types";
import type { Session } from "$lib/providers/types";
import { fileAgeDays } from "$lib/providers/openclaw";
import { getProvider } from "$lib/providers";
import type {
  AgentCardStatus,
  AgentData,
  AgentEntry,
  AgentStatus,
} from "$lib/types";
import { staleLevel } from "./utils.js";

export const SESSION_ACTIVE_MS = 5 * 60 * 1000;
export const SESSION_STUCK_MS = 60 * 60 * 1000;

const AGENT_DEFS = [
  {
    id: "otto",
    name: "Otto",
    emoji: "🗄️",
    schedule: "03:00 + 03:35",
    role: "Back Office — Nightly compilation + KG",
  },
  {
    id: "viktor",
    name: "Viktor",
    emoji: "🛡️",
    schedule: "On-demand",
    role: "Security Analyst — Repo audit pipeline",
  },
  {
    id: "scout",
    name: "Scout",
    emoji: "🏕️",
    schedule: "On-demand (auto-spawn)",
    role: "Intel — H1 program discovery",
  },
  {
    id: "porter",
    name: "Porter",
    emoji: "🚪",
    schedule: "06-23 hourly",
    role: "Email Triage — Gmail filtering",
  },
  {
    id: "edwin",
    name: "Edwin",
    emoji: "🚀",
    schedule: "09:00 daily",
    role: "Jarvis Driver — Events + monitoring",
  },
  {
    id: "hugo",
    name: "Hugo",
    emoji: "📚",
    schedule: "20:00 nightly",
    role: "Repo Prep — Advisory → answer keys",
  },
  {
    id: "cortex",
    name: "Cortex",
    emoji: "🧠",
    schedule: "06:30 /3d",
    role: "Optimizer — System tuning",
  },
  {
    id: "alfred",
    name: "Alfred",
    emoji: "👔",
    schedule: "Active (main)",
    role: "Chief of Staff — Orchestration",
  },
] as const;

/** Resolve session age in milliseconds (prefers ageMs, then updatedAt). */
export function sessionAgeMs(session: Session, nowMs: number): number {
  if (session.ageMs != null) return session.ageMs;
  if (session.updatedAt != null) return Math.max(0, nowMs - session.updatedAt);
  return SESSION_STUCK_MS;
}

/** Classify a single session as active, idle, or stuck. */
export function classifySession(
  session: Session,
  nowMs = Date.now(),
): AgentStatus {
  const age = sessionAgeMs(session, nowMs);
  if (session.abortedLastRun && age > SESSION_ACTIVE_MS) return "stuck";
  if (age < SESSION_ACTIVE_MS) return "active";
  if (age < SESSION_STUCK_MS) return "idle";
  return "stuck";
}

export function summarizeAgentSessions(
  sessions: Session[],
  agentId: string,
  nowMs = Date.now(),
): {
  active: number;
  idle: number;
  stuck: number;
  total: number;
  lastActiveMs: number | null;
  sessionStatus: AgentStatus;
  uptimeMs: number;
} {
  const mine = sessions.filter((s) => (s.agentId ?? "unknown") === agentId);
  let active = 0;
  let idle = 0;
  let stuck = 0;
  let lastActiveMs: number | null = null;
  let oldestActiveStart: number | null = null;

  for (const session of mine) {
    const phase = classifySession(session, nowMs);
    if (phase === "active") active++;
    else if (phase === "idle") idle++;
    else stuck++;

    if (session.updatedAt != null) {
      lastActiveMs =
        lastActiveMs == null
          ? session.updatedAt
          : Math.max(lastActiveMs, session.updatedAt);
      if (phase === "active") {
        oldestActiveStart =
          oldestActiveStart == null
            ? session.updatedAt
            : Math.min(oldestActiveStart, session.updatedAt);
      }
    }
  }

  let sessionStatus: AgentStatus = "idle";
  if (stuck > 0) sessionStatus = "stuck";
  else if (active > 0) sessionStatus = "active";

  const uptimeMs = oldestActiveStart != null ? nowMs - oldestActiveStart : 0;

  return {
    active,
    idle,
    stuck,
    total: mine.length,
    lastActiveMs,
    sessionStatus,
    uptimeMs,
  };
}

function cardStatus(days: number): {
  status: AgentCardStatus;
  statusText: string;
  stale: number;
} {
  const sl = staleLevel(days);
  if (sl >= 7)
    return { status: "red", statusText: `Stale (${days}d)`, stale: sl };
  if (sl >= 3)
    return { status: "yellow", statusText: `Aging (${days}d)`, stale: sl };
  return { status: "green", statusText: "Active", stale: sl };
}

function formatRelativeMs(ms: number | null, nowMs: number): string {
  if (ms == null) return "Never";
  const delta = Math.max(0, nowMs - ms);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUptime(ms: number): string {
  if (ms <= 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export async function getAgents(providers?: AllProviders): Promise<AgentData> {
  const p = providers ?? getProvider();
  const nowMs = Date.now();

  try {
    const [sessions, subagents] = await Promise.all([
      p.session.listSessions({ limit: 500 }),
      p.agent.listSubagents().catch(() => []),
    ]);

    const spawnCounts = new Map<string, number>();
    for (const sub of subagents) {
      const id = sub.agentId ?? "unknown";
      spawnCounts.set(id, (spawnCounts.get(id) ?? 0) + 1);
    }

    const agents: AgentEntry[] = [];

    for (const def of AGENT_DEFS) {
      let days = 999;
      let memory: string | undefined;
      try {
        const statusFile = await p.filesystem.readAgentStatus(def.id);
        days = await fileAgeDays(statusFile.path);
        const trimmed = statusFile.content?.trim();
        if (trimmed) memory = trimmed;
      } catch {
        /* fallback to stale via status.md when API/files unavailable */
      }

      const { status, statusText, stale } = cardStatus(days);
      const summary = summarizeAgentSessions(sessions, def.id, nowMs);

      agents.push({
        id: def.id,
        name: def.name,
        emoji: def.emoji,
        status,
        statusText,
        staleLevel: stale,
        lastRun: days === 999 ? "Never" : `${days}d ago`,
        schedule: def.schedule,
        role: def.role,
        activeSessions: summary.total,
        sessionsActive: summary.active,
        sessionsIdle: summary.idle,
        sessionsStuck: summary.stuck,
        sessionStatus: summary.sessionStatus,
        spawnCount: spawnCounts.get(def.id) ?? 0,
        lastActive: formatRelativeMs(summary.lastActiveMs, nowMs),
        uptime: formatUptime(summary.uptimeMs),
        memory,
      });
    }

    return {
      agents,
      online: agents.filter((a) => a.sessionStatus === "active").length,
      total: agents.length,
      stale: agents.filter((a) => a.staleLevel >= 7).length,
      updatedAt: nowMs,
    };
  } catch (err) {
    return {
      agents: [],
      online: 0,
      total: 0,
      stale: 0,
      updatedAt: nowMs,
      error: String(err),
    };
  }
}

export async function getAgentDetail(
  agentId: string,
  providers?: AllProviders,
): Promise<AgentEntry | null> {
  const data = await getAgents(providers);
  return data.agents.find((a) => a.id === agentId) ?? null;
}
