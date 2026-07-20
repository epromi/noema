# PKG-074: Dashboard Loading States

**Priority**: 🟡 Medium | **Size**: S | **Estimated**: 45m  
**Source**: QA 2026-07-20 Phase 1 — gap-components M22  
**Scope**: ✅ All files in `src/lib/components/`

## Problem

7 dashboard components jump directly from "no data" to "data" without any loading indicator. This causes a flash of empty content on first render and feels broken to users. Components affected:

1. `CronSidebar.svelte` (layout)
2. `tabs/Crons.svelte`
3. `tabs/CronTimeline.svelte`
4. `tabs/KanbanBoard.svelte`
5. `tabs/OttoTimeline.svelte`
6. `tabs/Overview.svelte`
7. `tabs/Viktor.svelte`

Some components have data available immediately (SSR) while others load lazily. The transition should be seamless.

## Solution

Add a lightweight loading state pattern to each component:

```svelte
{#if loading}
  <div class="loading-placeholder" role="status" aria-label="Loading...">
    <span class="spinner" aria-hidden="true">⏳</span>
    Loading...
  </div>
{:else if error}
  <div class="error-placeholder" role="alert">{error}</div>
{:else if items.length === 0}
  <div class="empty-placeholder">No data available</div>
{:else}
  <!-- existing content -->
{/if}
```

## Requirements

- Add `loading` prop to each component (default: `false`)
- Show a subtle loading indicator (grey text + spinner emoji with `aria-hidden`)
- Use `role="status"` for accessibility
- Fade in content when loading completes (CSS transition)
- Maintain existing behavior when `loading` prop is not passed
- Use `prefers-reduced-motion` respect (already in global CSS)

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/components/layout/CronSidebar.svelte` | Add loading state wrapper |
| `src/lib/components/tabs/Crons.svelte` | Add loading state wrapper |
| `src/lib/components/tabs/CronTimeline.svelte` | Add loading state wrapper |
| `src/lib/components/tabs/KanbanBoard.svelte` | Add loading state wrapper |
| `src/lib/components/tabs/OttoTimeline.svelte` | Add loading state wrapper |
| `src/lib/components/tabs/Overview.svelte` | Add loading state wrapper |
| `src/lib/components/tabs/Viktor.svelte` | Add loading state wrapper |

All files are in ✅ scope (UI components only, no routing/stores/server).

## Non-Goals

- Changing data fetching logic
- Adding `<Suspense>` or SvelteKit loading patterns
- Modifying `src/routes/` or `src/lib/stores/`
- Complex skeleton screens (simple spinner + text is sufficient)

## Verification

- `pnpm check` passes
- `pnpm test` passes
- Existing component behavior unchanged when `loading` prop is absent
