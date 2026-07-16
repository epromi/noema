# PKG-008 Suggestions / Notes

## Scope decision: tab wiring skipped

The spec's `## 📐 Scope` section was a placeholder (`_Placeholder — to be filled._`)
listing no files. Per the task's scope-gate rule ("wiring into `+page.svelte` or tab
components is allowed ONLY if the spec explicitly lists those files in its Scope"),
this package implements only:

- F1 — `src/lib/core/cron-timeline.ts` (`buildCronTimeline()`)
- F2 — `src/lib/components/shared/CronTimeline.svelte` (isolated, prop-driven)

It does **not** wire `CronTimeline.svelte` into `+page.svelte`, the Crons tab, or the
Orchestrator tab, since no Scope files were listed for F3 ("tab regisztrálás").

💡 SUGGESTION: Fill in `spec.md`'s Scope/Fázisok/Acceptance Criteria sections with
concrete file paths (e.g. `src/routes/+page.svelte`, `src/lib/components/tabs/Crons.svelte`)
so a follow-up F3 package can wire the widget in without re-deriving scope from the title line.

💡 SUGGESTION: `getCronRuns()` in `src/lib/providers/openclaw.ts` currently reconstructs
only a single synthetic run (the last one) from cron list state — there's no real
multi-run history API. `buildCronTimeline()` was therefore designed as a pure
transform of `CronEntry[]` (one block = last known run), not a true multi-run Gantt.
If/when a real run-history endpoint exists, `buildCronTimeline()` should be extended
to accept `CronRun[]` per cron for multiple blocks per row.

## Pre-existing unrelated `pnpm check` failure (NOT caused by this package)

`pnpm check` reports one pre-existing TypeScript error, unrelated to any file touched
by this package:

```
src/lib/core/dev-packages.ts:22:30
Error: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
```

This file was already modified (uncommitted, dirty) in the working tree before this
package's work began — it appears to be leftover work from a different package
(PKG-049 sort-by-id changes). Per the gardening rule ("NOT allowed: touch files
outside scope"), it was left untouched. All files created/modified for PKG-008
(`cron-timeline.ts`, `CronTimeline.svelte`, `types/index.ts`, `cron-timeline.test.ts`)
produce zero `pnpm check` errors/warnings on their own.
