# GAP SCAN: State Management — Noema Dashboard
**Scan date:** 2026-08-10 06:17 CEST  
**Scope:** `src/lib/core/*`, `src/lib/providers/*`, `src/lib/server/*`, `src/routes/+page.*`  
**Architecture note:** No Svelte stores (`writable`/`derived`) exist. State is managed via a custom SSR+SSE+cache+$state architecture. The analysis adapts the store-oriented checklist to this pattern.

---

## Architecture Map

```
                    +page.server.ts (SSR, 5-min file cache)
                    │
                    ▼
              getAllData() — 12 parallel fetches
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Provider Layer    Core Modules    Filesystem
   (HTTP+CLI+FS)    (Parsing+Agg)    Cache
        │
        ▼
   collector.ts — 60s cycle → SSE broadcast → $state on client
```

---

## 🔴 CRITICAL

### C-1: Global mutex TOCTOU in H1 cache (`h1.ts:405-446`, `h1.ts:32-36`)

**File:** `src/lib/core/h1.ts`

The module-level `h1DataPromise` is used as a mutex to deduplicate concurrent `getH1Data()` calls, and is cleared in `.finally()`. When both `+page.server.ts` and `collector.ts` call `getAllData()` simultaneously (which happens on startup), the second caller receives the same Promise, but the first one's `.finally()` clears `h1DataPromise` before the second `await` resolves. This creates a window where:

1. Call A enters, sets `h1DataPromise`, starts work
2. Call B enters, receives the same `h1DataPromise`
3. Call A finishes, `.finally()` clears `h1DataPromise = null`
4. Call B is still awaiting the returned promise — but the mutex is gone; a Call C could now enter and start a duplicate fetch

**The balance/programs/reports caches have the same pattern** (`h1.ts:28-29`, `balanceFetchPromise`, `programsFetchPromise`, `reportsFetchPromise`).

**Fix:** Use a counter-based refcounting mutex, or a `Map<requestId, Promise>` instead of a single flag. Alternatively, call `getAllData()` once and feed the result to both the SSR response and the cache — the collector already has fresh data when it starts.

```typescript
// Pattern: ref-counted mutex
let _pendingCount = 0;
let _promise: Promise<H1Data> | null = null;

export async function getH1Data(providers?): Promise<H1Data> {
  if (_promise) return _promise;
  _promise = (async () => {
    _pendingCount++;
    try { /* ... */ } finally {
      if (--_pendingCount <= 0) _promise = null;
    }
  })();
  return _promise;
}
```

---

### C-2: `collectPromise` mutex same TOCTOU bug (`collector.ts:12-27`)

**File:** `src/lib/server/collector.ts`

```typescript
let collectPromise: Promise<DashboardData> | null = null;

export async function collectOnce(): Promise<DashboardData> {
  if (collectPromise) return collectPromise;
  collectPromise = (async () => {
    const data = await getAllData(providers);
    setCache(data);
    broadcast(data);
    return data;
  })();
  try {
    return await collectPromise;
  } finally {
    collectPromise = null; // ← clears mutex even if another caller is awaiting
  }
}
```

Same race as C-1. If `pkg-watcher` triggers a `collectOnce()` while a scheduled 60s cycle is mid-flight, the mutex gets cleared prematurely. The `setInterval` + `fs.watch` combo means this collision is likely under active development (file saves trigger watcher → collect → timer collides).

**Fix:** Same ref-counted pattern as C-1, or debounce the timer reset after watcher-triggered collects.

---

### C-3: Mutable module-level SSR failure counter (`build-integrity.ts:178`)

**File:** `src/lib/core/build-integrity.ts`

```typescript
let consecutiveSsrFailures = 0;

export function recordSsrCheckResult(ok: boolean): number {
  if (ok) consecutiveSsrFailures = 0;
  else consecutiveSsrFailures += 1;
  return consecutiveSsrFailures;
}
```

