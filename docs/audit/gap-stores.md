# GAP SCAN: State Management — Noema

**Date**: 2026-07-17
**Scope**: `src/lib/components/`, `src/lib/server/`, `src/routes/`, `src/lib/core/`
**Method**: Full file audit — no traditional stores exist; Svelte 5 runes (`$state`, `$derived`, `$effect`) are used inline across 14+ components.

---

## Architecture Summary

Noema has **zero standalone store files** (`src/lib/stores/` is empty). All state lives in Svelte 5 runes inside `.svelte` components, prop-drilled from `+page.svelte` downward. The data pipeline is:

```
Server-side (collector.ts) → in-memory cache → SSE broadcast → +page.svelte ↔ $derived merge → child components
                                                                          ↘ polling (5s/10s intervals)
```

**Server-state modules**:
| Module | State | Concurrency |
|--------|-------|-------------|
| `cache.ts` | Single `DashboardData \| null` reference | No locking |
| `sse.ts` | `Set<send>` of client callbacks | For-of iteration, no size cap |
| `collector.ts` | `collectPromise` dedup flag | Module-level singleton |

**Client-state modules** (Svelte 5 runes per component):
| Component | State Variables | Derived | Effects | Timers |
|-----------|----------------|---------|---------|--------|
| `+layout.svelte` | `activeTab`, `isMobile`, `cronOverlay` | 0 | SSE connect | 0 |
| `+page.svelte` | `sseData`, `packageStates`, `liveBuildDirty`, `pkgList`, `runningId`, `nextTriggerMs` | 3 | SSE reset, 3 polls | 2 intervals |
| `Noema.svelte` | `searchQuery`, `activePane`, session open toggles, sort prefs | ~12 derived | localStorage load | 1 interval |
| `DecisionTrace.svelte` | `selectedSession`, `selectedStep`, `traces` | 3 derived | onMount fetch | 1 interval |
| `Orchestrator.svelte` | `actionStates`, `errors` | 0 | 0 | 1 interval |
| `LogsViewer.svelte` | `liveLogs`, `activeFilter`, `reversed` | 4 derived | SSE merge, onMount fetch | 1 interval |
| `LogPanel.svelte` | `liveContent`, `contentHash`, `reversed`, `fetchError`, `firstOpenScroll` | 2 derived | open/poll toggles | 1 interval |
| `DevJobIndicator.svelte` | `left`, `top`, `collapsed`, `runningId`, `nextTriggerMs` | 2 derived | localStorage load | 3 intervals |
| `CronSidebar.svelte` | `collapsed`, `nowMs` | 4 derived | localStorage load | 1 interval |
| `ProcessorTimer.svelte` | `nowMs` | processor state, 2 text fields | 0 | 1 interval |
| `AuditTrail.svelte` | filters (session, agent, event, timeRange) | 1 derived | 0 | 0 |
| `H1.svelte` | (none) | 2 derived | 0 | 0 |
| `Viktor.svelte` | (none) | 1 derived | 0 | 0 |

**Total independent polling intervals across the app: 12.**

---

## Findings

### 🔴 CRITICAL

#### F1: Two SSE connections open in the same page load
**Location**: `+layout.svelte:17` + `+page.svelte:63`
**Problem**: Both `+layout.svelte` and `+page.svelte` independently open `EventSource` connections to `/api/events`. The layout only extracts `crons`/`buildIntegrity`, while the page extracts everything. This means 2x server-side fan-out (`getAllData()`), 2x cache serialization, 2x JSON deserialization per client — **doubling the server load per connected tab**.
**Fix**: Move the single `EventSource` to `+layout.svelte`, store the parsed data in a reactive context (e.g., Svelte 5 module-level `$state` or `setContext()`), and have `+page.svelte` derive from it instead of opening its own connection.

#### F2: `collector.ts` `collectPromise` dedup can serialize page loads
**Location**: `src/lib/server/collector.ts` (lines 71–99, the `collectOnce` and `ensureTimely` methods)
**Problem**: A single `collectPromise` module-level variable gates all concurrent collect calls. If an SSR page load calls `collectOnce()` during a periodic collection cycle (which can take 25s with retries), **all simultaneous requests queue behind the same promise**. Under load, this serializes SSR rendering — every request waits for the current collect cycle to finish.
**Fix**: Use a per-request dedup key (e.g., `Map<string, Promise>`) or a read-through cache pattern: serve stale cache immediately while triggering background refresh asynchronously.

