# PKG-076: Shared Loading States Component

> **Source**: QA 2026-07-22 Phase 1 (gap-components scan)  
> **Created**: 2026-07-22 | **Priority**: 🔴 High | **Size**: S  
> **Scope**: ✅ `src/lib/components/ui/LoadingSkeleton.svelte` (new file — non-core)

## Problem

23 of 30 Noema components lack loading states. Every tab renders empty/zero-state content before async data arrives, causing:
- "No agents loaded" flash before agents populate
- "No bills in tasks.md" flash before bills load
- "No timeline data" flash before cron timeline renders
- Zero-values in metric cards (H1, Viktor, Overview)
- Stale-looking UI during initial page load and tab switches

## Solution

Create a single shared `<LoadingSkeleton>` component in `src/lib/components/ui/` with 3 variants:

### Variant 1: `skeleton="card"`
Card-shaped shimmer for tab content areas. Renders 3 placeholder cards with pulsing animation.
```svelte
<LoadingSkeleton skeleton="card" count={3} />
```

### Variant 2: `skeleton="table"`
Table-row shimmer for list/tabular data (Agents, Crons, Logs, AuditTrail, etc.)
```svelte
<LoadingSkeleton skeleton="table" rows={5} cols={4} />
```

### Variant 3: `skeleton="metrics"`
Metric bar shimmer for stats dashboards (Overview, H1, Viktor)
```svelte
<LoadingSkeleton skeleton="metrics" count={4} />
```

### Features
- CSS-only shimmer animation (no JS — zero runtime cost)
- `prefers-reduced-motion` media query disables animation
- `aria-busy="true"` + `aria-label="Loading {label}"` for screen reader announcement
- Auto-column count from parent container width (CSS grid)
- Dark theme only (matches Noema's #0d1117 background)
- TypeScript props interface

### Usage Pattern
```svelte
{#if loading}
  <LoadingSkeleton skeleton="table" rows={5} cols={4} label="Agents" />
{:else if agents.length === 0}
  <p class="empty">No agents loaded.</p>
{:else}
  <!-- actual content -->
{/if}
```

### Acceptance Criteria
- [ ] `<LoadingSkeleton>` component created in `src/lib/components/ui/`
- [ ] 3 skeleton variants: card, table, metrics
- [ ] `prefers-reduced-motion` respected (animation disabled)
- [ ] `aria-busy="true"` and `aria-label` present
- [ ] TypeScript props with full JSDoc
- [ ] pnpm check passes (zero new errors)
- [ ] Visual: shimmer animation from `rgba(255,255,255,0.03)` to `rgba(255,255,255,0.06)` on `#161b22` card bg

### Not in Scope (future PKGs)
- Replacing `{#if loading}` blocks in all 23 components — that's per-component integration work
- Empty state components (separate concern)
- Error state components (separate concern)

## Dependencies
- None (zero imports, pure CSS component)

## Files
| File | Action | Scope |
|------|--------|-------|
| `src/lib/components/ui/LoadingSkeleton.svelte` | CREATE | ✅ |
| `dev/packages/PKG-076-shared-loading-states/spec.md` | CREATE (this file) | ✅ |
| `dev/packages/INDEX.md` | UPDATE (add PKG-076 row) | ✅ |
