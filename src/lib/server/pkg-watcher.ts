import { watch } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { collectOnce } from "$lib/server/collector";

export const PKG_DEBOUNCE_MS = 500;

const WORKSPACE =
  process.env.WORKSPACE ?? join(homedir(), ".openclaw", "workspace");
const NOEMA_DIR = join(WORKSPACE, "projects", "noema");
const PKG_DIR = join(NOEMA_DIR, "dev", "packages");
const INDEX_FILE = join(PKG_DIR, "INDEX.md");

type Watcher = { close: () => void };

let watchers: Watcher[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let watcherStarted = false;

/** Whether a fs.watch filename should trigger PKG list refresh. */
export function isRelevantPkgChange(filename: string | null): boolean {
  if (!filename) return false;
  return (
    filename === "INDEX.md" ||
    filename.endsWith(".md") ||
    filename.endsWith(".json")
  );
}

function scheduleCollect(filename: string): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    console.log(`[pkg-watcher] ${filename} változott → frissítés`);
    void collectOnce().catch((err) => {
      console.error("[pkg-watcher] hiba:", err);
    });
  }, PKG_DEBOUNCE_MS);
}

function onChange(_event: string, filename: string | null): void {
  if (filename && isRelevantPkgChange(filename)) {
    scheduleCollect(filename);
  }
}

/** Start fs.watch on INDEX.md and dev/packages (idempotent). */
export function startPkgWatcher(): void {
  if (watcherStarted) return;

  try {
    watchers.push(watch(INDEX_FILE, onChange));
    watchers.push(watch(PKG_DIR, { recursive: false }, onChange));
    watcherStarted = true;
    console.log(`[pkg-watcher] Figyelem: ${PKG_DIR}`);
  } catch (err) {
    stopPkgWatcher();
    console.error("[pkg-watcher] Nem sikerült indítani:", err);
  }
}

/** Stop watchers and pending debounce (for tests / shutdown). */
export function stopPkgWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  for (const w of watchers) {
    w.close();
  }
  watchers = [];
  watcherStarted = false;
}
