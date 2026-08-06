# GAP SCAN: State Management — Noema Dashboard

**Audit date:** 2026-08-06 (re-scan)
**Previous scan:** 2026-08-02 (15 findings)
**Scope:** `src/lib/core/*.ts`, `src/routes/+page.svelte`, `src/routes/+page.server.ts`, `src/lib/providers/*.ts`, `src/lib/server/*.ts`, `src/lib/components/*.svelte`

**Architecture:** No stores directory. Functional core module pattern with async fetchers + module-level caches + SSR/SSE push. Svelte 5 `$state`/`$derived` runes used in components.

---

## Changes Since 2026-08-02

**Fixed (QA 2026-08-05, commit `0328ef6e`):**
- SSE client cap: `MAX_CLIENTS = 100` (was unbounded `Set`)
- Collector error logging: `.catch()` on `collectOnce()`
- Cache TTL expiration warning: warns when returning null
- Server services startup validation: checks `OPENCLAW_GATEWAY_TOKEN` env var

**Partially addressed:**
- Gap #6 (shallow merge): Comment updated to say "Deep merge" but CODE is still shallow — comment is misleading.

---

## NEW Findings (2026-08-06)

### N1. $effect Clears SSE Data on ServerData Change — Silent Data Loss (Medium)

**File:** `src/routes/+page.svelte:32-35`

```ts
$effect(() => {
  serverData;       // dependency tracking
  sseData = null;   // clear SSE on re-navigate
});
```

**Bug:** The intent is to reset SSE data when the page re-navigates. But `$effect` runs synchronously with `serverData` changes. If an SSE message arrives between `serverData` being set and the next render cycle, the `sseData` is set to `null` by the effect, but the `$derived` fallback `{ ...serverData, ...sseData }` will use the new `serverData` — so data isn't strictly lost. However, the SSE message that triggered the effect won't render until the NEXT SSE message arrives because the effect nulled it mid-cycle. This causes a **one-frame flicker** where dashboard data briefly drops to SSR-only values.

**Additionally:** If `serverData` changes AND an SSE message has just been received in the same microtask, `sseData` is nulled before the render which means the user sees cached SSR data instead of the fresh SSE data.

**Recommendation:** Track `serverData` with a separate boolean flag (`let sseActive = $state(false)`) instead of nulling `sseData`. Set `sseActive = true` in the SSE handler, and only null `sseData` when `serverData` changes AND no SSE has arrived since.

---

### N2. `getH1ReportsRaw()` Still Writes Nothing to Cache — Every Call is a Fresh API Hit (Medium)

