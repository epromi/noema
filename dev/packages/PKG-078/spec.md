# PKG-078: Shared Component Extraction — StatusDot + MetricCard + Format Utils

> 🤖 QA 2026-07-24 Phase 3 | Source: gap-components §7.1-7.6
> Scope: ✅ Non-core | Size: M | Est: 1.5h

## Problem

Duplicate code across tab components creates maintenance burden and inconsistent UX:

1. **StatusDot pattern** — duplicated in 4 files (Agents, Crons, Overview, Viktor). Each implements `.dot-ok`/`.dot-warn`/`.dot-error` CSS and a classifier function with different names (`statusDotClass`, `resultDotClass`, `recallClass`).

2. **MetricCard pattern** — duplicated in 3 files (H1, Overview, Viktor). Same `.metric-card`/`.metric-value`/`.metric-label` structure with identical CSS.

3. **Format utilities** — `na()` duplicated in H1+Overview, `formatLastRun()` in Crons, `formatTime()`/`formatLatency()` in DecisionTrace. All doing similar relative-time formatting.

4. **DataTable CSS** — duplicated 6× across tab components (~30-40 lines of identical table CSS per file).

## Solution

### Step 1: Create `StatusDot.svelte`

```svelte
<!-- src/lib/components/shared/StatusDot.svelte -->
<script lang="ts">
  let { status = 'ok', size = 'md' }: { status: 'ok' | 'warn' | 'error' | 'muted'; size?: 'sm' | 'md' } = $props();
</script>

<span class="status-dot size-{size} status-{status}" role="presentation" aria-hidden="true"></span>

<style>
  .status-dot { display: inline-block; border-radius: 50%; }
  .size-sm { width: 6px; height: 6px; }
  .size-md { width: 8px; height: 8px; }
  .status-ok { background: var(--ok); }
  .status-warn { background: var(--warn); }
  .status-error { background: var(--error); }
  .status-muted { background: var(--text-muted); }
</style>
```

### Step 2: Create `MetricCard.svelte`

```svelte
<!-- src/lib/components/shared/MetricCard.svelte -->
<script lang="ts">
  let { value, label, sub = '', status = 'muted' }: {
    value: string | number;
    label: string;
    sub?: string;
    status?: 'ok' | 'warn' | 'error' | 'muted';
  } = $props();
</script>

<div class="metric-card status-{status}" aria-label="{label}: {value}">
  <div class="metric-value">{value}</div>
  <div class="metric-label">{label}</div>
  {#if sub}
    <div class="metric-sub">{sub}</div>
  {/if}
</div>
```

### Step 3: Create `src/lib/core/format.ts`

```ts
export function displayValue(value: unknown, fallback = 'N/A'): string {
  if (value == null || value === '' || value === undefined) return fallback;
  return String(value);
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
```

### Step 4: Integrate into existing components

Replace inline dot patterns in:
- `tabs/Agents.svelte` — status column → `<StatusDot status={...} />`
- `tabs/Crons.svelte` — result column → `<StatusDot status={...} />`
- `tabs/Overview.svelte` — agent cards → `<StatusDot status={...} />`

Replace inline metric cards in:
- `tabs/Overview.svelte` — system stats metrics
- `tabs/H1.svelte` — bounty stats metrics

Replace duplicate utility functions:
- Remove `na()` from H1.svelte and Overview.svelte → import `displayValue`
- Replace `formatLastRun()` in Crons.svelte → `formatRelativeTime`
- Consolidate DecisionTrace time formatters → `formatRelativeTime`/`formatLatency`

## Files

| File | Action |
|------|--------|
| `src/lib/components/shared/StatusDot.svelte` | CREATE |
| `src/lib/components/shared/MetricCard.svelte` | CREATE |
| `src/lib/core/format.ts` | CREATE |
| `src/lib/components/tabs/Agents.svelte` | MODIFY — use StatusDot |
| `src/lib/components/tabs/Crons.svelte` | MODIFY — use StatusDot + formatRelativeTime |
| `src/lib/components/tabs/Overview.svelte` | MODIFY — use StatusDot + MetricCard + displayValue |
| `src/lib/components/tabs/H1.svelte` | MODIFY — use MetricCard + displayValue |
| `src/lib/components/tabs/DecisionTrace.svelte` | MODIFY — use formatRelativeTime/formatLatency |

## Verification

- `pnpm check` passes
- `pnpm test` passes (350/351 existing + new tests for format.ts)
- Visual: status dots and metric cards render identically to inline versions
- No regressions in Agents, Crons, Overview, H1, DecisionTrace tabs

## Scope

✅ All files in `src/lib/components/shared/`, `src/lib/components/tabs/`, `src/lib/core/format.ts`
❌ No routes, stores, server, config, provider interfaces touched
