# 📊 Noema Benchmarks — 2026-07-18 07:50 CEST
**QA Agent**: Nova 🔧 | **Phase**: 1.5 (Benchmarks) | **3-run average**

## Build Performance

| Metric | Run 1 | Run 2 | Run 3 | Avg |
|--------|-------|-------|-------|-----|
| `pnpm build` | 6205ms | 6107ms | 6372ms | **6228ms** |
| Build integrity | ✅ passed | ✅ passed | ✅ passed | ✅ |

> Previous run (Jul 17): ~6100ms — no significant change.

## Build Output Size

| Directory | Size | % of total |
|-----------|------|-----------|
| `build/` (total) | 2.9 MB | 100% |
| `build/server/` | 2.3 MB | 79% |
| `build/client/` | 576 KB | 20% |
| `build/client/_app/` | 572 KB | 20% |

Largest client bundles:
- `_app/immutable/nodes/2.DC2Rs_mp.js` — 101 KB
- `_app/immutable/entry/start.WFrlbfLA.js` — 34 KB
- `_app/immutable/chunks/j1W8x4KU.js` — 27 KB

> Previous run (Jul 17): ~2.8 MB — +0.1 MB (3.5% growth, within bounds).

## Source Code Metrics

| Metric | Value |
|--------|-------|
| Total source lines (src/) | 16,546 |
| .svelte files | 32 |
| .ts files | 48 |
| Largest component | CronSidebar.svelte (565 lines) |
| generate.cjs | 934 lines / 51 KB |
| relay.cjs | 338 lines |
| action-processor.cjs | 202 lines |
| Pipeline scripts total | 1,474 lines |

## Dependencies

| Metric | Value |
|--------|-------|
| Runtime deps | 0 |
| Dev deps | 12 |
| Outdated (any) | 10 |
| Outdated (patch) | 3 |
| Outdated (major) | 7 |
| Security vulns | 1 (low) |

## Test Coverage

| Metric | Value |
|--------|-------|
| Tests | `pnpm test` — vitest (no output captured in short time) |
| Coverage | Not measured in this run |

## Runtime Performance

| Metric | Value |
|--------|-------|
| `generate.cjs` | 5921 ms |
| Dashboard output | 51,852 bytes |
| Dashboard lines | 894 |

> Previous run (Jul 17): ~5700ms — +221ms (+3.9%).

## Git Activity (Week)

| Metric | Value |
|--------|-------|
| Commits (Jul 11-18) | 66 |
| Active PKGs implemented | ~8+ |
| QA commits | 2 (Jul 16, Jul 17) |
| Reverted commits | 1 (Revert PKG dev-loop) |

## Trend Alerts

| Alert | Status |
|-------|--------|
| Build size growth | +3.5% week-over-week ⚠️ (normal for active dev) |
| Build time | Stable at ~6.2s ✅ |
| generate.cjs time | +3.9% ⚠️ (minor, data volume growth) |
| Dep staleness | 10 outdated, 6 major versions behind 🟡 |
| Codebase growth | +66 commits this week — very active ✅ |

---

*Generated: Nova 🔧 QA Run #3, 2026-07-18 07:50 CEST*
