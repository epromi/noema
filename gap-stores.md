# GAP SCAN: State Management — Noema Dashboard

**Audit date:** 2026-08-02  
**Scope:** `src/lib/core/*.ts`, `src/routes/+page.svelte`, `src/routes/+page.server.ts`, `src/lib/providers/*.ts`  
**Finding:** Noema does not use Svelte stores. All state is managed via a functional core module pattern with async fetchers + module-level caches + SSR/SSE push. This report covers gaps in that pattern.

---

## 1. No Granular Reactivity — Monolithic SSE Push (High)

**File:** `src/routes/+page.svelte`, `src/routes/api/events/+server.ts`

Every SSE message replaces the full `sseData` object:

```ts
// +page.svelte:49
const data = $derived(sseData ? { ...serverData, ...sseData } : serverData);
```

This means when `health.cpu.load1` changes, **all 13 tab components** re-evaluate their `$derived` bindings and the entire DOM tree is diffed. There's no way to subscribe to a slice of state.

**Impact:** CPU waste on every refresh cycle (25–30s interval). With 13 tabs, this cascades to ~50+ reactive component checks for every SSE message.

**Recommendation:** Either:
- (A) Introduce Svelte writable/derived stores per data domain (`healthStore`, `agentsStore`, `h1Store`…) so components subscribe selectively
- (B) Keep the functional pattern but add SSE channels per domain (e.g., `/api/events?topic=health,crons`) so the client only receives what changed

---

## 2. `getAllData()` — No Per-Source Error Isolation (High)

**File:** `src/lib/core/index.ts:37–65`

All 13 data sources are fetched via a single `Promise.all`:

```ts
const [crons, agents, health, h1, calendar, bills, research, brainstorm,
  noema, actionQueue, logs, auditTrail, buildIntegrity] = await Promise.all([…]);
```

If `getH1Data()` throws, **all** 13 promises reject because the entire Promise.all rejects — even though the other 12 could have succeeded. The outer catch in the server loader returns fully empty fallback data for everything.

**What actually happens:** Each `get*()` function has its own try/catch and returns a "fallback shape with `error` field", so individual failures don't actually reject Promise.all. This is **accidentally safe** but fragile — it relies on every async function wrapping itself in try/catch. A single uncaught exception in any getter kills the entire page load.

**Recommendation:** Use `Promise.allSettled()` to make this structural rather than accidental. Then merge results, injecting each module's error into the returned data tree.

---

## 3. Race Condition in `getH1ReportsRaw()` Mutex (High)

**File:** `src/lib/core/h1.ts:545–558`

```ts
async function getH1ReportsRaw(providers?: AllProviders): Promise<unknown> {
  if (reportsCache && Date.now() - reportsCache.fetchedAt < CACHE_TTL_MS) {
    return reportsCache.raw;
  }
  if (reportsFetchPromise) {
    return reportsFetchPromise.then(() => getH1ReportsRaw(providers));
  }
  const p = providers ?? getProvider();
  try {
    const raw = await p.tool.h1Command("my-reports");
    return extractH1Json(raw);
  } catch { … }
}
```

**Bug:** If `reportsFetchPromise` is in-flight but the cache is stale (TTL expired mid-flight), the function **does NOT return** the in-flight promise. Instead it falls through and makes a **duplicate API call**. The `getH1Reports()` version above it does check the mutex correctly, but `getH1ReportsRaw()` has its own independent cache check that can race with `getH1Reports()`.

**Additionally:** `getH1ReportsRaw()` doesn't set `reportsFetchPromise` or write to `reportsCache`, so its results are ephemeral — every call after cache expiry makes a fresh API call with no deduplication.

**Recommendation:** `getH1ReportsRaw()` should share the same mutex (`reportsFetchPromise`) as `getH1Reports()`. Remove the separate API call — just return `reportsCache.raw` after waiting on the shared promise.

---

## 4. No Loading State Propagation (Medium)

