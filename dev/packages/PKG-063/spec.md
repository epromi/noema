# PKG-063: Collector Timeout Safety ⏱️

**Created**: 2026-07-16 | **Source**: QA Nightly gap-collectors #1 | **Severity**: 🔴 Critical
**Scope**: ✅ non-core (`src/lib/core/` — no provider interface changes) | **Estimated**: 30m

## Problem

None of the data collectors have timeout protection. If an external API hangs (H1 API, health exec commands, agent status fetches), the entire dashboard SSR can freeze until the SvelteKit request timeout. This is the #1 reliability gap.

**Affected collectors** (gap-collectors.md finding #1):
- `getH1Data()` — no timeout on balance, programs, reports API calls
- `getHealth()` — exec commands (`uptime -p`, `df -h`, `free -h`) have no timeout
- `getAgents()` — agent status queries have no timeout
- All `fetch()` calls across collectors lack `AbortSignal.timeout()`

## Solution

Add `AbortSignal.timeout()` to every external call in `src/lib/core/` collectors:
1. Create a shared constant: `COLLECTOR_TIMEOUT_MS = 15_000` (15 seconds)
2. Add `signal: AbortSignal.timeout(COLLECTOR_TIMEOUT_MS)` to all `fetch()` calls
3. Wrap `exec()` calls with `Promise.race([exec(...), timeout])` pattern
4. Catch `AbortError` and return graceful fallback data (empty/error state)

## Scope

✅ `src/lib/core/h1.ts` — add timeout to all fetch calls
✅ `src/lib/core/health.ts` — add timeout to exec calls
✅ `src/lib/core/agents.ts` — add timeout to status queries
✅ `src/lib/core/build-integrity.ts` — ensure SSR timeout propagation

❌ NO changes to provider interface types (`src/lib/core/index.ts` types)
❌ NO changes to stores, routes, or server endpoints

## Acceptance Criteria

- All collectors timeout within 15s instead of hanging indefinitely
- Timeout produces graceful fallback (empty data + error message) not crash
- `pnpm check` passes with 0 errors
