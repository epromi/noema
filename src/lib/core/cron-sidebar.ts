import type {
  CronEntry,
  CronSidebarCronRow,
  CronSidebarData,
  CronSidebarRow,
  CronSidebarStatus,
} from "$lib/types";
import {
  computeNextRun,
  formatClock,
  formatCountdown,
  formatLastRunMs,
  formatTimeLabel,
  isSpanningSched,
  parseDisplayMinutes,
} from "./cron-schedule.js";

const SIDEBAR_HORIZON_MS = 24 * 3_600_000;

const CRON_EMOJI: Record<string, string> = {
  alfred: "👔",
  porter: "🚪",
  edwin: "🚀",
  scout: "🏕️",
  viktor: "🛡️",
  otto: "🗄️",
  albert: "🔍",
  cortex: "🧠",
  hugo: "📚",
  main: "🏠",
  system: "🤖",
};

/** Agent emoji for cron sidebar rows. */
export function getCronEmoji(agentId: string): string {
  return CRON_EMOJI[agentId.toLowerCase()] ?? "🤖";
}

/** Map last run result to sidebar status color. */
export function getCronStatus(
  lastResult: string,
  consecutiveErrors: number,
): CronSidebarStatus {
  if (lastResult === "error" || consecutiveErrors > 0) return "error";
  if (lastResult === "ok") return "ok";
  return "warning";
}

/** Short label for compact sidebar display. */
export function shortenCronName(name: string, maxLen = 22): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function resolveNextRunMs(cron: CronEntry, now: Date): number | null {
  if (cron.nextRunAtMs != null && cron.nextRunAtMs > now.getTime()) {
    return cron.nextRunAtMs;
  }
  return computeNextRun(
    cron.schedule,
    formatLastRunMs(cron.lastRunAtMs),
    now,
  );
}

function buildCronRow(
  cron: CronEntry,
  now: Date,
  nextRunAtMs: number | null,
  isNext: boolean,
): CronSidebarCronRow {
  const nowMs = now.getTime();
  const nowMins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const displayMins = parseDisplayMinutes(cron.schedule);
  const spanning = isSpanningSched(cron.schedule);
  const isHourly = spanning && /hourly/i.test(cron.schedule);
  const isPast =
    !spanning && displayMins != null && displayMins < nowMins && !isNext;

  const timeLabel =
    isHourly && cron.schedule.split(" ")[0]
      ? cron.schedule.split(" ")[0]!
      : displayMins != null
        ? formatTimeLabel(displayMins)
        : "auto";

  const sortMins =
    nextRunAtMs != null
      ? (nextRunAtMs - nowMs) / 60_000 + nowMins
      : (displayMins ?? 9999);

  return {
    kind: "cron",
    id: cron.id,
    timeLabel,
    emoji: getCronEmoji(cron.agentId),
    name: cron.name,
    shortName: shortenCronName(cron.name),
    countdown: isHourly
      ? "hourly"
      : formatCountdown(nextRunAtMs, nowMs),
    status: getCronStatus(cron.lastResult, cron.consecutiveErrors),
    isPast,
    isNext,
    isHourly,
    sortMins,
    nextRunAtMs,
  };
}

/**
 * Build compact cron sidebar rows for the next 24 hours with a NOW marker.
 */
export function buildCronSidebarRows(
  crons: CronEntry[],
  now: Date = new Date(),
): CronSidebarData {
  const nowMs = now.getTime();
  const nowMins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const horizonEnd = nowMs + SIDEBAR_HORIZON_MS;

  const enabled = crons.filter((c) => c.enabled);
  let nextCronId: string | null = null;
  let minNextMs = Infinity;

  const entries: CronSidebarCronRow[] = [];

  for (const cron of enabled) {
    const nextRunAtMs = resolveNextRunMs(cron, now);
    if (nextRunAtMs != null && nextRunAtMs < minNextMs) {
      minNextMs = nextRunAtMs;
      nextCronId = cron.id;
    }

    const displayMins = parseDisplayMinutes(cron.schedule);
    const spanning = isSpanningSched(cron.schedule);
    const inHorizon =
      nextRunAtMs != null && nextRunAtMs <= horizonEnd;
    const isTodayPast =
      !spanning &&
      displayMins != null &&
      displayMins <= nowMins &&
      displayMins >= nowMins - 360;

    if (!inHorizon && !isTodayPast && !spanning) continue;

    entries.push(
      buildCronRow(cron, now, nextRunAtMs, cron.id === nextCronId),
    );
  }

  for (const entry of entries) {
    entry.isNext = entry.id === nextCronId;
  }

  entries.sort((a, b) => a.sortMins - b.sortMins);

  const rows: CronSidebarRow[] = [...entries];
  rows.push({
    kind: "now",
    sortMins: nowMins,
    clockLabel: formatClock(now),
  });
  rows.sort((a, b) => a.sortMins - b.sortMins);

  return {
    rows,
    clockLabel: formatClock(now),
    nextCronId,
    updatedAt: nowMs,
  };
}

/** Refresh countdown labels and clock without rebuilding row order. */
export function refreshCronSidebarData(
  data: CronSidebarData,
  now: Date = new Date(),
): CronSidebarData {
  const nowMs = now.getTime();
  const rows = data.rows.map((row): CronSidebarRow => {
    if (row.kind === "now") {
      return { ...row, clockLabel: formatClock(now), sortMins: now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 };
    }
    if (row.isHourly) return row;
    return {
      ...row,
      countdown: formatCountdown(row.nextRunAtMs, nowMs),
    };
  });

  return {
    ...data,
    rows,
    clockLabel: formatClock(now),
    updatedAt: nowMs,
  };
}