#### F3: `sse.ts` unbounded client set — memory leak on fast disconnect/reconnect
**Location**: `src/lib/server/sse.ts:9` (`const clients = new Set<...>`)
**Problem**: The `Set<send>` grows without bound. On client disconnect, the `request.signal.addEventListener("abort", cleanup)` handler calls `unsubscribe()`, which removes the callback from the Set. But if a disconnect is abrupt (network drop, browser crash), `abort` may never fire, leaving dead callbacks in the Set. These callbacks hold references to closed `ReadableStream` controllers and encoder instances.
**Fix**: Add a `size` check on the Set. When iterating during broadcast, catch closed-stream errors and proactively remove dead callbacks. Consider capping the set at ~100 and logging warnings above that.

---

### 🟡 HIGH

#### F4: `+page.svelte` uses stale SSR props after SSE merge
**Location**: `src/routes/+page.svelte:89–93` (`$effect(() => { serverData; sseData = null; })`)
**Problem**: When `serverData` changes (full navigation), the `$effect` resets `sseData` to `null`. However, there's a **render frame gap**: between the effect firing and the next SSE message arriving, the page renders with `data.error` (null SSE state) instead of the stale-but-current SSR data. This causes a brief flash of "empty" state on page transitions.
**Fix**: Instead of nulling `sseData`, set it to the incoming `serverData` values, then let SSE overwrite them on arrival.

#### F5: `packageStates` reactive map has stale-read potential
**Location**: `src/routes/+page.svelte:54` (`let packageStates: $state<Record<string, PkgState>> = {}`)
**Problem**: The `setState` helper reads from the same `$state` proxy it writes to: `packageStates[pkgId] = { ...getState(pkgId), ...patch }`. In Svelte 5, spread syntax on a proxied object can trigger reactive reads mid-write. While Svelte 5 batches updates, the read-before-write pattern inside a single call site introduces a window where concurrent effects could see a partially-updated state.
**Fix**: Use `untrack(() => getState(pkgId))` to read the current value without establishing reactive dependencies, then apply the write.

#### F6: No loading states anywhere — silent stale data
**Location**: All components with async data (`+page.svelte`, `LogsViewer.svelte`, `LogPanel.svelte`, `Orchestrator.svelte`, `DecisionTrace.svelte`, `DevJobIndicator.svelte`)
**Problem**: Every component renders immediately with SSR data (or empty state). None of them show a loading indicator when:
- SSE reconnects after disconnection (invisible 3s backoff)
- Polling API fetches new data (5–10s intervals)
- `DecisionTrace` fetches `/api/decision-trace` (arbitrary network latency)
Users see stale data for up to 10 seconds with no visual feedback that an update is in progress.
**Fix**: Add a `loading: boolean` field to each data type interface. Set it to `true` during fetch, `false` on completion. Components should render a subtle skeleton/spinner when `loading` is true and the data is stale (useful for first-load scenarios).

#### F7: DecisionTrace data is always empty — tab permanently dead
**Location**: `src/lib/core/index.ts:77–84`
**Problem**: The `getAllData()` function returns a hardcoded empty `decisionTrace`:
```ts
const decisionTrace = {
  sessions: [] as DecisionTraceSessionOption[],
  traces: {} as Record<string, DecisionTrace>,
  defaultSessionKey: "",
  updatedAt: Date.now(),
};
```
The comment says "Lazábban — csak on-demand" (lazier — only on-demand), but the downstream `DecisionTrace` component never triggers a fetch itself — it only polls `/api/decision-trace` with a `session` query param **after** a session is selected. Since `sessions` is always empty, the dropdown is empty, the user can never select a session, and the tab is permanently non-functional.
**Fix**: Either populate `decisionTrace.sessions` in `getAllData()` (lightweight — just session keys and timestamps), or have the `DecisionTrace` component call a `/api/decision-trace/sessions` endpoint on mount to populate the dropdown.

---

### 🟠 MEDIUM