This is mutable global state. Consequences:
- **Node.js cluster mode:** Each worker has its own counter. A single worker's 3 consecutive failures won't trigger the alert if requests round-robin across workers.
- **Tests:** The counter leaks between test runs unless `resetSsrFailureCounter()` is called (it exists but isn't called automatically).
- **No persistence:** Server restart resets the counter to 0, hiding persistent SSR failures.

**Fix:** Store the counter in the `data/dashboard-cache.json` or use a file-based counter (`data/ssr-failures.json`). Read/write atomically.

---

### C-4: Provider singleton instantiated at import time — no init/error handling (`openclaw-singleton.ts:5`)

**File:** `src/lib/providers/openclaw-singleton.ts`

```typescript
export const provider: AllProviders = createOpenClawProviders();
```

`createOpenClawProviders()` is called at module load time. If the Gateway token file is missing or unreadable at startup, there's no mechanism to recover — every subsequent Gateway API call will fail with "Failed to read gateway token". The `getProvider()` function caches this permanently:

```typescript
// providers/index.ts
export function getProvider(): AllProviders {
  if (cached) return cached; // ← never re-evaluated
  // ...
}
```

**Fix:** Add a lazy initialization pattern with retry. The `resetProvider()` function exists for tests but is never used in production.

---

## 🟠 HIGH

### H-1: No loading states — SSR blocks page for up to 25 seconds

**Files:** `src/routes/+page.server.ts`, `src/routes/+page.svelte`

```typescript
const SSR_TIMEOUT_MS = 25000;
// ...
const [dashboard, devPackages, hostnameRaw] = await Promise.all([
  Promise.race([getAllData(providers), timeoutSentinel]),
  Promise.race([getDevPackages(providers), timeoutSentinel]),
  // ...
]);
```

SvelteKit's `load` function **blocks page rendering** until it resolves. During the 15-25 second Gateway API call window (cache miss), the user sees a blank page. The file cache mitigates this for subsequent loads, but:
- First visit after deploy → 15-25s blank page
- Cache expiry while user is on the page → next click shows blank page
- No streaming, no skeleton, no partial render

**Fix:** Use SvelteKit's streaming with `data` promises (`+page.server.ts` can return unresolved promises that stream to the client). Render a skeleton immediately, stream data as it arrives.

---

### H-2: SSE EventSource has no reconnection logic on client

**File:** `src/routes/+page.svelte:48`

```typescript
onMount(() => {
  if (!browser) return;
  const es = new EventSource("/api/events");
  es.onmessage = (event) => { /* ... */ };
  // ...
  return () => { es.close(); clearInterval(queueTimer); };
});
```

The `EventSource` API has built-in reconnection, but:
- **No `onerror` handler** — reconnection errors are silently swallowed
- **No backoff** — default EventSource reconnect is immediate; during extended outages this creates a thundering herd
- **No state reconciliation after reconnect** — after reconnection, the SSE stream sends the cached snapshot and then live updates, but any events missed during the gap are lost. The full `getAllData()` cycle only runs every 60s, so there could be up to 60 seconds of stale data.

**Fix:** Add `onerror` with exponential backoff. On reconnect, force a `refreshQueueStatus()` call. Consider a "last update" timestamp comparison to detect gaps.

---

### H-3: `getDecisionTraceData()` loads 15 full session histories unconditionally

**File:** `src/lib/core/decision-trace.ts:337-364`

```typescript
await Promise.all(
  selected.map(async (session) => {
    traces[session.key] = await getDecisionTrace(session.key, p);
  }),
);
```

This reads ALL 15 session JSONL files when the user clicks the DecisionTrace tab. Session files can be hundreds of KB each. The `parseHistoryMessages()` function processes every message looking for tool calls — this is CPU-intensive and blocks the tab render.

**Fix:** Load the session list eagerly, but lazy-load individual traces on demand (when the user selects a specific session from the dropdown). The session list already has `updatedAt` for sorting — that's enough for the initial view.

---

### H-4: Stale cache after silent data degradation

**File:** `src/routes/+page.server.ts:163-171`

```typescript
if (typeof dashboard === "object") {
  // ...write cache...
  writeFileSync(CACHE_FILE, JSON.stringify({ _ts: Date.now(), _data: result }));
}
```

If `getAllData()` completes but individual modules return `error`-flagged empty data (e.g., H1 API throws, returning `{ error: "..." }`), the validated result is cached for 5 minutes. There's no mechanism to detect "everything errored out" vs "normal data with one module degraded."

**Fix:** Before writing cache, check if a critical threshold of modules has errors. If >50% of modules returned error data, skip the cache write and let the next request retry.

---

### H-5: `Promise.all` in `getAllData()` has no partial failure handling

**File:** `src/lib/core/index.ts:28-42`

```typescript
const [crons, agents, health, h1, calendar, bills, research, brainstorm, noema, actionQueue, logs, auditTrail, buildIntegrity] = await Promise.all([
  getCrons(p), getAgents(p), getHealth(p), getH1Data(p),
  getCalendar(p), getBills(p), getResearch(p), getBrainstorm(p),
  getNoema(p), getActionQueue(p), getLogs(p), getAuditTrail(p),
  getBuildIntegrity(),
]);
```

If ONE of these 12 calls rejects (not caught internally), the entire `Promise.all` rejects and `validatePageData` gets an empty object — meaning ALL tabs show empty data. The individual modules do have try-catch, but the `Promise.all` itself doesn't. If `getBuildIntegrity()` throws (it does `fetch()` without try-catch in its inner path), all 12 modules' data is lost.

**Fix:** Use `Promise.allSettled()` and handle partial failures gracefully. Return whatever succeeded, mark failed modules with `error` flags.

---

## 🟡 MEDIUM

### M-1: `parsePackageIndex()` loses INDEX.md columns via brittle index-based extraction

**File:** `src/lib/core/dev-loop-log.ts:370-385`

```typescript
const match = line.match(/^\|\s*(PKG-\d{3})\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
// ...
const parts = line.split("|").map((p) => p.trim());
const estimatedRaw = parts[6] ?? ""; // ← brittle: assumes column layout never changes
```

If someone adds a column to INDEX.md before the "Becsült idő" column, `parts[6]` silently picks up the wrong column. All other columns (tags, dependencies, etc.) are discarded.

**Fix:** Parse the header row to discover column indices dynamically.

---

### M-2: `parseH1FromAtAGlance()` — 5 fragile regex patterns, no validation

**File:** `src/lib/core/h1.ts:173-195`

```typescript
const open = h1Section.match(/\|\s*Open\s*\|\s*(\d+)/)?.[1]
  ?? h1Section.match(/(\d+)\s+Open/)?.[1]
  ?? atAGlance.match(/(\d+)\s+Open/)?.[1]
  ?? "?";
```

5 separate fallback regexes chained with `??`. If the at-a-glance.md format changes (e.g., someone reorders the table), all regexes silently fail and return `"?"`. No warning is logged.

**Fix:** Parse the at-a-glance table structurally (split by `|` on known header rows). Log a warning when primary regex fails.

---

### M-3: CSS custom properties used as JS color values in brainstorm data

**File:** `src/lib/core/noema.ts:282-323`

```typescript
const BRAINSTORM_SECTION_META = {
  autoexec: {
    color: "var(--green)",   // ← CSS variable, not a resolved color
    bgColor: "var(--g-bg)",
  },
  autonotify: {
    color: "var(--accent)",
    bgColor: "#1a2a3a",      // ← hardcoded fallback (inconsistent)
  },
  // ...
};
```

Mixing `var(--green)` CSS custom properties with hardcoded hex values (`#1a2a3a`). The `var()` values work only if the consuming Svelte component uses them as inline `style="color: var(--green)"` — which works. But the inconsistency means some sections have fixed colors while others depend on CSS variables. If the CSS variable isn't defined (no theme loaded), `autoexec` and `approval` sections get `transparent`/`inherit` colors while `autonotify` falls back to `#1a2a3a`.

**Fix:** Either resolve all colors to hardcoded values in JS, or use CSS classes with `data-section-key` attributes in the Svelte component.

---

### M-4: `getAgents()` reads agent status files sequentially

**File:** `src/lib/core/agents.ts:206-214`

```typescript
for (const def of AGENT_DEFS) {
  let days = 999;
  try {
    const statusFile = await p.filesystem.readAgentStatus(def.id);
    days = await fileAgeDays(statusFile.path);
    // ...
  } catch { /* ... */ }
}
```

8 agents, each reading a file sequentially. `readAgentStatus()` already `readFile`s, then `fileAgeDays()` `stat`s the same file again. Double I/O per agent, serialized.

**Fix:** `Promise.all(AGENT_DEFS.map(def => readAgentStatus(def.id)))` — parallelize. Cache the `mtimeMs` from the `stat` inside `readAgentStatus` to avoid the second `stat`.

---

### M-5: `getLogs()` shells out to `tail` — fragile and platform-dependent

**File:** `src/lib/core/logs.ts:115-122`

```typescript
const cmd = [
  `tail -n ${TAIL_LINES}`,
  `${LOGS_DIR}/*.log`,
  `${LOGS_DIR}/*.jsonl`,
  "2>/dev/null",
  "|",
  `tail -n ${TAIL_LINES}`,
].join(" ");
const raw = await p.tool.execCommand(cmd);
```

This shells out to run `tail` with glob patterns. On systems without `tail` or with different glob behavior, this fails silently. The `2>/dev/null` redirection is bash-specific. Also, `execCommand` uses `child_process.exec` which has a shell injection surface.

**Fix:** Use `readdir` + `readFile` with `fs.promises` to read the last N bytes of each log file natively in Node.js. This is already how the dev-loop logs work (`dev-loop-log.ts` uses `readFile`). Be consistent.

---

### M-6: Calendar JSON parsing is type-unsafe

**File:** `src/lib/core/calendar.ts:13-17`

```typescript
const parsed = JSON.parse(raw) as { events?: CalendarEvent[] } | CalendarEvent[];
const events: CalendarEvent[] = Array.isArray(parsed)
  ? parsed
  : (parsed.events ?? []).map((e) => ({ /* ... */ }));