**File:** `src/routes/+page.svelte`, all `src/lib/core/*.ts`

Components receive `data` as a finalized object. There is **zero loading indicator granularity**:

- No component knows if its specific data is loading, fresh, stale, or failed
- The `updatedAt` timestamp is the only freshness signal, and it's not used by any component
- If `getLogs()` takes 20 seconds (it does a `tail -n 500` on disk), the Logs tab shows empty data with no spinner

**Gap:** There's no `loading` boolean, no `Promise` that components can await/show spinners for. The SSR page load blocks for up to 25s (timeout) with a blank screen.

**Recommendation:** Add `loading: boolean` and `loadedAt: number` to every `*Data` interface. Components check `loading` to show skeletons/spinners. The SSE path should push partial data as it arrives rather than waiting for all 13 modules.

---

## 5. SSE Reconnection Not Handled (Medium)

**File:** `src/routes/+page.svelte:55–69`

```ts
onMount(() => {
  const es = new EventSource("/api/events");
  es.onmessage = (event) => { … };
  // NO es.onerror handler
});
```

If the SSE connection drops (server restart, network blip, tab backgrounded), there's **no reconnection logic**. The EventSource spec does auto-reconnect, but without an `onerror` handler, there's no:
- Exponential backoff for reconnect attempts
- User-visible indicator that live data is stale
- Fallback to polling if SSE fails permanently

**Recommendation:** Add `es.onerror` with exponential backoff, a `connectionState` tracking variable, and a visible "Live data disconnected" banner after N consecutive failures.

---

## 6. Shallow Merge in SSE → SSR Data Can Lose Nested Fields (Medium)

**File:** `src/routes/+page.svelte:49`

```ts
const data = $derived(sseData ? { ...serverData, ...sseData } : serverData);
```

This is a **shallow merge**. If the SSE payload omits a top-level key (e.g., no `health` in the SSE message because the collector skipped it), the spread doesn't merge — it replaces. So:

```
serverData = { crons: {…}, health: {…}, h1: {…} }
sseData     = { crons: {…}, h1: {…} }             // health omitted
result      = { crons: sse, health: undefined, h1: sse }
```

The Health tab now receives `undefined` or the stale Object.assign result is silently missing data.

**What saves this:** The SSE broadcaster always sends the full `DashboardData` from the cache. But this is **brittle** — any change to the collector that omits a field (optimization, partial updates) breaks all tabs.

**Recommendation:** Deep merge or at minimum, keep the SSR value when SSE key is absent.

---

## 7. Module-Level Mutable State: `consecutiveSsrFailures` (Medium)

**File:** `src/lib/core/build-integrity.ts:226–237`

```ts
let consecutiveSsrFailures = 0;

export function recordSsrCheckResult(ok: boolean): number {
  if (ok) consecutiveSsrFailures = 0;
  else consecutiveSsrFailures += 1;
  return consecutiveSsrFailures;
}
```

This is a **global mutable variable** in a module that runs on the Node.js server. In a real production deployment with concurrent requests, all users share the same failure counter. User A's request failing could trigger a false alert for User B's dashboard. If the dashboard scales to multiple workers, each has its own counter with divergent state.

**Recommendation:** Move this to a per-request or per-cache-cycle value. Store it in the dashboard cache file (`data/dashboard-cache.json`) alongside the cached data, reset on successful SSR probes.

---

## 8. `handleImplement` Optimistic Update Without Rollback (Medium)

**File:** `src/routes/+page.svelte:139–186`

```ts
async function handleImplement(pkgId: string, name: string) {
  setState(pkgId, {
    implementState: "running",   // ← optimistic — never rolled back
    showLogButton: true,
    logOpen: true,
  });
  // … fetch /api/log/…/queue, then fetch /api/action …
  // if relay is down: setState("offline"), timeout → "idle" after 2s
  // but if relay returns { ok: false }: setState("error"), timeout → "idle"
}
```

