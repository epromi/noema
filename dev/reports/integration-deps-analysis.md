# Integration & Dependency Analysis — Noema Dashboard
**Date:** 2026-07-31 | **Scope:** `src/` full-tree

---

## 1. Component Usage: Imports from `$lib/components/`

### Tab Components in `+page.svelte` (13 tabs)

| Tab | File Exists | Status |
|-----|------------|--------|
| Overview | ✅ | Active |
| Agents | ✅ | Active |
| Crons | ✅ | Active |
| Orchestrator | ✅ | Active (imports 5 sub-tabs) |
| Noema | ✅ | Active |
| Brainstorm | ✅ | Active |
| Bills | ✅ | Active |
| Research | ✅ | Active |
| LogsViewer | ✅ | Active |
| AuditTrail | ✅ | Active |
| DecisionTrace | ✅ | Active |
| H1 | ✅ | Active |
| Viktor | ✅ | Active |

### Sub-tabs (imported by Orchestrator only)

| Component | Used By |
|-----------|---------|
| CronTimeline | Orchestrator |
| KanbanBoard | Orchestrator |
| OttoTimeline | Orchestrator |
| ProcessorTimer | Orchestrator |
| ResearchProposals | Orchestrator |

### HIGH: Dead Components (4 files)

These exist in the tree but are **never imported anywhere**:

| File | Type | Size | Issue |
|------|------|------|-------|
| `src/lib/components/tabs/SessionHealth.svelte` | Tab | — | Dead tab — not in +page.svelte, not imported by any other component |
| `src/lib/components/ui/LoadingSkeleton.svelte` | UI | — | Dead UI component — never imported |
| `src/lib/components/shared/LogPanel.svelte` | Shared | — | Dead shared component — never imported |
| `src/lib/components/shared/CronTimeline.svelte` | Shared | — | **Duplicate name** with `tabs/CronTimeline.svelte` — this Gantt renderer is unused; the tab version never references it |

**Recommendation:** Delete the 4 dead files. For `shared/CronTimeline.svelte` specifically, decide whether to integrate it into `tabs/CronTimeline.svelte` (it renders `CronGanttData`) or remove it.

---

## 2. Barrel Exports (index.ts / index.js)

```
find src/lib/components -name "index.ts" -o -name "index.js"
→ (no results)
```

### MEDIUM: Zero barrel exports in component directories

All component imports use **direct file paths**:

```ts
// Current pattern (verbose):
import Overview from "$lib/components/tabs/Overview.svelte";
import BuildIntegrityBanner from "$lib/components/shared/BuildIntegrityBanner.svelte";
import CronSidebar from "$lib/components/layout/CronSidebar.svelte";
```

No `index.ts` files exist in `shared/`, `tabs/`, `ui/`, or `layout/`. For 13 tabs + 11 shared/layout components, this is manageable but fragile — renaming a file breaks every import.

**Recommendation:** Add barrel exports for high-churn directories (shared/, tabs/). Not urgent given current file count.

---

## 3. Core Module Import Graph

```
src/lib/core/index.ts  (barrel)
  ├── agents.ts       → $lib/providers, $lib/types, ./utils.ts
  ├── bills.ts        → $lib/providers, $lib/types
  ├── calendar.ts     → $lib/providers, $lib/types
  ├── crons.ts        → $lib/providers, $lib/types
  ├── h1.ts           → $lib/providers, $lib/types
  ├── health.ts       → $lib/providers, $lib/types
  ├── noema.ts        → $lib/providers, $lib/types
  ├── research.ts     → $lib/providers, $lib/types
  ├── logs.ts         → $lib/providers, $lib/types
  ├── audit-trail.ts  → $lib/providers, $lib/types
  ├── decision-trace.ts → $lib/providers, $lib/types
  ├── dev-loop-log.ts → $lib/providers, $lib/types
  ├── dev-packages.ts → (pure computation — no provider imports)
  ├── build-integrity.ts → fs/child_process (no provider)
  ├── agent-detail.ts → $lib/types
  └── utils.ts        → (pure utility — no imports)
```

**Core → Core imports:** ZERO (except `index.ts` → all leaves, and `agents.ts → utils.ts`).

### LOW: Clean architecture — no circular dependencies

Every core module is a **leaf** — it imports only from `$lib/providers` and `$lib/types`. The barrel `index.ts` composes them. `index.ts` imports all leaves, but leaves never import `index.ts` — no cycle possible.

**Component → Core imports (6 components):**

| Component | Core Modules Used |
|-----------|-------------------|
| `DevJobIndicator.svelte` | `$lib/core/noema-devjob` |
| `CronSidebar.svelte` | `$lib/core/cron-utils` |
| `DevPackageRow.svelte` | `$lib/core/dev-packages` |
| `tabs/CronTimeline.svelte` | `$lib/core/cron-utils` |
| `tabs/Noema.svelte` | `$lib/core/dev-packages` |
| `tabs/Orchestrator.svelte` | `$lib/core/noema-devjob` |

Only 6 out of 30+ components import from core — most data flows through props from the page.

---

## 4. Server-to-Client Boundary

```
grep -r "from.*\$lib/server" src/ --include="*.svelte"
→ (no matches — exit code 1)
```

### ✅ LOW: No boundary violations

Zero `.svelte` files import from `$lib/server/`. The Vite/SvelteKit boundary is cleanly respected.

---

## 5. Data Flow: SSE → Cache → Collector → Component Chain

