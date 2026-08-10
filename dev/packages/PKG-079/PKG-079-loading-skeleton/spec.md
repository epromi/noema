# PKG-079: LoadingSkeleton Integration

**Status:** 📋 F0 (Specification Complete)
**Priority:** HIGH
**Becsült idő:** 2-3 óra
**Forrás:** QA Nightly 2026-08-10 — Phase 1 gap scan (UI Components C1)
**Tags:** ux, loading, skeleton, a11y

## Problem

`LoadingSkeleton.svelte` exists with 3 variants (`card`, `table`, `metrics`), proper `aria-busy`, `aria-label`, and `prefers-reduced-motion` support — but it is **never imported** by any component. 17 tab components + shared widgets render with zero visual feedback while data loads asynchronously.

## Solution

Wire `LoadingSkeleton` into all components that fetch data asynchronously:

1. `tabs/Agents.svelte` — skeleton table while agent data loads
2. `tabs/Crons.svelte` — skeleton table while cron data loads
3. `tabs/H1.svelte` — skeleton cards while H1 data loads
4. `tabs/Overview.svelte` — skeleton metrics + agent cards while data loads
5. `tabs/Noema.svelte` — skeleton while dev packages load
6. `tabs/KanbanBoard.svelte` — skeleton columns while action items load
7. `shared/AgentDetailPanel.svelte` — skeleton while agent detail resolves
8. `shared/CpuWidget.svelte` — skeleton bar while CPU data loads

Each component should:
- Add a `loading` state (`$state(true)` initially, set to `false` when data prop is populated)
- Render `<LoadingSkeleton skeleton="<variant>" label="<name>" count="<N>" />` while loading
- Variant mapping: table data → `"table"`, cards/metrics → `"card"`, lists → `"list"`, CPU widget → `"metrics"`

## Scope Check

✅ `src/lib/components/tabs/` — All tab components
✅ `src/lib/components/shared/` — AgentDetailPanel, CpuWidget
✅ Purely additive — no existing behavior changed
✅ No config, stores, routes, or server files touched

## Files

| File | Action |
|------|--------|
| `src/lib/components/tabs/Agents.svelte` | Add loading guard + import LoadingSkeleton |
| `src/lib/components/tabs/Crons.svelte` | Add loading guard + import LoadingSkeleton |
| `src/lib/components/tabs/H1.svelte` | Add loading guard + import LoadingSkeleton |
| `src/lib/components/tabs/Overview.svelte` | Add loading guard + import LoadingSkeleton |
| `src/lib/components/tabs/Noema.svelte` | Add loading guard (packages.length === 0 already handles) |
| `src/lib/components/tabs/KanbanBoard.svelte` | Add loading guard + import LoadingSkeleton |
| `src/lib/components/shared/AgentDetailPanel.svelte` | Add loading guard for agent detail data |
| `src/lib/components/shared/CpuWidget.svelte` | Add loading guard + import LoadingSkeleton |

## Verification

- `pnpm check` — must pass
- Visual: visit each tab with throttled network → skeletons appear before data
- Screen reader: skeletons should announce "Loading agents…" with aria-busy="true"