```

`JSON.parse` without validation means the `as` type assertion is a lie. If the gog CLI output format changes, `parsed.events` might be a string or an object instead of an array — the `.map()` would throw, caught by the outer try-catch. But the silent fallback to empty events hides the format change.

**Fix:** Use a Zod schema or manual validation after parse. Log a warning when the shape doesn't match.

---

### M-7: `$derived` deep-merge in page.svelte doesn't handle nested objects

**File:** `src/routes/+page.svelte:28`

```typescript
const data = $derived(sseData ? { ...serverData, ...sseData } : serverData);
```

This is a shallow merge. If `sseData` has `{ crons: { crons: [...] } }`, it replaces the entire `crons` object. But if the SSE payload is partial (e.g., only `{ health: { gatewayStatus: "offline" } }`), the shallow merge would replace `health.uptime`, `health.disk`, etc. with `undefined` from the SSE payload. The comment says "defense against partial SSE pushes" but the implementation actually requires FULL objects in SSE — partial updates would corrupt data.

**Fix:** Either implement deep merge, or document that SSE payloads must be complete objects. Better: restructure to send only changed keys with a `$patch` protocol.

---

## 🟢 LOW

### L-1: `parseLogLevel()` false positives on words containing "error"/"warn"

**File:** `src/lib/core/logs.ts:19-24`

```typescript
if (/\b(ERROR|ERR|FATAL|CRITICAL|EXCEPTION)\b/.test(upper)) return "ERROR";
```

Lines containing "terror", "referrer", "interruption" will match `ERR`. Lines like "warning" won't match `WARN` at all (it checks `/\b(WARN|WARNING)\b/` which won't match "warning" because of the trailing `ING` — actually wait, `/WARNING/` DOES match "WARNING" inside "warning". The `\b` boundaries ensure "WARN" won't match "WARNING" but `/WARNING/` will match the substring. This is actually fine.

The real issue: `\bERROR\b` matches "ERROR" but not "Error" or "error" — the `toUpperCase()` handles this. But `/FATAL/` won't match "FATALITY" because `\b` boundaries work correctly. Edge cases are minimal; this is truly low severity.

---

### L-2: `formatSchedule()` returns generic `"unknown"` with no debug logging

**File:** `src/lib/core/utils.ts:138-142`

If the cron schedule format doesn't match any known pattern, the dashboard shows "unknown" with no indication of what caused it. Adding a `console.debug()` would help debugging new cron formats.

---

### L-3: Queue marker files never expire

**File:** `src/lib/core/dev-loop-log.ts:247-257`

```typescript
async function clearQueueMarker(logDir: string, pkgId: string): Promise<void> {
  try { await unlink(queueMarkerPath(logDir, pkgId)); } catch { /* ... */ }
}
```

Queue markers are only cleared when a log file is found (`getDevLoopLog` → `clearQueueMarker`). If `▶ Mehet` is pressed but the dev-loop never starts (relay offline, process crashes), the queue marker persists forever. Stale markers show "⏳ Sorba állítva…" indefinitely.

**Fix:** Add a TTL check in `getDevLoopLog` — if `queuedAt` is older than 30 minutes, return a "timed out" message and clear the marker.

---

### L-4: `$effect` in page.svelte resets `sseData` on every `serverData` change

**File:** `src/routes/+page.svelte:30-33`

```typescript
$effect(() => {
  serverData;
  sseData = null;
});
```

This is the correct pattern for Svelte 5 (reset SSE overlay when SSR data changes). However, `serverData` is the entire PageData object — any navigation that re-runs the `load` function will trigger this, even if data is identical. The effect only has `serverData` as a dependency, so it fires on every `load()` result. This is correct behavior but worth noting: it means any link click that triggers a new SSR load will briefly show stale SSE data before the reset.

---

### L-5: `source=` marker lines in log parsing create empty entries

**File:** `src/lib/core/logs.ts:66-73`

```typescript
const sourceMatch = trimmed.match(SOURCE_MARKER);
if (sourceMatch) {
  return {
    lineNum, raw: trimmed, level: "OTHER",
    message: trimmed, source: sourceMatch[1],
  };
}
```

Lines like `==> filename.log <==` are returned as LogEntry items with level "OTHER". They're not filtered out in `parseTailOutput`, so they appear in the logs tab as regular entries. This is cosmetic but clutters the log view with file name separators.

**Fix:** Return `null` for source marker lines, or mark them as a separate `level: "MARKER"` and filter them in the UI.

---

## Summary

| Severity | Count | Key themes |
|----------|-------|------------|
| 🔴 CRITICAL | 4 | Mutex TOCTOU bugs (C-1, C-2), mutable global state (C-3), provider init failure (C-4) |
| 🟠 HIGH | 5 | No loading states (H-1), SSE gaps (H-2), unconditional heavy fetches (H-3), stale cache (H-4), Promise.all fragility (H-5) |
| 🟡 MEDIUM | 7 | Brittle parsing (M-1, M-2), CSS/JS color mismatch (M-3), sequential I/O (M-4), shell injection surface (M-5), type-unsafe JSON (M-6), shallow merge bug (M-7) |
| 🟢 LOW | 5 | Regex edge cases (L-1), missing debug logging (L-2), stale queue markers (L-3), unnecessary reactivity (L-4), log marker clutter (L-5) |

### Top 3 Fixes by Impact

1. **Fix the mutex TOCTOU pattern** (C-1, C-2) — affects both H1 data freshness and collector reliability. One ref-counted wrapper function fixes both.
2. **Add streaming SSR with skeleton loading** (H-1) — eliminates 15-25s blank page on cache miss. Biggest UX improvement.
3. **Switch `getAllData()` to `Promise.allSettled()`** (H-5) — prevents one failed module from taking down all 12. Already partially handled by per-module try-catch, but the `Promise.all` is the single point of failure.

---

*Scan performed by Alfred. Full source files reviewed: 30.*