#### F8: 12 independent polling intervals — no coordination or shared dedup
**Location**: Across 9 components (see architecture table above)
**Problem**: Multiple components poll overlapping API endpoints at different rates:
- `+page.svelte` polls `/api/running` every 10s
- `DevJobIndicator.svelte` polls `/api/next-trigger` and `/api/running` every 10s
- `Orchestrator.svelte` polls processor status every 5s
- `Noema.svelte` polls `/api/dev-packages` every 5s
- `LogsViewer.svelte` polls `/api/logs` every 10s

Each component fetches independently, so `/api/running` might be hit twice within the same second by different components. The browser's HTTP cache may help, but each request still hits the server, executes the handler, and returns JSON.
**Fix**: Implement a client-side fetch cache layer (`Map<string, { data, ts }>`) with configurable TTL. Components check the cache before fetching. Alternatively, merge all relevant state into the SSE stream and remove the polling intervals entirely.

#### F9: `ProcessorTimer` 1-second render tax for display-only countdown
**Location**: `ProcessorTimer.svelte:23` (or the `onMount` 1s interval)
**Problem**: The `setInterval(() => { nowMs = Date.now() }, 1000)` fires **every second** to update a human-readable countdown string. This triggers full re-computation of `$derived.by(...)` expressions on every tick, 86,400 times per day. The time formatting functions (`formatProcessorCountdown`, `formatClock`) are called at 60fps capability but only the visual result changes once per second.
**Fix**: Svelte 5's `$state` is efficient with micro-granular updates, so this is mostly fine. But if the page is left open for days, the cumulative cost adds up. A lighter alternative: pre-compute the countdown once and schedule the next state update at the boundary when the string will actually change (e.g., `setTimeout` chained to the next second boundary).

#### F10: Delayed localStorage reads on first render
**Location**: `LogsViewer.svelte:39`, `LogPanel.svelte:34`, `CronSidebar.svelte:223`, `DevJobIndicator.svelte:136`, `Noema.svelte:119`
**Problem**: localStorage is read in `onMount()`, not during component initialization. This means the component renders once with defaults (e.g., `reversed = false`), then re-renders after mount with the stored value. Users see a flash of the default setting before their preference kicks in.
**Fix**: Read localStorage synchronously during initialization using `$state` with a browser guard:
```ts
let reversed = $state(browser ? localStorage.getItem(STORAGE_KEY) === "1" : false);
```
Since `localStorage` is synchronous, this works without any mount delay.