The state transitions are:
1. Immediate → `"running"` (optimistic)
2. Relay down → `"offline"` → 2s → `"idle"`  (manual reset)
3. Relay `{ ok: false }` → `"error"` → 2s → `"idle"`  (manual reset)

But if the browser tab is closed mid-transition, the state on next load starts fresh. If the package was actually queued, the UI shows `"idle"` while the job runs. The `refreshQueueStatus()` poller (10s interval) partially covers this by detecting the running package, but the `packageStates` record is **not persisted** across page reloads.

**Recommendation:** After `refreshQueueStatus()` confirms a package is running, set its state to `"running"` rather than relying solely on the optimistic set. Consider persisting `packageStates` to `sessionStorage`.

---

## 9. `packageStates` Poller Accumulation / Leak (Medium)

**File:** `src/routes/+page.svelte:119–137`

```ts
const pollers = new Map<string, ReturnType<typeof setInterval>>();

function startLogPoll(pkgId: string) {
  stopLogPoll(pkgId);               // clears old timer
  void fetchLog(pkgId);
  pollers.set(pkgId, setInterval(…, LOG_POLL_MS));
}
```

Each opened log panel creates a `setInterval`. On `onDestroy`, all pollers are cleared. But there's a subtle gap: if a package is removed from `devPackages` (no longer in INDEX.md), its poller continues firing `fetchLog` forever for a non-existent package. The `trackedIds` computation in `refreshQueueStatus` accounts for this but `startLogPoll` doesn't check if the package still exists.

**Recommendation:** In `fetchLog`, if the response is 404, auto-close the log and clear the poller.

---

## 10. `DecisionTrace` Lazy-Loaded Every Time (Low-Medium)

**File:** `src/lib/core/index.ts:67–71`, `src/lib/core/decision-trace.ts:374`

```ts
const decisionTrace = {
  sessions: [] as DecisionTraceSessionOption[],
  traces: {} as Record<string, DecisionTrace>,
  defaultSessionKey: "",
  updatedAt: Date.now(),
};
```

Decision traces are never fetched during `getAllData()` — they get an empty placeholder. They're only loaded when the user clicks the Decision Trace tab, which triggers `getDecisionTraceData()`. This function:
1. Lists all sessions (500 limit)
2. For each of the 15 most recent sessions, calls `getHistory()` which **parses every message in the session from disk**
3. Parses tool call/result pairs into `DecisionStep[]`

For large sessions (500+ messages), this is **very expensive** and blocks the tab from rendering for seconds.

**Recommendation:** Add a lightweight pre-fetch during `getAllData()` that only loads session metadata (keys, labels, update times). Defer the heavy message parsing to on-demand with a loading spinner. Cache parsed traces with a TTL.

---

## 11. Hardcoded Agent Definitions (Low)

**File:** `src/lib/core/agents.ts:18–77`

```ts
const AGENT_DEFS = [
  { id: "otto", name: "Otto", emoji: "🗄️", schedule: "03:00 + 03:35", role: "Back Office…" },
  { id: "viktor", name: "Viktor", emoji: "🛡️", … },
  // … 8 agents total
] as const;
```

Adding or renaming an agent requires a code change + redeploy. The agent roster is also defined in `~/.openclaw/agents/<name>/` config files.

**Recommendation:** Read agent definitions from `~/.openclaw/agents/*/` at startup, or at minimum, accept a config override via `memory/agents-model-mapping.md` (which is already being read for `modelMappingAge` in health.ts).

---

## 12. No Request Deduplication for `getAllData()` (Low)

**File:** `src/lib/core/index.ts`, `src/routes/+page.server.ts`, `src/lib/server/collector.ts`

The SSR page load calls `getAllData()`. The background collector (in `src/lib/server/collector.ts`) also calls `getAllData()` on its own schedule. These two paths can overlap, causing duplicate API calls:

