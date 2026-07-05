import { homedir } from "node:os";
import { join } from "node:path";
import type { AllProviders } from "$lib/providers/types";
import { getProvider } from "$lib/providers";
import type {
  LogCounts,
  LogData,
  LogEntry,
  LogFilter,
  LogLevel,
} from "$lib/types";

const TAIL_LINES = 500;
const LOGS_DIR = join(homedir(), ".openclaw", "logs");

const SOURCE_MARKER = /^==>\s+(.+?)\s+<==$/;

/** Detect log severity from a raw line (case-insensitive). */
export function parseLogLevel(line: string): LogLevel {
  const upper = line.toUpperCase();
  if (/\b(ERROR|ERR|FATAL|CRITICAL|EXCEPTION)\b/.test(upper)) return "ERROR";
  if (/\b(WARN|WARNING)\b/.test(upper)) return "WARN";
  if (/\b(INFO|INFORMATION)\b/.test(upper)) return "INFO";
  if (/\b(DEBUG|TRACE)\b/.test(upper)) return "DEBUG";
  return "OTHER";
}

/** Parse optional ISO or bracketed timestamp prefix. */
export function parseLogTimestamp(line: string): string | undefined {
  const iso = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*)/);
  if (iso?.[1]) return iso[1];

  const dateOnly = line.match(/^(\d{4}-\d{2}-\d{2})\b/);
  if (dateOnly?.[1]) return dateOnly[1];

  const bracket = line.match(/^\[([^\]]+\d{4}[^\]]*)\]/);
  if (bracket?.[1]) return bracket[1];

  const jsonTs = line.match(/"ts"\s*:\s*"([^"]+)"/);
  if (jsonTs?.[1]) return jsonTs[1];

  return undefined;
}

/** Parse one log line into a structured entry. */
export function parseLogLine(
  raw: string,
  lineNum: number,
  source?: string,
): LogEntry | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const sourceMatch = trimmed.match(SOURCE_MARKER);
  if (sourceMatch) {
    return {
      lineNum,
      raw: trimmed,
      level: "OTHER",
      message: trimmed,
      source: sourceMatch[1],
    };
  }

  const level = parseLogLevel(trimmed);
  const timestamp = parseLogTimestamp(trimmed);

  return {
    lineNum,
    raw: trimmed,
    level,
    timestamp,
    message: trimmed,
    source,
  };
}

/** Filter log entries by dashboard filter mode. */
export function filterLogs(entries: LogEntry[], filter: LogFilter): LogEntry[] {
  if (filter === "all") return entries;
  if (filter === "errors") return entries.filter((e) => e.level === "ERROR");
  if (filter === "warnings") return entries.filter((e) => e.level === "WARN");
  return entries;
}

function countLevels(entries: LogEntry[]): LogCounts {
  const counts: LogCounts = { error: 0, warn: 0, info: 0, other: 0 };
  for (const entry of entries) {
    switch (entry.level) {
      case "ERROR":
        counts.error++;
        break;
      case "WARN":
        counts.warn++;
        break;
      case "INFO":
        counts.info++;
        break;
      default:
        counts.other++;
    }
  }
  return counts;
}

function parseTailOutput(raw: string): LogEntry[] {
  const entries: LogEntry[] = [];
  let currentSource: string | undefined;
  let lineNum = 0;

  for (const line of raw.split("\n")) {
    lineNum++;
    const entry = parseLogLine(line, lineNum, currentSource);
    if (!entry) continue;

    if (entry.source && SOURCE_MARKER.test(entry.raw)) {
      currentSource = entry.source;
      continue;
    }

    entries.push(entry);
  }

  return entries.slice(-TAIL_LINES);
}

/**
 * Tail the last 500 lines from ~/.openclaw/logs/ via provider exec.
 */
export async function getLogs(providers?: AllProviders): Promise<LogData> {
  const p = providers ?? getProvider();

  try {
    const cmd = [
      `tail -n ${TAIL_LINES}`,
      `${LOGS_DIR}/*.log`,
      `${LOGS_DIR}/*.jsonl`,
      "2>/dev/null",
      "|",
      `tail -n ${TAIL_LINES}`,
    ].join(" ");

    const raw = await p.tool.execCommand(cmd);
    const entries = parseTailOutput(raw);

    return {
      entries,
      total: entries.length,
      counts: countLevels(entries),
      updatedAt: Date.now(),
    };
  } catch (err) {
    return {
      entries: [],
      total: 0,
      counts: { error: 0, warn: 0, info: 0, other: 0 },
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}