#### F11: `LogsViewer` and `LogPanel` share the same localStorage key
**Location**: `LogsViewer.svelte:7` vs `LogPanel.svelte:7` (both `STORAGE_KEY = "log-reversed"` — confirmed via string match against "log-reversed")
**Problem**: Both components read/write the same key `"log-reversed"`. Toggling reverse order in the LogsViewer tab changes the `LogPanel` panel too, and vice versa. While this might be "by design" (they're both log views), it's undocumented and surprising — changing one panel changes the other.
**Fix**: Either document this as intentional shared preference, or use different keys (`"logs-tab-reversed"` vs `"log-panel-reversed"`) if independence is desired.

#### F12: `LogPanel` content dedup via `contentHash` has false negatives
**Location**: `LogPanel.svelte:52–54`
**Problem**: The fetch response is compared against `contentHash` with `if (next === contentHash) return;`. If the server returns the same content twice (no new log lines), the hash matches and the update is silently skipped. This works correctly. But if the server returns a truncated or corrupted response that happens to match the hash (extremely unlikely for logs, but possible in edge cases), the component never recovers.
**Fix**: Add a `retryCount` or `lastFetchedAt` timestamp. If `fetchError` is truthy and `contentHash` hasn't changed, still update `liveContent` to show the latest error state.

---

### 🟢 LOW

#### F13: `Noema.svelte` derived chains do redundant Boolean gating
**Location**: `Noema.svelte:167–192` (approx — the `showSpec`, `showActive`, `showDone`, `specOpen`, `activeOpen`, `doneOpen` $derived block)
**Problem**: Multiple `$derived` values compute the same core filter logic independently:
- `filteredSpec` filters by search + category
- `showSpec` checks `filteredSpec.length > 0`
- `showActive` checks `filteredActive.length > 0`
- `showDone` checks `filteredDone.length > 0`
Each of these runs the full filter pipeline. While Svelte 5 memoizes `$derived` values, the semantic coupling means changing one filter triggers recomputation of all three Boolean guards.
**Fix**: This is already reasonably optimized — Svelte 5's `$derived` is lazy and only recomputes when dependencies change. The Boolean checks are cheap. **No change needed**, just noting the coupling for future refactors.

#### F14: `AuditTrail.svelte` re-filters on every prop change — no memoization
**Location**: `AuditTrail.svelte:51` (the `filterEvents` function inside `$derived`)
**Problem**: `filterEvents` is wrapped in `$derived(filterEvents(auditTrail.events))`, so it recomputes whenever `auditTrail.events`, `sessionFilter`, `agentFilter`, `eventFilter`, or `timeRange` change. This is correct Svelte 5 behavior. However, for large event lists (thousands), the filter-by-filter loop is O(n×4) worst-case. The timeRange filter (`Array.filter` on `timestampMs`) requires scanning every entry on every re-render.
**Fix**: Add a second `$derived` that computes the time-range cutoff once (`const cutoff = $derived...`) so it doesn't get recalculated inside the filter closure. Also consider sorting events by timestamp on the server to make the client filter cheaper (binary search cutoff).

#### F15: `H1.svelte` `sortedPrograms` is not reactive to the data prop
**Location**: `H1.svelte:20`
**Problem**: `sortedPrograms` is a `$derived` that copies the array with spread `[...programs]` before sorting. This creates a new array on every prop update, even if the prop reference hasn't changed (Svelte 5 only triggers `$derived` when tracked dependencies change, so this is actually fine). But the spread-copy-sort pattern is O(n log n) and runs on every SSE update (~every 5 minutes from collector), even if the program list hasn't changed.
**Fix**: Add an identity check: if reference is unchanged, return the previous sorted array. Svelte 5 handles this internally for `$derived` but an explicit guard makes intent clearer.

#### F16: `collector.ts` file cache `Date.now()` check is cheap but repeated
**Location**: `src/lib/server/collector.ts` (the `loadFromFile` and `shouldCollect` methods)
**Problem**: The 5-minute TTL check reads the file's `mtime` on every SSR page load. This is a synchronous `stat` call that blocks the Node.js event loop (though for local files it's microseconds).
**Fix**: Store the `mtimeMs` alongside the parsed cache and only re-stat when the in-memory cache is missing. Use the `cacheAt` timestamp from `cache.ts` instead of re-reading the file.

#### F17: Error ingestion in SSE is string-based — loses structure
**Location**: `+page.svelte:68` (the SSE `error` event handler)
**Problem**: SSE errors are converted to `.error` strings on the data objects. Original error types (network timeout, HTTP 502, JSON parse error) are collapsed into a single string field. Components can't distinguish between "temporary network blip" and "permanent config error" to present appropriate UI.
**Fix**: Add `errorType` and `errorCode` fields to the data types. Define an error enum (`NETWORK | SERVER | PARSE | UNKNOWN`) for client-side routing.

---

## Summary

| Severity | Count | Themes |
|----------|-------|--------|
| 🔴 Critical | 3 | Dual SSE connections, collect serialization, unbounded client set |
| 🟡 High | 4 | Stale-serverData flash, stale reads in $state, no loading states, dead DecisionTrace |
| 🟠 Medium | 5 | Polling coordination, 1s render tax, localStorage flash, shared key, hash dedup |
| 🟢 Low | 5 | Derived coupling, filter perf, unnecessary sort, file stat overhead, error type loss |

**Top 3 actions by impact/effort ratio:**
1. **F1** (merge dual SSE connections) — cuts server load by 50% per tab, 1-hour fix
2. **F4** (remove SSR→SSE flash) — eliminates visible UI glitch on navigation, 30-minute fix
3. **F6** (add loading states) — biggest UX improvement for perceived responsiveness, 2-hour fix across all components

**Architectural note**: The absence of standalone store files is **not inherently a problem** — Svelte 5 runes are the right tool for this pattern. The issues are in how the runes are composed: duplicate connections, uncoordinated polling, and missing intermediate states (loading/error). A `setContext()`-based shared reactive store at the layout level would solve F1, F4, F8, and F10 in one refactor.
