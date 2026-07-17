# PKG-067: Fix localStorage Key Collision — LogPanel ⇄ LogsViewer

**Priority**: 🔴 Critical | **Size**: XS (15 min) | **Status**: 🤖 auto-ready
**Created**: 2026-07-17 Nova QA Nightly | **Scope**: ✅ auto-implementable

## Problem

`LogPanel.svelte` (shared) and `LogsViewer.svelte` (tabs) both use the identical localStorage key `"log-reversed"` for their reverse-order toggle. They write to the **same localStorage key**, so toggling the log panel inside a DevPackageRow silently flips the LogsViewer tab's sort order and vice versa.

**User impact**: Dashboard users experience seemingly random log order changes when interacting with package row log panels.

## Root Cause

```ts
// Both files:
const STORAGE_KEY = "log-reversed";
```

Two independent components share a storage namespace due to a copy-paste of the same constant.

## Fix

Differentiate the localStorage keys:

**LogPanel.svelte** (used inside DevPackageRow):
```ts
const STORAGE_KEY = "pkg-log-reversed";
```

**LogsViewer.svelte** (standalone tab):
```ts
const STORAGE_KEY = "logs-viewer-reversed";
```

## Files Changed
| File | Change |
|------|--------|
| `src/lib/components/shared/LogPanel.svelte` | `"log-reversed"` → `"pkg-log-reversed"` |
| `src/lib/components/tabs/LogsViewer.svelte` | `"log-reversed"` → `"logs-viewer-reversed"` |

## Side Effects
- Users' existing log order preference will reset to default (newest-first) on first load after this change. Acceptable — current behavior is buggy anyway.

## Verification
- `pnpm check` passes
- Open dashboard, toggle LogPanel sort in a DevPackageRow, verify LogsViewer tab sort is unaffected
- Toggle LogsViewer tab sort independently, verify it persists correctly across page reloads
