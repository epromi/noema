import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AllProviders } from "$lib/providers/types";
import { getProvider } from "$lib/providers";
import { workspaceRoot } from "$lib/providers/openclaw";
import type {
  DevLoopLogData,
  DevLoopRunningData,
  DevPackageEntry,
  DevPackagesData,
} from "$lib/types";

const TAIL_BYTES = 8000;
const NO_LOG_PLACEHOLDER =
  "⏳ Még nincs log fájl — a Cursor agent akkor hozza létre amikor elindul.\n(Ha a ▶ Mehet gombot már megnyomtad, várd meg amíg a dev-loop elindul.)";

const LOG_PREFIX_PRIORITY = ["dev", "review", "cursor"] as const;

export interface QueueMarker {
  pkgId: string;
  queuedAt: string;
  estimatedMs: number;
}

function logDirPath(): string {
  return join(workspaceRoot(), "projects", "noema", "logs");
}

function queueMarkerPath(logDir: string, pkgId: string): string {
  return join(logDir, `queue-${pkgId}.json`);
}

/** Parse INDEX.md “Becsült idő” values like `1.5h`, `30m`, `2-3h`. */
export function parseEstimatedMinutes(raw: string): number | null {
  const s = raw.trim();
  if (!s || s.includes("✅")) return null;

  const rangeMatch = s.match(/^([\d.]+)-([\d.]+)h$/);
  if (rangeMatch) {
    const low = Number.parseFloat(rangeMatch[1] ?? "0");
    const high = Number.parseFloat(rangeMatch[2] ?? "0");
    return Math.round(((low + high) / 2) * 60);
  }

  const hoursMatch = s.match(/^([\d.]+)h$/);
  if (hoursMatch) {
    return Math.round(Number.parseFloat(hoursMatch[1] ?? "0") * 60);
  }

  const minutesMatch = s.match(/^([\d.]+)m$/);
  if (minutesMatch) {
    return Math.round(Number.parseFloat(minutesMatch[1] ?? "0"));
  }

  return null;
}

/**
 * Find the best log file for a package: dev-* > review-* > cursor-*.
 */
export async function findLogFile(
  logDir: string,
  pkgId: string,
): Promise<string | null> {
  try {
    const files = await readdir(logDir);
    const candidates = files
      .filter((f) => f.endsWith(`-${pkgId}.log`) || f.includes(`${pkgId}`))
      .map((f) => join(logDir, f));

    for (const prefix of LOG_PREFIX_PRIORITY) {
      const match = candidates
        .filter((p) => basename(p).startsWith(`${prefix}-`))
        .sort()
        .reverse()[0];
      if (match) return match;
    }
    return null;
  } catch {
    return null;
  }
}

function formatEmptyLogMessage(logPath: string): string {
  return `📋 Üres log fájl (${basename(logPath)}) — várakozás Cursor kimenetre...`;
}

function formatQueueContent(queue: QueueMarker): string {
  const elapsed = Date.now() - new Date(queue.queuedAt).getTime();
  const remaining = Math.max(0, queue.estimatedMs - elapsed);
  const remainingMin = Math.ceil(remaining / 60_000);
  return `⏳ Sorba állítva…\n\nBecsült várakozás: ~${remainingMin} perc\n\nA Cursor agent akkor kezdi el amikor a dev-loop felszabadul.\nEz a log automatikusan frissül amint a Cursor elkezd írni.`;
}

async function readQueueMarker(
  logDir: string,
  pkgId: string,
): Promise<QueueMarker | null> {
  try {
    const raw = await readFile(queueMarkerPath(logDir, pkgId), "utf8");
    return JSON.parse(raw) as QueueMarker;
  } catch {
    return null;
  }
}

async function clearQueueMarker(logDir: string, pkgId: string): Promise<void> {
  try {
    await unlink(queueMarkerPath(logDir, pkgId));
  } catch {
    /* ignore missing marker */
  }
}

/** Write queue marker when ▶ Mehet is pressed (before dev-loop starts). */
export async function writeQueueMarker(
  pkgId: string,
  estimatedMs: number,
): Promise<void> {
  const logDir = logDirPath();
  const marker: QueueMarker = {
    pkgId,
    queuedAt: new Date().toISOString(),
    estimatedMs,
  };
  await writeFile(queueMarkerPath(logDir, pkgId), JSON.stringify(marker), "utf8");
}

/**
 * Tail the latest dev-loop log for a package (last 8KB).
 */
export async function getDevLoopLog(
  pkgId: string,
  _providers?: AllProviders,
): Promise<DevLoopLogData> {
  try {
    const logDir = logDirPath();
    const logPath = await findLogFile(logDir, pkgId);

    if (!logPath) {
      const queue = await readQueueMarker(logDir, pkgId);
      if (queue) {
        return {
          pkgId,
          content: formatQueueContent(queue),
          updatedAt: Date.now(),
        };
      }
      return { pkgId, content: NO_LOG_PLACEHOLDER, updatedAt: Date.now() };
    }

    const raw = await readFile(logPath, "utf8");
    if (raw.length === 0) {
      return {
        pkgId,
        content: formatEmptyLogMessage(logPath),
        updatedAt: Date.now(),
      };
    }

    await clearQueueMarker(logDir, pkgId);
    const content =
      raw.length > TAIL_BYTES ? raw.slice(-TAIL_BYTES) : raw;
    return { pkgId, content, updatedAt: Date.now() };
  } catch (err) {
    return {
      pkgId,
      content: `❌ Hiba a log olvasása közben: ${String(err)}`,
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}

/**
 * Detect currently running dev-loop package via process list.
 */
export async function getRunningDevLoop(
  providers?: AllProviders,
): Promise<DevLoopRunningData> {
  const p = providers ?? getProvider();

  try {
    const ps = await p.tool.execCommand(
      'ps aux | grep -E "dev-loop\\.sh|action-processor" | grep -v grep',
    );
    const match = ps.match(/dev-loop\.sh\s+(PKG-\d+(?:-\S+)?)/);
    return { running: match?.[1] ?? null, updatedAt: Date.now() };
  } catch (err) {
    return { running: null, updatedAt: Date.now(), error: String(err) };
  }
}

/**
 * Parse dev/packages/INDEX.md into package rows for the Noema tab.
 */
export async function getDevPackages(
  _providers?: AllProviders,
): Promise<DevPackagesData> {
  try {
    const indexPath = join(
      workspaceRoot(),
      "projects",
      "noema",
      "dev",
      "packages",
      "INDEX.md",
    );
    const indexMd = await readFile(indexPath, "utf8");
    const packages = parsePackageIndex(indexMd);
    return { packages, updatedAt: Date.now() };
  } catch (err) {
    return { packages: [], updatedAt: Date.now(), error: String(err) };
  }
}

export function parsePackageIndex(indexMd: string): DevPackageEntry[] {
  const packages: DevPackageEntry[] = [];

  for (const line of indexMd.split("\n")) {
    const match = line.match(/^\|\s*(PKG-\d{3})\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
    if (!match) continue;

    const id = match[1] ?? "";
    const name = (match[2] ?? "").trim();
    const phase = (match[3] ?? "").trim();
    const done = phase.includes("✅");

    const parts = line.split("|").map((p) => p.trim());
    const estimatedRaw = parts[6] ?? "";
    const estimatedMinutes = parseEstimatedMinutes(estimatedRaw);

    packages.push({
      id,
      name,
      phase,
      done,
      estimatedMinutes,
    });
  }

  return packages;
}
