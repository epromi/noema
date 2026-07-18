# PKG-071: Content Region Landmarks

> **Generated**: 2026-07-18 by Nova 🔧 QA Phase 3
> **Source**: Phase 1 gap-a11y finding F15
> **Priority**: 🟢 Low | **Effort**: XS (15m) | **Status**: 🤖 auto-ready

## Problem

Key content regions lack landmark roles, preventing screen reader users from navigating by landmark to quickly jump to sections. WCAG best practice for complex dashboards.

**Affected files** (all in scope ✅):
- `src/lib/components/tabs/DecisionTrace.svelte` — decision tree + detail panel
- `src/lib/components/tabs/CronTimeline.svelte` — cron timeline section
- `src/lib/components/tabs/LogsViewer.svelte` — filter toolbar area
- `src/lib/components/tabs/OttoTimeline.svelte` — timeline section

## Solution

Add `role="region"` with descriptive `aria-label` to major content wrappers:

```svelte
<!-- DecisionTrace -->
<div class="decision-trace" role="region" aria-label="Decision trace">
<div class="detail-panel" role="region" aria-label="Decision details">

<!-- CronTimeline -->
<div class="cron-timeline-v-wrap" role="region" aria-label="Cron timeline">

<!-- LogsViewer -->
<div class="lv-toolbar" role="region" aria-label="Log filters">

<!-- OttoTimeline -->
<div class="otto-timeline" role="region" aria-label="Otto activity timeline">
```

## Implementation

1. Add `role="region" aria-label="...descriptive label..."` to each root/content wrapper div
2. Labels should be concise and meaningful (what a screen reader user would want to hear)
3. Run `pnpm check` after each change

## Scope Gate

| Check | Result |
|-------|--------|
| ❌ routes/ | Not touched |
| ❌ stores/ | Not touched |
| ❌ server/ | Not touched |
| ❌ config | Not touched |
| ❌ BLOCKLIST | Not touched |
| ✅ tabs/ components | Only role + aria-label added |
