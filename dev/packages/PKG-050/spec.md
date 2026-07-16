# PKG-050: Shared MetricCard & DataTable Components

**Status**: 🤖 auto-ready (spec only — requires tab-level refactoring across multiple files)
**Source**: QA 2026-07-15 — Phase 1 gap-components #16, #17
**Priority**: 🟡 High (maintenance)
**Scope**: ✅ Non-core — UI components only

## Problem

The same `metric-card` → `metric-value` → `metric-label` pattern is copy-pasted 12 times across Overview, H1, and Viktor tabs. The same `<div class="table-wrap"><table class="data-table">` pattern is copy-pasted across 5+ tabs (Agents, Crons, Bills, H1, Viktor). This creates maintenance burden — any styling change requires editing 5-12 locations.

## Solution

Extract two shared components:

1. **`MetricCard.svelte`** — Reusable KPI card with value, label, optional sub-value, and status-based coloring
2. **`DataTable.svelte`** — Reusable data table with built-in empty/loading/error states, sortable columns, and accessible markup

## Specification

### MetricCard API
```svelte
<MetricCard
  value={count}          // number | string
  label="Agents"         // string
  sub="12 active"        // string (optional)
  status="ok"            // "ok" | "warn" | "error" (optional)
  icon="🤖"              // string (optional)
  onClick={() => {}}     // () => void (optional)
/>
```

### DataTable API
```svelte
<DataTable
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status' },
  ]}
  rows={items}
  emptyMessage="No items found"
  loading={false}
  error="Failed to load"
/>
```

## Implementation

### Files to create:
- `src/lib/components/shared/MetricCard.svelte`
- `src/lib/components/shared/DataTable.svelte`

### Files to modify (use new components):
- `src/lib/components/tabs/Overview.svelte` — Replace metric-card blocks with MetricCard
- `src/lib/components/tabs/H1.svelte` — Replace metric-card blocks with MetricCard
- `src/lib/components/tabs/Viktor.svelte` — Replace metric-card blocks with MetricCard
- `src/lib/components/tabs/Agents.svelte` — Replace table with DataTable
- `src/lib/components/tabs/Crons.svelte` — Replace table with DataTable

## Acceptance Criteria

- [ ] MetricCard component with value, label, sub, status, icon, onClick props
- [ ] DataTable component with columns, rows, emptyMessage, loading, error props
- [ ] DataTable has scope="col" on all th elements (accessibility built-in)
- [ ] At least 2 tabs refactored to use MetricCard
- [ ] At least 1 tab refactored to use DataTable
- [ ] pnpm check passes (0 errors, 0 warnings)
- [ ] No changes to: `src/routes/`, `src/lib/stores/`, `src/lib/server/`, config files

## Estimated Effort
- MetricCard: 30min
- DataTable: 45min
- Tab refactoring: 90min
- Total: ~3h
