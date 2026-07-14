# PKG-049a: ProcessorTimer.svelte Component

> Státusz: 🤖 QA Auto-Ready | Méret: XS | Függőség: PKG-023 (Orchestrator)
> Part of: PKG-048 (Orchestrator split) — Feature 1 of 6
> Scope: ✅ (new UI component in `tabs/` — non-core)

## Problem

`Orchestrator.svelte` has a processor state section (~lines 659-662 of template + related logic) that shows live processor job state. Extract it into a standalone component.

## Spec

### Create: `src/lib/components/tabs/ProcessorTimer.svelte`

**Props:**
```ts
let {
  processorState,
  devJobLabel,
  devJobSubLabel = "",
}: {
  processorState: ProcessorState;
  devJobLabel: string;
  devJobSubLabel?: string;
} = $props();
```

**Template**: Move the processor-timer-bar div from Orchestrator template (currently around line 659-662):
- State badge with color classes (pt-idle, pt-queue, pt-running, pt-offline)
- Label text (devJobLabel)
- Optional sub-label (devJobSubLabel)

**Styles**: Move only the processor-specific CSS to scoped `<style>`:
- `.processor-timer-bar` and state variants
- `.pt-main`, `.pt-sub`
- Responsive rules for max-width 768px

### Modify: `Orchestrator.svelte`

1. Import ProcessorTimer
2. Replace inline processor section with `<ProcessorTimer {processorState} {devJobLabel} {devJobSubLabel}/>`
3. Remove moved CSS

## Verify

- `pnpm check` — 0 errors, 0 warnings
- Processor timer still renders with correct colors and labels
- No imports broken

## Reference

- `ProcessorState` type is already in `$lib/types/index.ts`
- CSS variables (`--border`, `--card`, `--green`, `--accent`, `--red`, `--muted`) available globally
- Use `import { fade } from "svelte/transition"` for the processor-timer-bar transition
