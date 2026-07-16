# PKG-065: Partial Data Resilience — Promise.allSettled()

**Created**: 2026-07-16 | **Source**: QA Nightly v2.2 Gap Scan  
**Priority**: 🔴 Critical | **Size**: S | **Estimate**: 30m

## Problem

`getAllData()` in `src/lib/core/index.ts` uses `Promise.all()` to fetch 16+ data sources. If ANY one fails (e.g., H1 API down, filesystem hung), the entire dashboard fails — users see a blank page for 60 seconds. This is the single most impactful reliability issue in Noema.

## Solution

Replace `Promise.all()` with `Promise.allSettled()` in `getAllData()`. Return partial data with per-source error flags. SvelteKit's streaming promises can progressively render what's available.

### Changes

1. **`src/lib/core/index.ts`**: Replace `Promise.all()` with `Promise.allSettled()`. Each data source gets its own try/catch. On failure, return default/empty data + `error: string` flag.
2. **`src/lib/types.ts`**: Add optional `error?: string` to each data type interface.
3. **Components**: Each tab already checks `data?.error` in some cases — ensure all tabs handle partial data gracefully (show error banner, not blank).

### Scope Check (per noema-dev-gate.md §Kivétel 2)
- ✅ `src/lib/core/index.ts` — core data layer
- ✅ `src/lib/types.ts` — type augmentation (additive)
- ✅ `src/lib/components/tabs/*.svelte` — UI error handling (additive)
- ❌ `src/lib/server/` — no changes (collector calls getAllData, bénéficiés from fix)

### Success Criteria
- [ ] `getAllData()` returns partial data when 1 source fails
- [ ] Dashboard renders with error banner for failed sources instead of blank
- [ ] `pnpm check` passes (0 errors, 0 warnings)
- [ ] `pnpm test` passes
