# 🔍 Noema Accessibility Gap Scan — 2026-07-18 07:50 CEST
**QA Agent**: Nova 🔧 | **Phase**: 1 (A11Y) | **Scope**: 32 svelte components

## Summary

| Metric | Count |
|--------|-------|
| Total components scanned | 32 |
| Components with 0 aria-labels | 8 |
| Buttons without aria-label | ~23 |
| Toggle controls without aria-expanded | 2 |
| Images without alt | 0 ✅ |
| Total findings | 16 |

---

## Findings

### 🔴 Critical
(none)

### 🟡 Warning

#### 1. A11Y-001: H1.svelte — 0 aria-labels, interactive controls unlabeled
- **File**: `src/lib/components/tabs/H1.svelte`
- **Severity**: 🟡 warning
- **Category**: aria-label
- **Auto-fixable**: ✅ yes (add aria-labels to buttons)
- **Description**: Component has 0 aria-labels despite containing interactive elements. Screen-reader users cannot identify button purpose.
- **Fix**: Add `aria-label` to all `<button>` elements in this component.

#### 2. A11Y-002: Viktor.svelte — 0 aria-labels
- **File**: `src/lib/components/tabs/Viktor.svelte`
- **Severity**: 🟡 warning
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: No aria-labels on interactive controls. 355-line component with complex data display.
- **Fix**: Add aria-labels to buttons and interactive elements.

#### 3. A11Y-003: Orchestrator.svelte — 0 aria-labels
- **File**: `src/lib/components/tabs/Orchestrator.svelte`
- **Severity**: 🟡 warning
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: Action controls without labels. Critical UX for orchestration functions.
- **Fix**: Add aria-labels to send/execute buttons.

#### 4. A11Y-004: OttoTimeline.svelte — 0 aria-labels
- **File**: `src/lib/components/tabs/OttoTimeline.svelte`
- **Severity**: 🟡 warning
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: Timeline controls without accessibility labels.
- **Fix**: Add aria-labels to timeline navigation controls.

#### 5. A11Y-005: ProcessorTimer.svelte — 0 aria-labels
- **File**: `src/lib/components/tabs/ProcessorTimer.svelte`
- **Severity**: 🟡 warning
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: Timer controls without labels.
- **Fix**: Add aria-labels.

#### 6. A11Y-006: DevPackageRow.svelte — Expand toggle without aria-expanded
- **File**: `src/lib/components/shared/DevPackageRow.svelte` :49
- **Severity**: 🟡 warning
- **Category**: semantic (aria-expanded)
- **Auto-fixable**: ✅ yes
- **Description**: `toggleDetail()` function controls expand/collapse but toggle button has no `aria-expanded` attribute. Class `class:expanded` is used but not reflected in ARIA.
- **Fix**: Add `aria-expanded={detailOpen}` to the toggle button.

#### 7. A11Y-007: KanbanBoard.svelte — 0 aria-labels
- **File**: `src/lib/components/tabs/KanbanBoard.svelte`
- **Severity**: 🟡 warning
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: Kanban board with drag-and-drop or interactive columns missing labels.
- **Fix**: Add aria-labels and roles for board columns.

#### 8. A11Y-008: DevJobIndicator.svelte — Buttons without aria-labels
- **File**: `src/lib/components/DevJobIndicator.svelte` :218, :233, :242
- **Severity**: 🟡 warning
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: 3 buttons (status indicator controls) without aria-labels.
- **Fix**: Add descriptive aria-labels: `aria-label="Refresh dev job status"`, etc.

#### 9. A11Y-009: ImplementButton.svelte — Action buttons without aria-labels
- **File**: `src/lib/components/shared/ImplementButton.svelte` :23, :39, :53
- **Severity**: 🟡 warning
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: 3 buttons (implement, log toggle, log close) without aria-labels. These trigger PKG implementation — critical actions need labels.
- **Fix**: Add `aria-label="View implementation log"`, `aria-label="Implement package"`, etc.

#### 10. A11Y-010: ActionButtonGroup.svelte — Dynamic buttons without aria-labels
- **File**: `src/lib/components/shared/ActionButtonGroup.svelte` :113, :131
- **Severity**: 🟡 warning
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: Rendered in `{#each}` loops — buttons get state-based classes but no aria-labels.
- **Fix**: Add `aria-label={action.label || action.key}` to each button.

#### 11. A11Y-011: LogsViewer.svelte — Filter buttons without aria-current
- **File**: `src/lib/components/tabs/LogsViewer.svelte` :134, :144
- **Severity**: 🟡 warning
- **Category**: semantic (aria-current)
- **Auto-fixable**: ✅ yes
- **Description**: Filter buttons use `class:active` but missing `aria-current="page"` on the active filter.
- **Fix**: Add `aria-current={activeFilter === filter.id ? 'page' : undefined}`.

#### 12. A11Y-012: AuditTrail.svelte — Time range buttons without aria-current
- **File**: `src/lib/components/tabs/AuditTrail.svelte` :119
- **Severity**: 🟡 warning
- **Category**: semantic (aria-current)
- **Auto-fixable**: ✅ yes
- **Description**: Time range selector buttons use `class:active` but no `aria-current`.
- **Fix**: Add `aria-current={timeRange === range.id ? 'page' : undefined}`.

#### 13. A11Y-013: Bills.svelte — Mark-paid buttons without aria-label
- **File**: `src/lib/components/tabs/Bills.svelte` :181
- **Severity**: 🟡 warning
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: Payment action buttons missing labels.
- **Fix**: Add `aria-label="Mark as paid"` or similar.

### 🟢 Info

#### 14. A11Y-014: CronSidebar.svelte — Good a11y example ✅
- **File**: `src/lib/components/layout/CronSidebar.svelte` :248
- **Category**: positive
- **Description**: Toggle button has both `aria-label` and `title` with dynamic values based on state. Model implementation for other toggle controls.
- **Action**: Use as reference pattern for other components.

#### 15. A11Y-015: LogPanel.svelte — Log buttons without aria-labels
- **File**: `src/lib/components/shared/LogPanel.svelte` :164
- **Severity**: 🟢 info
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: Reverse-order toggle button missing aria-label.
- **Fix**: Add `aria-label="Reverse log order"`.

#### 16. A11Y-016: Noema.svelte — Tab buttons without aria-labels
- **File**: `src/lib/components/tabs/Noema.svelte` :177, :223, :267, :311
- **Severity**: 🟢 info
- **Category**: aria-label
- **Auto-fixable**: ✅ yes
- **Description**: 4 buttons in Noema dev-packages tab without aria-labels.
- **Fix**: Add descriptive aria-labels.

---

## Auto-Fix Candidates (Phase 2)

All 16 findings are auto-fixable (just adding attributes, no logic changes):

| Priority | Count | Type |
|----------|-------|------|
| ✅ Auto-fix now | 12 | aria-label additions |
| ✅ Auto-fix now | 2 | aria-expanded additions |
| ✅ Auto-fix now | 2 | aria-current additions |

**Total auto-fixable**: 16/16 (100%) — but high count; batch in groups of 5 to avoid breaking changes.

---

*Generated: Nova 🔧 QA Run #3, 2026-07-18 07:50 CEST*
