/** @file CPU and system metrics collection for the Health dashboard. */

import { cpus } from "node:os";
import type { AllProviders } from "$lib/providers/types";
import type { CpuData, CpuProcess } from "$lib/types";
import { getProvider } from "$lib/providers";

export type LoadLevel = "ok" | "warn" | "error";

/** Parse /proc/loadavg first line: "load1 load5 load15 running/total lastPid" */
export function parseLoadavg(
  raw: string,
): Omit<CpuData, "coreCount" | "topProcesses"> | null {
  const line = raw.trim().split("\n")[0] ?? "";
  const parts = line.split(/\s+/);
  if (parts.length < 4) return null;

  const load1 = Number(parts[0]);
  const load5 = Number(parts[1]);
  const load15 = Number(parts[2]);
  const procParts = (parts[3] ?? "").split("/");
  const runningProcs = Number(procParts[0]);
  const totalProcs = Number(procParts[1]);

  if (
    [load1, load5, load15, runningProcs, totalProcs].some((n) =>
      Number.isNaN(n),
    )
  ) {
    return null;
  }

  return { load1, load5, load15, runningProcs, totalProcs };
}

/** Truncate process name to maxLen characters with ellipsis. */
export function truncateProcessName(name: string, maxLen = 20): string {
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen - 1)}…`;
}

/** Classify load average against logical core count. */
export function classifyLoadLevel(load: number, coreCount: number): LoadLevel {
  if (coreCount <= 0) return "ok";
  if (load > coreCount) return "error";
  if (load > coreCount * 0.7) return "warn";
  return "ok";
}

function parsePsLine(line: string): { name: string; cpu: number } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.+?)\s+([\d.]+)$/);
  if (!match?.[1] || !match[2]) return null;
  const cpu = Number(match[2]);
  if (Number.isNaN(cpu)) return null;
  return { name: match[1].trim(), cpu };
}

/** Aggregate ps output by process name, filter > minCpu%, return top N. */
export function aggregateProcesses(
  psOutput: string,
  maxCount = 8,
  minCpu = 1.0,
): CpuProcess[] {
  const totals = new Map<string, { cpuPercent: number; count: number }>();

  for (const line of psOutput.split("\n")) {
    const parsed = parsePsLine(line);
    if (!parsed) continue;
    const existing = totals.get(parsed.name) ?? { cpuPercent: 0, count: 0 };
    totals.set(parsed.name, {
      cpuPercent: existing.cpuPercent + parsed.cpu,
      count: existing.count + 1,
    });
  }

  return [...totals.entries()]
    .filter(([, v]) => v.cpuPercent > minCpu)
    .sort((a, b) => b[1].cpuPercent - a[1].cpuPercent)
    .slice(0, maxCount)
    .map(([name, v]) => ({
      name: truncateProcessName(name),
      cpuPercent: Math.round(v.cpuPercent * 10) / 10,
      count: v.count,
    }));
}

export async function getCpuData(
  providers?: AllProviders,
): Promise<CpuData | undefined> {
  const p = providers ?? getProvider();
  const coreCount = cpus().length;

  try {
    const loadavgRaw = await p.tool
      .execCommand("cat /proc/loadavg 2>/dev/null")
      .catch(() => "");
    const psRaw = await p.tool
      .execCommand("ps -eo comm,%cpu --no-headers 2>/dev/null")
      .catch(() => "");

    const parsed = parseLoadavg(loadavgRaw);
    if (!parsed) return undefined;

    return {
      ...parsed,
      coreCount,
      topProcesses: aggregateProcesses(psRaw),
    };
  } catch {
    return undefined;
  }
}
