# 🔍 Noema Components Gap Scan — 2026-07-18 07:50 CEST
**QA Agent**: Nova 🔧 | **Phase**: 1 (Components) | **Scope**: 32 svelte components, 16,546 total lines

## Summary

| Metric | Count |
|--------|-------|
| Components >500 lines | 3 🔴 |
| Components >300 lines | 9 🟡 |
| Components with async without try/catch | 0 ✅ |
| console.log in components | 0 ✅ |
| Duplicate patterns detected | 4 🟡 |
| Missing null guards | TBD |
| Hardcoded magic values | 12+ 🟢 |

---

## Findings

### 🔴 Critical
(none)

### 🟡 Warning — Code Structure

#### 1. COMP-001: CronSidebar.svelte — 565 lines, too large
- **File**: `src/lib/components/layout/CronSidebar.svelte`
- **Severity**: 🟡 warning
- **Category**: structure (oversized)
- **Auto-fixable**: ❌ no (requires refactoring to sub-components)
- **Description**: At 565 lines, this is the largest component. Contains sidebar rendering, collapse state, localStorage persistence, cron icon mapping, and navigation — multiple concerns.
- **Proposal**: Extract into 2-3 sub-components:
  - `CronSidebarNav.svelte` — navigation list rendering
  - `CronSidebarCollapsed.svelte` — collapsed icon-only view
  - `CronSidebarToggle.svelte` — toggle button + localStorage logic

#### 2. COMP-002: Noema.svelte — 544 lines, mixed concerns
- **File**: `src/lib/components/tabs/Noema.svelte`
- **Severity**: 🟡 warning
- **Category**: structure (oversized)
- **Auto-fixable**: ❌ no
- **Description**: Mixes live package polling, active phase display, package list, rule display, and expandable detail sections.
- **Proposal**: Extract live polling into a collector/action, split display logic.

#### 3. COMP-003: CronTimeline.svelte — 517 lines
- **File**: `src/lib/components/tabs/CronTimeline.svelte`
- **Severity**: 🟡 warning
- **Category**: structure (oversized)
- **Auto-fixable**: ❌ no
- **Description**: Complex timeline rendering with time calculations, spanning detection, and scroll.
- **Proposal**: Extract timeline calculation logic into `src/lib/core/cron-timeline-utils.ts`.

#### 4. COMP-004: DecisionTrace.svelte — 493 lines
- **File**: `src/lib/components/tabs/DecisionTrace.svelte`
- **Severity**: 🟡 warning
- **Category**: structure (oversized)
- **Auto-fixable**: ❌ no
- **Description**: Large component with trace parsing, loop detection, bottleneck analysis.
- **Proposal**: Extract trace parsing logic to `src/lib/core/decision-trace-parser.ts`.

### 🟡 Warning — Duplicate Patterns

#### 5. COMP-005: fetch-then-json pattern duplicated across 4+ components
- **Files**: `DevJobIndicator.svelte`, `LogsViewer.svelte`, `Noema.svelte`, `Bills.svelte`, `LogPanel.svelte`
- **Severity**: 🟡 warning
- **Category**: maintainability (duplication)
- **Auto-fixable**: ❌ no (requires shared utility)
- **Description**: Pattern repeated across tabs:
  ```js
  const res = await fetch("/api/...");
  const body = await res.json() as SomeType;
  ```
  This pattern appears in at least 5 components. No error checking on `res.ok`, no consistent error handling.
- **Proposal**: Create `src/lib/core/api-utils.ts` with a typed `fetchJSON<T>(url)` helper that handles res.ok, parses JSON, and throws typed errors.

#### 6. COMP-006: relay-action pattern duplicated
- **Files**: `Orchestrator.svelte`, `Bills.svelte`
- **Severity**: 🟡 warning
- **Category**: maintainability (duplication)
- **Auto-fixable**: ❌ no
- **Description**: Same relay URL + POST + JSON pattern for sending actions via the relay.
- **Proposal**: Extract to `src/lib/core/relay-client.ts`.

#### 7. COMP-007: refresh polling with interval pattern duplicated
- **Files**: `DevJobIndicator.svelte`, `Noema.svelte`, `LogsViewer.svelte`
- **Severity**: 🟡 warning
- **Category**: maintainability (duplication)
- **Auto-fixable**: ❌ no
- **Description**: `setInterval` + `onDestroy` cleanup pattern repeated in 3+ components.
- **Proposal**: Create a `usePolling(fn, intervalMs)` composable or helper.

### 🟢 Info

#### 8. COMP-008: No console.log left in components ✅
- **Category**: positive
- **Description**: All components are clean of console.log statements. Good production hygiene.

#### 9. COMP-009: All async functions have try/catch ✅
- **Category**: positive
- **Description**: Every async function found in components has appropriate error handling. No unchecked promises.

#### 10. COMP-010: Consistent import patterns
- **Category**: positive
- **Description**: All components follow consistent Svelte 5 runes pattern (`$state`, `$derived`, `$effect`). No mixed Svelte 4/5 syntax detected.

#### 11. COMP-011: Magic CSS values are contextual, not truly magic
- **Files**: Multiple
- **Severity**: 🟢 info
- **Category**: maintainability
- **Auto-fixable**: ❌ no
- **Description**: CSS values like `280px`, `768px`, `420px` are layout breakpoints and sidebar widths — they represent design decisions, not magic numbers. Not auto-fixable but could benefit from CSS custom properties for theming.
- **Proposal**: Consider `--sidebar-width`, `--breakpoint-tablet`, etc. as CSS custom properties.

---

## Auto-Fix Candidates (Phase 2)

| Priority | Count | Type |
|----------|-------|------|
| ❌ Structural | 4 | Component splitting (proposal only) |
| ❌ Extract utility | 3 | Duplicate patterns (proposal only) |
| ✅ CSS vars | 1 | Add CSS custom properties (low priority) |

**Total auto-fixable now**: 0 (all structural changes need spec + proposal)

---

## Comparison with Previous Run (Jul 17)

| Finding | Jul 17 | Jul 18 | Delta |
|---------|--------|--------|-------|
| Components >500 lines | 3 | 3 | = |
| Duplicate patterns | Same as Jul 17 | Same as Jul 17 | = |
| New structural issues | — | 0 | = |
| PKG-069 (Shared Utility Extraction) | Spec created | Not yet implemented | ⏳ |

**PKG-069** targets COMP-005, COMP-006, COMP-007 — if implemented, all 3 duplicate pattern findings would be resolved.

---

*Generated: Nova 🔧 QA Run #3, 2026-07-18 07:50 CEST*