```
SSR page load: getAllData() → getCrons() → h1Command("balance") + h1Command("programs") + …
Background collector: getAllData() → getCrons() → same commands again
```

Most `get*()` functions have no cross-request deduplication (only H1 has module-level mutexes). The others (crons, agents, health, etc.) will run duplicate shell commands and API calls.

**Recommendation:** Add a shared `getAllData()` promise mutex at the module level (similar to H1's pattern). If a call is in progress, return the in-flight promise instead of starting a new one.

---

## 13. `getLogs()` — No Caching, Always Tails Disk (Low)

**File:** `src/lib/core/logs.ts:108–125`

```ts
export async function getLogs(providers?: AllProviders): Promise<LogData> {
  const cmd = `tail -n 500 ${LOGS_DIR}/*.log ${LOGS_DIR}/*.jsonl 2>/dev/null | tail -n 500`;
  const raw = await p.tool.execCommand(cmd);
  // …
}
```

Every `getAllData()` call (every 25–30s) re-reads the last 500 lines of all log files from disk via a shell command. This is ~2–5s of I/O per cycle, repeated for every SSE broadcast.

**Recommendation:** Add a TTL cache (30–60s) for the raw log output, with invalidation on write. Alternatively, make logs a separate polling endpoint so the main dashboard refresh doesn't pay this cost.

---

## 14. No Stale-While-Revalidate Pattern (Low)

**File:** `src/lib/core/h1.ts`, `src/routes/+page.server.ts`

The file cache in `+page.server.ts` serves stale data (5-min TTL), but the API-level caches in `h1.ts` (60-min TTL) are strictly "cache-or-fetch" — no background refresh. When the cache expires, the next request blocks until the API responds.

**Recommendation:** Return the stale cache immediately, trigger a background refresh, and push the updated data via SSE when ready. This eliminates the ~3–8s blocking delay on H1 API calls.

---

## 15. No Type Validation at Runtime (Low)

**File:** `src/lib/core/utils.ts:94–99`, `src/lib/core/h1.ts:112`

```ts
export function safeParseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}
```

All JSON from external sources (API, filesystem) is cast with `as T` after `JSON.parse` — there's no runtime validation. If the API changes shape (e.g., a field is removed from h1.sh output), the dashboard silently renders broken or empty UI with no console warning.

**Recommendation:** Add lightweight runtime validation for critical API shapes (at minimum H1 reports/programs). Use a validation library (zod, valibot) or at minimum assert required fields exist and log warnings on mismatch.

---

## Summary

| # | Gap | Severity | Effort |
|---|-----|----------|--------|
| 1 | Monolithic SSE push — no per-domain subscriptions | High | L |
| 2 | Promise.all brittleness — single failure kills all | High | S |
| 3 | Race condition in getH1ReportsRaw mutex | High | S |
| 4 | No loading states in components | Medium | M |
| 5 | SSE reconnection not handled | Medium | S |
| 6 | Shallow merge loses nested SSE data | Medium | S |
| 7 | Global mutable consecutiveSsrFailures | Medium | S |
| 8 | Optimistic implementState without rollback | Medium | M |
| 9 | Poller leak for removed packages | Medium | S |
| 10 | DecisionTrace lazy-load blocks tab for seconds | Low-Med | M |
| 11 | Hardcoded agent definitions | Low | S |
| 12 | No getAllData request deduplication | Low | S |
| 13 | Logs always tails disk, no cache | Low | S |
| 14 | No stale-while-revalidate for API caches | Low | M |
| 15 | No runtime type validation for external JSON | Low | M |

**Quick wins (all Severity: High, Effort: Small):** #2 (Promise.allSettled), #3 (fix H1 mutex), #6 (deep merge).

**Architectural consideration:** The project avoids Svelte stores entirely — this is a deliberate design choice, not a gap. The functional core module pattern works well for this dashboard's data flow. The main structural risk is the monolithic SSE push (#1) which will become a bottleneck as more tabs and data domains are added.
