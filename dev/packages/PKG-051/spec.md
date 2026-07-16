# PKG-051: CSS Color Token Standardization 🎨

**Created**: 2026-07-16 | **Source**: QA Nightly | **Severity**: 🟡 Medium
**Scope**: ✅ non-core (CSS only) | **Estimated**: 1h

## Problem

22 Svelte components use **inconsistent CSS variable names** for the same semantic colors:

| Semantic Meaning | Used As | Variable Names (inconsistent) |
|-----------------|---------|-------------------------------|
| Error / Danger / Red | `var(--error)` | `BuildIntegrityBanner`, `DevJobIndicator`, `AuditTrail`, `DecisionTrace` |
| Error / Danger / Red | `var(--red)` | `AgentDetailPanel`, `CpuWidget`, `LogPanel`, `Overview` |
| Success / OK / Green | `var(--ok)` | `BuildIntegrityBanner`, `CronSidebar`, `Noema`, `Orchestrator` |
| Success / OK / Green | `var(--green)` | `AgentDetailPanel`, `CpuWidget`, `LogPanel`, `Overview` |
| Warning / Yellow | `var(--warn)` | `BuildIntegrityBanner`, `CronSidebar`, `Noema`, `Orchestrator` |
| Warning / Yellow | `var(--yellow)` | `AgentDetailPanel`, `CpuWidget`, `LogPanel`, `Overview` |

**Root cause**: Components developed by different agents/iterations adopted different naming conventions. AgentDetailPanel and CpuWidget (older components) use `--red`/`--green`/`--yellow`. BuildIntegrityBanner and newer components use `--error`/`--ok`/`--warn`.

## Fix

### Step 1: Define canonical tokens in `app.css`

```css
/* Semantic color tokens — canonical names */
:root {
  --error: #ff5555;   /* was sometimes --red */
  --ok: #50fa7b;      /* was sometimes --green */
  --warn: #ffb86c;    /* was sometimes --yellow */
}
```

### Step 2: Alias legacy tokens (backward compat, then deprecate)

```css
/* Legacy aliases — deprecated, remove after PKG-051 */
:root {
  --red: var(--error);
  --green: var(--ok);
  --yellow: var(--warn);
}
```

### Step 3: Migrate all component <style> blocks to canonical names

Replace in all `.svelte` files:
- `var(--red)` → `var(--error)`
- `var(--green)` → `var(--ok)`
- `var(--yellow)` → `var(--warn)`

### Step 4: Remove legacy aliases (separate commit, future cleanup)

After verification, remove the alias block from `app.css`.

## File Changes

| File | Change |
|------|--------|
| `src/app.css` | Define `--error`, `--ok`, `--warn` tokens + legacy aliases |
| `src/lib/components/shared/AgentDetailPanel.svelte` | `--red`→`--error`, `--green`→`--ok`, `--yellow`→`--warn` |
| `src/lib/components/shared/CpuWidget.svelte` | `--red`→`--error`, `--green`→`--ok`, `--yellow`→`--warn` |
| `src/lib/components/shared/LogPanel.svelte` | `--red`→`--error`, `--green`→`--ok`, `--yellow`→`--warn` |
| `src/lib/components/tabs/Overview.svelte` | `--red`→`--error`, `--green`→`--ok`, `--yellow`→`--warn` |
| Any other component using `--red`/`--green`/`--yellow` | Same migration |

## Verification

- `pnpm check` passes
- Visual inspection: all colors render identically to before
- Dark mode: tokens should be themed correctly in dark-mode selectors
- Each migrated component loads without CSS warnings

## Rollback

Each component migration is independent. Git revert individual commits if any visual regression found.

## Notes

- This is a pure CSS refactoring — zero logic changes, zero behavior changes
- The alias approach means we can migrate incrementally (no "big bang")
- After all components migrate, remove aliases in a future PKG
