/** @file Gantt-style cron run timeline data for CronTimeline.svelte (PKG-008). */

import type { CronEntry, CronGanttData, CronGanttRow, CronGanttStatus } from "$lib/types";

const DEFAULT_WINDOW_HOURS = 24;
/** Fixed visual width of a run bar (crons don't currently report duration). */
const BLOCK_DURATION_MS = 5 * 60_000;

const ERROR_RESULTS = new Set(["error", "failed", "failure"]);

function classifyStatus(cron: CronEntry): CronGanttStatus {
  if (!cron.enabled) return "skipped";
  const result = cron.lastResult.toLowerCase();
  if (result === "ok") return "ok";
  if (ERROR_RESULTS.has(result)) return "error";
  return "unknown";
}

function buildBlock(
  cron: CronEntry,
  status: CronGanttStatus,
  windowStartMs: number,
  windowEndMs: number,
): CronGanttRow["blocks"][number] | null {
  const startMs = cron.lastRunAtMs;
  if (startMs == null || startMs < windowStartMs || startMs > windowEndMs) {
    return null;
  }
  const endMs = Math.min(startMs + BLOCK_DURATION_MS, windowEndMs);
  return {
    status,
    startMs,
    endMs,
    label: `${cron.name} — ${status} (${cron.schedule})`,
  };
}

/**
 * Build Gantt-style run bars for the last N hours from already-fetched cron entries.
 * Pure transform of getCrons() output — no provider access needed.
 */
export function buildCronTimeline(
  crons: CronEntry[],
  nowMs: number = Date.now(),
  windowHours: number = DEFAULT_WINDOW_HOURS,
): CronGanttData {
  const windowEndMs = nowMs;
  const windowStartMs = nowMs - windowHours * 3600_000;

  try {
    const rows: CronGanttRow[] = crons
      .map((cron) => {
        const status = classifyStatus(cron);
        const block = buildBlock(cron, status, windowStartMs, windowEndMs);
        return {
          id: cron.id,
          name: cron.name,
          agentId: cron.agentId,
          schedule: cron.schedule,
          blocks: block ? [block] : [],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { rows, windowStartMs, windowEndMs, updatedAt: Date.now() };
  } catch (err) {
    return {
      rows: [],
      windowStartMs,
      windowEndMs,
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}
