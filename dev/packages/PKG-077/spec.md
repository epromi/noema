# PKG-077: Alert Threshold Configuration

> **Source**: QA 2026-07-22 Phase 1.5 (bench-features: Grafana v13 Alert Rules)  
> **Created**: 2026-07-22 | **Priority**: 🟡 Medium | **Size**: S  
> **Scope**: ✅ `src/lib/components/ui/AlertThreshold.svelte` (new file — non-core)

## Problem

Noema renders raw metrics (system health, agent scores, cron timing, H1 stats) with zero threshold awareness. A metric at 20% looks the same as a metric at 80%. There's no visual signal for:
- CPU usage exceeding 80%
- Agent session stuck for >3h
- Cron job missing 2+ consecutive runs
- H1 signal drop below threshold
- Build integrity score falling below 85%

Grafana v13 (Apr 2026) introduced Alert Rule suggestions with compatibility scoring. Datadog has had threshold-based alerting for years. Noema's operational dashboard has no equivalent.

## Solution

Create `<AlertThreshold>` wrapper component that:
1. Accepts a `value`, `thresholds`, and `direction` prop
2. Renders children with severity-based classes
3. Adds `role="alert"` when threshold is breached

### Props Interface
```ts
interface AlertThresholdProps {
  value: number;                    // current metric value
  thresholds: {                     // threshold definitions
    warning: number;                // e.g., 70 (70% triggers warning)
    critical: number;               // e.g., 90 (90% triggers critical)
  };
  direction: 'above' | 'below';     // breach direction
  label?: string;                   // for aria-label: "CPU at 85% (warning)"
}
```

### Visual Indicators
- **Normal** (below warning): No change, default styling
- **Warning** (between warning and critical): Amber border-left + subtle pulse animation on first breach
- **Critical** (beyond critical): Red border-left + `role="alert"` for screen reader announcement
- `prefers-reduced-motion`: Pulse animation disabled

### Usage
```svelte
<AlertThreshold
  value={cpu.usage}
  thresholds={{ warning: 70, critical: 90 }}
  direction="above"
  label="CPU usage"
>
  <div class="metric-card">CPU: {cpu.usage}%</div>
</AlertThreshold>
```

### Acceptance Criteria
- [ ] `<AlertThreshold>` component created in `src/lib/components/ui/`
- [ ] Three severity states: normal, warning, critical
- [ ] `role="alert"` on critical state (screen reader announcement)
- [ ] `aria-label` with computed severity
- [ ] `prefers-reduced-motion` respected
- [ ] TypeScript props with full JSDoc
- [ ] pnpm check passes
- [ ] Thresholds configurable via prop (not hardcoded)

### Not in Scope
- Backend alerting engine (Telegram/webhook notifications)
- Threshold persistence/storage
- Threshold configuration UI
- Integration with all metric cards (separate integration PKGs)

## Dependencies
- None

## Files
| File | Action | Scope |
|------|--------|-------|
| `src/lib/components/ui/AlertThreshold.svelte` | CREATE | ✅ |
| `dev/packages/PKG-077-alert-thresholds/spec.md` | CREATE (this file) | ✅ |
| `dev/packages/INDEX.md` | UPDATE (add PKG-077 row) | ✅ |
