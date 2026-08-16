# PKG-084: Color-Only Status → Non-Color Cues

**Status:** 🤖 auto-ready | **Source:** Nova QA 2026-08-16 gap scan
**Priority:** Medium | **Est. effort:** 1.5h

## Problem

Several status indicators convey meaning by color alone (WCAG 1.4.1), which is invisible to color-blind users and screen readers:

- `Agents.svelte:46-50` — `.staleBorderClass()` applies border-color only for stale/fresh/warn
- `CronTimeline.svelte` (tab, ~370-380) — cron row status is border-left color only
- `SessionHealth.svelte:256-268` — breakdown scores are colored numbers only (`.ok`/`.warn`/`.error`)
- `Bills.svelte:129-142` — `.due-today`/`.due-overdue` row tint; "today" is only expressed as color

## Solution

Add a non-color cue to each:

1. **Agents** — text/icon badge next to stale rows (e.g. `stale`, `warn`, `fresh`)
2. **CronTimeline** — a status word or `sr-only` text on cron rows (the `title` is mouse-only)
3. **SessionHealth** — append `(ok/warn/low)` text to breakdown numbers
4. **Bills** — add a `· today` suffix in the due cell

## Files

| File | Action | Scope |
|------|--------|-------|
| `src/lib/components/tabs/Agents.svelte` | MODIFY | ✅ |
| `src/lib/components/tabs/CronTimeline.svelte` | MODIFY | ✅ |
| `src/lib/components/tabs/SessionHealth.svelte` | MODIFY | ✅ |
| `src/lib/components/tabs/Bills.svelte` | MODIFY | ✅ |

## Scope Gate

| Check | Result |
|-------|--------|
| Touches `src/routes/`? | ❌ No |
| Touches `src/lib/stores/`? | ❌ No |
| Touches `src/lib/server/`? | ❌ No |
| All files in ✅ scope? | ✅ Yes — `src/lib/components/tabs/` only |

**Verdict:** ✅ technically eligible, but deferred (spec-only) — visual change requires screenshot verification against the running app (Rule: verify visual changes before commit).

## Traceability

- Source: Nova QA 2026-08-16, gap-a11y.md §2.2
- Dedup: No existing PKG for color-only status cues (PKG-051 = CSS color token standardization, distinct).