### Full Architecture

```
hooks.server.ts (cold start)
  └── startCollector()                     [every request, idempotent]
        └── collectOnce()                  [then every 60s]
              ├── getProvider()            [$lib/providers → openclaw-singleton]
              ├── getAllData(providers)    [$lib/core/index.ts → 12 parallel fetches]
              ├── setCache(data)           [in-memory, server-side]
              └── broadcast(data)          [push to all SSE clients]

hooks.server.ts (cold start)
  └── startPkgWatcher()                    [fs.watch on dev/packages/INDEX.md]
        └── collectOnce() on file change   [500ms debounce]

SSR Path (+page.server.ts, +layout.server.ts):
  1. Try file cache: data/dashboard-cache.json (5-min TTL, sync read)
  2. Cache miss → getAllData(providers) + getDevPackages(providers) [25s timeout]
  3. Validate and sanitize with empty() fallbacks for every field
  4. Write back to data/dashboard-cache.json

SSE Path (client → /api/events):
  1. GET /api/events → ReadableStream
  2. Immediately push cached data if available (getCache())
  3. Register send() callback with addClient(send)
  4. collector broadcast() pushes fresh data to all clients every 60s
  5. 30s keepalive pings

Client Path (+page.svelte):
  1. Mount: serverData from +page.server.ts (SSR)
  2. Open EventSource("/api/events")
  3. onmessage: merge sseData over serverData (SSE wins when present)
  4. $effect: reset sseData to null when serverData changes (nav/refresh)
  5. Additional: /api/running poll for dev job queue status (10s)
```

### MEDIUM: Dual cache system with potential staleness

**Two independent caches exist:**

| Cache | Location | TTL | Purpose |
|-------|----------|-----|---------|
| In-memory | `cache.ts` → `getCache()` | None (collector-driven) | Feed SSE clients on connect |
| File-based | `data/dashboard-cache.json` | 5 min | Speed up SSR cold starts |

**Conflict scenario:** SSE client connects, gets stale in-memory cache from `getCache()`, then SSR-fetched fresh data arrives via file cache — but SSE clients only receive new data when `collector.broadcast()` fires (every 60s).

**Recommendation:** Unify the two caches. Have `collectOnce()` write to the file cache so both paths share a single source of truth. The `+page.server.ts` file-cache path should only be hit on cold SSR (no active server), making it a pure fallback.

### MEDIUM: SSR path duplicates collector work

`+page.server.ts` calls `getAllData(providers)` directly on cache miss — the same function `collectOnce()` calls. But `collectOnce()` runs every 60s regardless. On a cache miss during SSR:

1. `+page.server.ts` fires `getAllData()` (15-25s to Gateway)
2. `collectOnce()` timer fires independently (60s cycle)
3. Both paths call the same Gateway APIs → wasted calls, potential rate limiting

**Recommendation:** On cache miss in SSR, wait for the next collector cycle (max 60s) instead of duplicating the call. Or have `collectOnce()` write to the shared file cache and have SSR only read from cache.

---

## 6. `agent-icons.ts` — Actually Used ✅

Despite initial grep confusion, `agent-icons.ts` IS imported and used:

```
CronSidebar.svelte:  import { AGENT_ICONS } from "$lib/components/shared/agent-icons";
tabs/CronTimeline.svelte:  import { AGENT_ICONS } from "$lib/components/shared/agent-icons";
```

Not dead code.

---

## Summary Matrix

| # | Finding | Severity | Evidence | Recommendation |
|---|---------|----------|----------|----------------|
| 1 | Dead components (4 files) | **HIGH** | Zero imports anywhere in `src/` | Delete SessionHealth, LoadingSkeleton, LogPanel, shared/CronTimeline |
| 2 | No barrel exports in components | **MEDIUM** | `find` returned no index.ts files | Add barrel exports (low priority given 24 components) |
| 3 | Duplicate CronTimeline names | **MEDIUM** | `shared/CronTimeline.svelte` (Gantt, unused) + `tabs/CronTimeline.svelte` (tab, used) | Merge or rename; don't keep dead duplicate |
| 4 | Dual cache system | **MEDIUM** | In-memory `cache.ts` + file `dashboard-cache.json` | Unify to single source of truth |
| 5 | SSR duplicates collector work | **MEDIUM** | Both call `getAllData()` independently | Have SSR wait for collector cycle or read shared cache |
| 6 | Zero circular dependencies | ✅ LOW | All core modules are leaves | Maintain this pattern |
| 7 | No server→client boundary leaks | ✅ LOW | Zero `.svelte` files import `$lib/server` | Already clean |
| 8 | Provider abstraction layer | ✅ LOW | `$lib/providers/` with typed interfaces | Well-designed for testability |

---

## Action Items

- [ ] **Delete 4 dead components** — `SessionHealth.svelte`, `LoadingSkeleton.svelte`, `LogPanel.svelte`, `shared/CronTimeline.svelte`
- [ ] **Unify caches** — make `collectOnce()` write to `data/dashboard-cache.json`; have SSR only read cache (no direct `getAllData()` call)
- [ ] **Fix SSR duplication** — SSR cache miss should either wait for next collector cycle (max 60s) or `await collectOnce()` which already handles dedup
- [ ] **Rename decision** — if Gantt rendering is needed, integrate `shared/CronTimeline.svelte` into `tabs/CronTimeline.svelte`; otherwise delete it
