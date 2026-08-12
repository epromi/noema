# PKG-082: Loading Skeleton States for Key Tabs

**Status:** 🤖 auto-ready | **Source:** Nova QA 2026-08-12 gap scan
**Priority:** Low | **Est. effort:** 30 min

## Problem

Most Noema tab components render empty text or "No data" messages during initial data fetch, then abruptly replace it with content. This causes:
- Flickering "No crons loaded" → table pop-in (layout shift, confusing UX)
- Screen readers announce "No data" then immediately re-announce content
- No visual indication that data is loading (users may think it's broken)

The `LoadingSkeleton` component already exists but is unused in most tabs.

## Solution

Add `{#if loading}` guards before empty/error/content states in the most frequently used tabs. Use the existing `LoadingSkeleton` component.

## Files

| File | Change |
|------|--------|
| `src/lib/components/tabs/Noema.svelte` | Add `loading` guard + `LoadingSkeleton skeleton="card" count={6}` |
| `src/lib/components/tabs/Crons.svelte` | Add `loading` guard + `LoadingSkeleton skeleton="table" rows={10}` |
| `src/lib/components/tabs/H1.svelte` | Add `loading` guard + `LoadingSkeleton skeleton="metrics" count={4}` |
| `src/lib/components/tabs/AuditTrail.svelte` | Add `loading` guard + `LoadingSkeleton skeleton="filtered-list"` |
| `src/lib/components/tabs/Viktor.svelte` | Add `loading` guard + `LoadingSkeleton skeleton="metrics" count={4}` |
| `src/lib/components/tabs/SessionHealth.svelte` | Add `loading` guard + `LoadingSkeleton skeleton="card" count={4}` |

## Pattern

```svelte
{#if loading}
  <LoadingSkeleton skeleton="table" rows={10} />
{:else if data.error}
  <p class="empty">No data — {data.error}</p>
{:else if items.length === 0}
  <p class="empty">No items found.</p>
{:else}
  <!-- normal content -->
{/if}
```

The `loading` state is derived from: data object is `undefined`/`null` AND no error is set.

## Scope Gate

| Check | Result |
|-------|--------|
| Touches `src/routes/`? | ❌ No |
| Touches `src/lib/stores/`? | ❌ No |
| Touches `src/lib/server/`? | ❌ No |
| Touches config files? | ❌ No |
| Touches provider interface? | ❌ No |
| All files in ✅ scope? | ✅ Yes — `src/lib/components/tabs/` only |

## Traceability

- Source: Nova QA 2026-08-12, gap-components.md §2 (18 missing loading states)
- Dedup: LoadingSkeleton already exists; this PKG makes tabs actually use it
