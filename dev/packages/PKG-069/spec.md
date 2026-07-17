# PKG-069: Shared Utility Extraction — Deduplicate Component Helpers

**Priority**: 🟡 Medium | **Size**: S (30m) | **Status**: 🤖 auto-ready
**Created**: 2026-07-17 Nova QA Nightly | **Scope**: ✅ auto-implementable

## Problem

6 duplicate utility functions spread across multiple tab components, creating maintenance burden and inconsistency:

| # | Function | Duplicated In | Gap Ref |
|---|----------|--------------|---------|
| 1 | `na()` — N/A fallback | `tabs/H1.svelte`, `tabs/Overview.svelte` | M2 |
| 2 | `statusDotClass()` — green/yellow/red dot mapping | `tabs/Agents.svelte`, `tabs/Overview.svelte` | M3 |
| 3 | `proposalColor()` / `proposalPriorityColor()` — same logic | `tabs/Research.svelte`, `tabs/ResearchProposals.svelte` | M4 |
| 4 | `ottoIcon()` — ok/warn/err → emoji | `tabs/Research.svelte`, `tabs/OttoTimeline.svelte` | M5 |
| 5 | `cronIcon()` / agent icon lookup | `tabs/CronTimeline.svelte`, `layout/CronSidebar.svelte` | M7 |
| 6 | `parseLastRunDays()` / `isStale()` — "Xd ago" parsing | `tabs/Agents.svelte`, `tabs/Overview.svelte` | M6 |

## Solution

Create `src/lib/utils/display.ts` with all shared display utilities. Each component imports from a single source.

### New File: `src/lib/utils/display.ts`

```typescript
// Display utilities — shared across Noema tab components

/** Returns "N/A" for null/undefined/empty values */
export function na(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "N/A";
  return String(value);
}

/** Maps status string to CSS dot class */
export function statusDotClass(status: string): string {
  switch (status) {
    case "ok":
    case "green":
      return "dot-ok";
    case "warn":
    case "warning":
    case "yellow":
      return "dot-warn";
    case "error":
    case "err":
    case "red":
      return "dot-error";
    default:
      return "dot-ok";
  }
}

/** Returns color CSS variable for proposal priority string */
export function proposalPriorityColor(priority: string): string {
  if (priority.includes("🔴")) return "var(--error)";
  if (priority.includes("🟡")) return "var(--warn)";
  return "var(--ok)";
}

/** Maps Otto status to emoji icon */
export function ottoStatusIcon(status: string): string {
  switch (status) {
    case "ok":
      return "✅";
    case "warn":
      return "⚠️";
    case "err":
    case "error":
      return "❌";
    default:
      return "❓";
  }
}

/** Parse "Xd ago" string to days number */
export function parseLastRunDays(lastRun: string): number {
  const match = lastRun.match(/(\d+)d ago/);
  return match ? parseInt(match[1], 10) : Infinity;
}

/** Returns true if agent hasn't run in threshold days */
export function isStale(lastRun: string, thresholdDays: number = 7): boolean {
  return parseLastRunDays(lastRun) > thresholdDays;
}
```

### Modified Files (import changes only)

| File | Change |
|------|--------|
| `tabs/H1.svelte` | Remove inline `na()`, `import { na } from "$lib/utils/display"` |
| `tabs/Overview.svelte` | Remove inline `na()`, `statusDotClass()`, `isStale()` inline → import |
| `tabs/Agents.svelte` | Remove inline `statusDotClass()`, `parseDays()` → import `parseLastRunDays` |
| `tabs/Research.svelte` | Remove inline `proposalColor()`, `ottoIcon()` → import |
| `tabs/ResearchProposals.svelte` | Remove inline `proposalPriorityColor()` → import |
| `tabs/OttoTimeline.svelte` | Remove inline `ottoIcon()` → import |
| `tabs/CronTimeline.svelte` | Replace inline `cronIcon()` — keep AGENT_ICONS lookup, extract fallback to shared |
| `layout/CronSidebar.svelte` | Replace inline cron icon lookup — extract shared `agentIcon()` |

### Agent icon utility (optional)

```typescript
// In $lib/utils/display.ts (or separate $lib/utils/agents.ts)
import { AGENT_ICONS } from "$lib/constants";

export function agentIcon(agentId: string): string {
  return AGENT_ICONS[agentId] ?? "🤖";
}
```

> Note: Only add `agentIcon()` if `AGENT_ICONS` is importable from a constants module. If it's defined inline in the components, skip this and only extract the 5 stats/display utilities above.

## Verification

- `pnpm check` — 0 errors, 0 warnings
- All 6 modified components still render correctly (import paths resolve)
- No behavior change — pure refactor, same output

## Scope Gate

| Path | Scope | Note |
|------|-------|------|
| `src/lib/utils/display.ts` | ✅ NEW | New file, additive |
| `src/lib/components/tabs/*.svelte` | ✅ | Import changes only, no logic change |
| `src/lib/components/layout/*.svelte` | ✅ | Import changes only |

No ❌ scope files touched.
