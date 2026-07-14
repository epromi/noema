/** @file Shared utility functions (date formatting, string helpers, type guards). */

import type { CronByGroup, CronEntry, CronGroup } from "$lib/types";

const CRON_GROUPS: CronGroup[] = [
  "NIGHT",
  "MORNING",
  "DAYTIME",
  "EVENING",
  "SPANNING",
];

/** Empty per-group stats for all cron time groups. */
export function emptyCronByGroup(): CronByGroup {
  return Object.fromEntries(
    CRON_GROUPS.map((group) => [group, { total: 0, healthy: 0 }]),
  ) as CronByGroup;
}

/** Aggregate healthy/total counts per cron time group. */
export function buildCronByGroup(crons: CronEntry[]): CronByGroup {
  const byGroup = emptyCronByGroup();
  for (const cron of crons) {
    byGroup[cron.group].total++;
    if (cron.lastResult === "ok") byGroup[cron.group].healthy++;
  }
  return byGroup;
}

/** Classify cron schedule into dashboard time groups. */
export function classifyCronGroup(schedule: unknown): CronGroup {
  const text = scheduleText(schedule);
  const hour = extractHour(text);

  if (text.includes("every") && !text.match(/\d{1,2}:\d{2}/)) return "SPANNING";
  if (hour == null) return "SPANNING";
  if (hour >= 0 && hour < 6) return "NIGHT";
  if (hour >= 6 && hour < 9) return "MORNING";
  if (hour >= 9 && hour < 17) return "DAYTIME";
  if (hour >= 17 && hour < 24) return "EVENING";
  return "SPANNING";
}

function scheduleText(schedule: unknown): string {
  if (typeof schedule === "string") return schedule.toLowerCase();
  if (schedule && typeof schedule === "object") {
    const s = schedule as Record<string, unknown>;
    if (s.kind === "every") return "every";
    if (typeof s.expr === "string") return s.expr.toLowerCase();
    if (typeof s.at === "string") return s.at.toLowerCase();
  }
  return String(schedule ?? "").toLowerCase();
}

function extractHour(text: string): number | null {
  const atMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (atMatch) return parseInt(atMatch[1] ?? "0", 10);
  const hourRange = text.match(/(\d{1,2})-\d{1,2}/);
  if (hourRange) return parseInt(hourRange[1] ?? "0", 10);
  return null;
}

/** Parse markdown table rows (pipe-separated). */
export function parseMarkdownTable(
  content: string,
  headerMarker: string,
): string[][] {
  const lines = content.split("\n");
  let inSection = false;
  let headerDone = false;
  const rows: string[][] = [];

  for (const line of lines) {
    if (line.includes(headerMarker)) {
      inSection = true;
      headerDone = false;
      continue;
    }
    if (inSection && (line.startsWith("## ") || line.startsWith("---"))) break;
    if (!inSection || !line.includes("|")) continue;
    if (line.includes("---")) continue;
    if (!headerDone && line.match(/\|.*\|/)) {
      headerDone = true;
      continue;
    }
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length > 0) rows.push(cells);
  }

  return rows;
}

/** Safe JSON parse with fallback. */
export function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Stale level from age in days. */
export function staleLevel(days: number): number {
  if (days >= 14) return 7;
  if (days >= 7) return 3;
  return 0;
}

/** Format schedule object for display. */
export function formatSchedule(schedule: unknown): string {
  if (typeof schedule === "string") return schedule;
  if (schedule && typeof schedule === "object") {
    const s = schedule as Record<string, unknown>;
    if (s.kind === "every" && typeof s.everyMs === "number") {
      const hours = Math.round(s.everyMs / 3_600_000);
      return hours >= 1
        ? `every ${hours}h`
        : `every ${Math.round(s.everyMs / 60_000)}m`;
    }
    if (typeof s.expr === "string") return s.expr;
    if (typeof s.at === "string") return s.at;
  }
  return "unknown";
}

/** Count files recursively under a directory (max depth). */
export async function countFiles(
  readDir: (path: string) => Promise<{ name: string; isDirectory: boolean }[]>,
  root: string,
  maxDepth = 3,
): Promise<{ total: number; recent: number }> {
  let total = 0;
  let recent = 0;
  const weekMs = 7 * 86_400_000;

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries: { name: string; isDirectory: boolean; mtimeMs?: number }[];
    try {
      entries = await readDir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory) {
        await walk(`${dir}/${entry.name}`, depth + 1);
      } else {
        total++;
        if (entry.mtimeMs != null && Date.now() - entry.mtimeMs < weekMs)
          recent++;
      }
    }
  }

  await walk(root, 0);
  return { total, recent };
}
