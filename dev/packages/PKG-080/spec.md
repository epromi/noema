# PKG-080: Fix Overview.svelte H1 Data Field Crash

**Status:** 📋 F0 (Specification Complete)
**Priority:** CRITICAL
**Becsült idő:** 15 perc
**Forrás:** QA Nightly 2026-08-10 — Phase 1 gap scan (UI Components C2)
**Tags:** bugfix, h1, crash, data-field

## Problem

`Overview.svelte` references `h1.signal.signal` and `h1.signal.reputation` at lines 60-63, but the `H1Data` type (used in `H1.svelte` tab) exposes these as `h1.stats.signal` and `h1.stats.reputation`. The `h1.signal` sub-object does not exist in the H1Data schema, causing a runtime crash when `na(h1.signal.signal)` is evaluated on undefined.

This is confirmed by looking at the H1 tab (H1.svelte) which correctly uses `h1.stats.signal` and `h1.stats.reputation`.

## Solution

Replace all `h1.signal.*` with `h1.stats.*` in `Overview.svelte`:

**Before (broken):**
```svelte
{h1.error ? "N/A" : na(h1.signal.signal)}
Rep: {h1.error ? "N/A" : na(h1.signal.reputation)}
```

**After (fixed):**
```svelte
{h1.error ? "N/A" : na(h1.stats.signal)}
Rep: {h1.error ? "N/A" : na(h1.stats.reputation)}
```

Also update the aria-label previously added to match:
```svelte
aria-label="H1 Signal: {h1.error ? 'No data' : `${na(h1.signal.signal)} signal, ${na(h1.signal.reputation)} reputation`}"
```
Change to:
```svelte
aria-label="H1 Signal: {h1.error ? 'No data' : `${na(h1.stats.signal)} signal, ${na(h1.stats.reputation)} reputation`}"
```

## Scope Check

✅ `src/lib/components/tabs/Overview.svelte` — single file, component scope
✅ Bug fix — preventing a runtime crash
✅ No config, stores, routes, or server files touched

## Files

| File | Action |
|------|--------|
| `src/lib/components/tabs/Overview.svelte` | Replace `h1.signal.*` → `h1.stats.*` (4 references) |

## Verification

- `pnpm check` — must pass
- Cross-reference: `H1.svelte` tab uses `h1.stats.signal` and `h1.stats.reputation` — this fix aligns Overview with the H1 tab
- Verify H1Data type in `src/lib/types.ts` to confirm `stats` is the correct sub-object
