# PKG-052: Extract Shared UI Utilities 🧰

**Created**: 2026-07-16 | **Source**: QA Nightly component scan (findings #1-4, #18, #24)
**Scope**: ✅ non-core (new utility files, component import updates) | **Estimated**: 1.5h

## Problem

5 utility functions are **duplicated across 2-4 components** each. Same logic, different files — any bug fix requires editing N places.

| Function | Duplicated In | Behavior |
|----------|--------------|----------|
| `cronIcon()` | CronSidebar.svelte, Orchestrator.svelte | Map cron status → emoji icon |
| `cronStatusClass()` | CronSidebar.svelte, Orchestrator.svelte | Map cron status → CSS class |
| `formatLastRunForSchedule()` | CronSidebar.svelte, Orchestrator.svelte | Format last run time for timeline |
| `ottoIcon()` | Orchestrator.svelte, Research.svelte | Map ok/warn/else → ✅/⚠️/❌ |
| `proposalColor()` | Orchestrator.svelte, Research.svelte | Map priority → display color |
| `na()` | H1.svelte, Overview.svelte | Fallback display: null/undefined → "N/A" |

**Additional candidates from finding #24**:
- `formatLastRun()` (CronSidebar, Orchestrator)
- `formatProcessorCountdown()` (Orchestrator, CronSidebar)
- `parseDueDate()` (Bills)

## Fix

### Step 1: Create shared utility modules

```
src/lib/core/
  ├── cron-utils.ts        ← cronIcon, cronStatusClass, formatLastRunForSchedule, formatLastRun
  ├── status-icons.ts      ← ottoIcon
  ├── dev-packages.ts      ← proposalColor (extend existing module)
  └── display-utils.ts     ← na, formatProcessorCountdown, parseDueDate
```

### Step 2: Update component imports

Each component: remove local function definition → import from shared module.

### Step 3: Verify

- `pnpm check` passes
- All cron icons render identically
- All status icons render identically
- All display values render identically
- No behavior change — purely deduplication

## File Changes

| File | Change |
|------|--------|
| `src/lib/core/cron-utils.ts` | NEW — export cronIcon, cronStatusClass, formatLastRunForSchedule, formatLastRun |
| `src/lib/core/status-icons.ts` | NEW — export ottoIcon |
| `src/lib/core/display-utils.ts` | NEW — export na/displayValue, formatProcessorCountdown, parseDueDate |
| `src/lib/core/dev-packages.ts` | Append proposalColor export |
| `src/lib/components/layout/CronSidebar.svelte` | Remove local defs → import from cron-utils.ts |
| `src/lib/components/tabs/Orchestrator.svelte` | Remove local defs → import from cron-utils.ts, status-icons.ts, display-utils.ts |
| `src/lib/components/tabs/Research.svelte` | Remove local defs → import from status-icons.ts, dev-packages.ts |
| `src/lib/components/tabs/H1.svelte` | Remove local defs → import from display-utils.ts |
| `src/lib/components/tabs/Overview.svelte` | Remove local defs → import from display-utils.ts |
| `src/lib/components/tabs/Bills.svelte` | Remove parseDueDate → import from display-utils.ts |

## Verification

- `pnpm check` passes (0 errors, 0 warnings)
- All icons, colors, and display values render identically
- No behavior regression in any tab
- DevJobIndicator, Orchestrator timeline, CronSidebar, Research proposals all work

## Rollback

Each utility module is independent. Git revert individual commits.
All component functions preserved during migration — no data loss risk.

## Dependencies

- PKG-023 (Orchestrator Tab) — already complete
- No new external dependencies (pure TypeScript refactor)
