# PKG-064: Cron Health Scorecard 📊

**Created**: 2026-07-16 | **Source**: QA Nightly — bench-features (Grafana/Datadog standard) | **Severity**: 🟡 Medium
**Scope**: ✅ non-core (`src/lib/components/layout/CronSidebar.svelte`) | **Estimated**: 1h

## Problem

The CronSidebar shows raw cron entries grouped by hour but provides no at-a-glance health summary. With 49+ cron jobs, operators can't quickly answer:
- "How many crons succeeded today?"
- "Are there any failing crons right now?"
- "What's the failure rate trend?"

Grafana and Datadog dashboards standardize on health scorecards that show OK/WARN/FAIL counts.

## Solution

Enhance `CronSidebar.svelte` with a health scorecard header:

1. **Health summary bar** at the top of the sidebar:
   - ✅ Succeeded today: N
   - ⚠️ Warnings: N
   - ❌ Failures: N
   - 📊 Success rate: XX%

2. **Color-coded status dots** next to cron names in the list (OK=green, error=red, skipped=gray)

All data computed from the existing `crons` prop — no new collectors needed.

## Scope

✅ `src/lib/components/layout/CronSidebar.svelte` — health summary + color dots

❌ NO changes to stores, routes, or server endpoints
❌ NO new data collectors

## Acceptance Criteria

- CronSidebar shows OK/WARN/FAIL counts at top
- CronSidebar shows success rate percentage
- Each cron entry has color-coded status indicator
- `pnpm check` passes with 0 errors
