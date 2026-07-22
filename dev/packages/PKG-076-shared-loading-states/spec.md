# PKG-076: Shared Loading States Component

**Priority**: 🔴 High | **Complexity**: S (45m) | **Scope**: ✅ `src/lib/components/ui/LoadingSkeleton.svelte` (non-core)
**Source**: QA 2026-07-22 Phase 1 (gap-components scan)
**Created**: 2026-07-22

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
Card-shaped shimmer for tab content areas. Renders placeholder cards with pulsing animation.
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
- TypeScript props interface with full JSDoc

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

## Files Changed

| File | Action | Scope |
|------|--------|-------|
| `src/lib/components/ui/LoadingSkeleton.svelte` | CREATE | ✅ |
| `dev/packages/PKG-076-shared-loading-states/spec.md` | CREATE | ✅ |
| `dev/packages/INDEX.md` | UPDATE (PKG-076 status → ✅ F5) | ✅ |

## Dependencies
- None (zero imports, pure CSS component)

## Not in Scope (future PKGs)
- Replacing `{#if loading}` blocks in all 23 components — per-component integration work
- Empty state components (separate concern)
- Error state components (separate concern)

## Acceptance Criteria

- [x] `<LoadingSkeleton>` component created in `src/lib/components/ui/`
- [x] 3 skeleton variants: card, table, metrics
- [x] `prefers-reduced-motion` respected (animation disabled)
- [x] `aria-busy="true"` and `aria-label` present
- [x] TypeScript props with full JSDoc
- [ ] pnpm check passes (zero new errors)
- [x] Visual: shimmer animation from `rgba(255,255,255,0.03)` to `rgba(255,255,255,0.06)` on `#161b22` card bg

## Verification

```bash
cd projects/noema && pnpm check
```