**File:** `src/lib/core/h1.ts:411-424`

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
    const raw = await p.tool.h1Command("my-reports");  // NEW API CALL
    return extractH1Json(raw);                          // RETURNS, never caches
  } catch {
    return null;
  }
}
```

**Bug:** If `getH1Data()` calls `getH1ReportsRaw()` when the 60-min cache has expired, it makes an API call but **never sets `reportsFetchPromise` mutex** and **never writes to `reportsCache`**. This means:

1. The `getH1Reports()` above it (which DOES set the mutex) is never invoked, so no deduplication
2. If `collector.ts` calls `getAllData()` → `getH1Data()` → `getH1ReportsRaw()` at the same time as the SSR page load, **two duplicate API calls** go out
3. The result is thrown away after consumption — next call hits the API again

**What saves this partially:** `getH1Data()` sets its own `h1DataPromise` mutex, so concurrent `getH1Data()` calls ARE deduplicated at the top level. But `getH1ReportsRaw()` itself can still race with `getH1Reports()` if they're called from different code paths.

**Recommendation:** `getH1ReportsRaw()` should be removed entirely. `getH1Reports()` already returns the parsed reports AND stores them in `reportsCache.raw`. After calling `getH1Reports()`, access `reportsCache.raw` directly.

---

### N3. DevJobIndicator + Page Poller Duplication — Double Fetch Per Cycle (Low)

**File:** `src/lib/components/DevJobIndicator.svelte:73-78`, `src/routes/+page.svelte:41-43`

Both components independently poll the relay:

```
DevJobIndicator:  setInterval(refresh, 10_000) → getDevJobStatus() → fetch /api/next-trigger + /api/running
+page.svelte:     setInterval(refreshQueueStatus, 10_000) → getDevJobStatus() → fetch /api/next-trigger + /api/running
```

**Impact:** 4 HTTP requests every 10s to two endpoints that could be 2. The `+page.svelte` poll needs `queueStatus` for `packageStates` while `DevJobIndicator` needs display info — but they fetch the SAME data from the SAME endpoints.

**Recommendation:** Share a single `getDevJobStatus` result via a module-level reactive or by having `+page.svelte` pass the status down as a prop. Or create a shared `refreshDevJobStatus()` in `noema-devjob.ts` with a mutex (like H1's pattern).

---

### N4. `packageStates` Entirely Ephemeral — Lost on Page Reload (Low)

**File:** `src/routes/+page.svelte:75,139-186`

```ts
let packageStates = $state<Record<string, PkgState>>({});
```

Unlike `DevJobIndicator` which persists position + collapsed state to `localStorage`, `packageStates` (implementState, logOpen, logContent, queueStatus) is **fully ephemeral**:

- On page reload: all log panels close, all implement states reset to "idle"
- If a package was implementing mid-reload: the queue poller detects `runningId` and auto-re-enables, but the log panel stays closed
- The user has to re-expand the log for a running package to see its output
- `logContent` is lost — the log has to re-fetch from the API

**Recommendation:** Persist at minimum `implementState` and `showLogButton` to `sessionStorage`. Auto-expand log panels for packages where `implementState === "running"` on mount.

---

### N5. First Page Load Always Slow — No Pre-Warming Cache (Low)

**File:** `src/hooks.server.ts:7-22`, `src/routes/+page.server.ts:221`

```
Hook (first request): startCollector() → collectOnce() (15-25s blocking if Gateway query)
SSR load:            getAllData() (25s timeout) + file cache miss on first boot
```

**Problem:** The collector starts on the first HTTP request. But the collector runs `collectOnce()` asynchronously (`void collectOnce()`). The SSR page loader ALSO calls `getAllData()` synchronously. Both hit the Gateway simultaneously:

1. Collector: `getAllData()` → Gateway commands (15-25s)
2. SSR: `getAllData()` → Gateway commands (15-25s) — **duplicate work**
3. Because `getH1Data()` has its own mutex but the others DON'T, many modules run duplicate API calls

**Result:** First page load is slow (up to 25s timeout), and the user sees empty/N/A data until the cache is populated.

**Recommendation:** In `hooks.server.ts`, `await collectOnce()` before completing the hook (at least for the first request), so the cache is populated before SSR runs. Or: `ssr.ts` should use `Promise.allSettled()` with shorter timeouts per module and return partial data immediately, streaming the rest.

---

### N6. `collectOnce()` Mutex Clearance Race (Extremely Unlikely, Documented) (Low)

**File:** `src/lib/server/collector.ts:14-28`

```ts
export async function collectOnce(): Promise<DashboardData> {
  if (collectPromise) return collectPromise;
  collectPromise = (async () => {
    // ... fetch + cache + broadcast
    return data;
  })();
  try {
    return await collectPromise;
  } finally {
    collectPromise = null;  // ← RACE WINDOW HERE
  }
}
```

**Race:** Between `collectPromise = null` in the `finally` block and the function returning, if another call enters and sees `collectPromise === null`, it launches a second collection. This window is ~microseconds in single-threaded Node.js, but with `async`/`await` suspension points inside, it's theoretically possible.

**Recommendation:** Use a boolean flag or a version counter. Set `collectPromise = null` BEFORE the `await`, not after.

---

## Still Open from 2026-08-02 Scan

### Unfixed

| # | Gap | Severity | Why Still Open |
|---|------|----------|----------------|
| 1 | Monolithic SSE push — no per-domain subscriptions | High | No changes, still pushes full DashboardData |
| 2 | Promise.all brittleness — accidentally safe but fragile | High | Still `Promise.all`; relies on every getter having try/catch |
| 3 | `getH1ReportsRaw()` mutex race | High | Still makes uncached API calls (see N2 above) |
| 6 | Shallow merge can lose nested SSE fields | Medium | Comment says "deep merge" but code is shallow spread — **misleading** |
| 7 | Global mutable `consecutiveSsrFailures` | Medium | Unchanged, still module-level `let` |
| 8 | Optimistic implementState without rollback persistence | Medium | Unchanged, see N4 above |
| 9 | Poller leak for removed packages | Medium | Unchanged |
| 10 | DecisionTrace lazy-load blocks tab for seconds | Low-Med | Unchanged |
| 11 | Hardcoded agent definitions | Low | Unchanged |
| 12 | No getAllData request deduplication | Low | Unchanged (only `getH1Data()` has it) |
| 13 | Logs always tails disk, no cache | Low | Unchanged |
| 14 | No stale-while-revalidate for API caches | Low | Unchanged |
| 15 | No runtime type validation for external JSON | Low | Unchanged |

### Fixed/Addressed

| # | Gap | Resolution |
|---|------|-----------|
| 4 | No loading states in components | QA: not addressed in code but noted |
| 5 | SSE reconnection not handled | QA: not addressed |

---

## Summary Table (All Findings)

| # | Gap | Severity | Effort | Status |
|---|-----|----------|--------|--------|
| 1 | Monolithic SSE push — no per-domain subscriptions | High | L | Open |
| 2 | Promise.all brittleness — single failure kills all | High | S | Open |
| 3 | Race condition in `getH1ReportsRaw` (uncached API calls) | High | S | Open (worse, see N2) |
| N1 | `$effect` clears SSE data on `serverData` change — flicker | Medium | S | **NEW** |
| N2 | `getH1ReportsRaw()` never caches — duplicate API calls | Medium | S | **NEW** |
| 4 | No loading states in components | Medium | M | Open |
| 5 | SSE reconnection not handled | Medium | S | Open |
| 6 | Shallow merge comment is misleading (not actually deep) | Medium | S | **WORSENED** — comment now lies |
| 7 | Global mutable `consecutiveSsrFailures` | Medium | S | Open |
| 8 | Optimistic implementState without rollback persistence | Medium | M | Open |
| 9 | Poller leak for removed packages | Medium | S | Open |
| N3 | DevJobIndicator + page poller duplicate fetches | Low | S | **NEW** |
| N4 | `packageStates` entirely ephemeral — lost on reload | Low | S | **NEW** |
| N5 | First page load always slow — no pre-warming | Low | M | **NEW** |
| N6 | `collectOnce()` mutex clearance race | Low | S | **NEW** |
| 10 | DecisionTrace lazy-load blocks tab for seconds | Low-Med | M | Open |
| 11 | Hardcoded agent definitions | Low | S | Open |
| 12 | No getAllData request deduplication | Low | S | Open |
| 13 | Logs always tails disk, no cache | Low | S | Open |
| 14 | No stale-while-revalidate for API caches | Low | M | Open |
| 15 | No runtime type validation for external JSON | Low | M | Open |

**Total: 21 findings** (15 from Aug 2 + 6 new)
**Quick wins (Severity: High, Effort: Small):** #2 (Promise.allSettled), #3 (fix H1 mutex), Gap #6 (true deep merge)

**Pattern note:** The Aug 5 QA (#0328ef6) fixed infrastructure-level issues (cap, logging, validation) but missed data-flow races (#3/N2, #7) and the misleading deep-merge comment (#6).
