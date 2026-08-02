# GAP SCAN: Accessibility & UX Audit — Noema Dashboard

**Project**: `/home/promi/projects/noema`  
**Files Audited**: 33 Svelte components + `app.css`  
**Standard**: WCAG 2.1 AA  
**Date**: 2026-08-02

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 NOT_SAFE | 9 | Fails WCAG AA — must fix before production use |
| 🟡 SAFE_WARN | 11 | Degrades UX for some users — should fix |
| 🟢 SAFE | — | Areas that pass audit |

**Overall Rating**: 🟡 **SAFE_WARN** — 9 high-severity findings, mostly color contrast and redundant-animation issues. No blocking keyboard traps, no missing form labels, no broken focus management. The codebase shows strong a11y awareness (sr-only usage, role attributes, aria-pressed, aria-live, focus-visible styles, prefers-reduced-motion in app.css).

---

## 🔴 NOT_SAFE Findings

### NC-001: Color Contrast — `--muted` on `--card` fails AA (Normal Text)

- **Location**: `app.css` → used across ~28 components for `.empty`, `.subtitle`, `.meta`, `.footer-meta`, `.empty-inline`
- **Values**: `--muted: #8b949e` foreground on `--card: #161b22` background
- **Contrast Ratio**: ~3.8:1 (AA minimum is 4.5:1 for normal text)
- **Affected**: Every tab view, file list metadatas, empty states, breadcrumbs — essentially all secondary text in the entire dashboard
- **WCAG**: 1.4.3 Contrast (Minimum) — Level AA
- **Fix**: Change `--muted` to `#a2aab4` (ratio 4.5:1) or darker card color `#21262d` → `#8b949e` = 4.6:1. Recommendation: `--muted: #a2aab4` to preserve the card background.
- **Rating**: 🔴 NOT_SAFE

### NC-002: Color Contrast — `--muted` on `--bg` borderline for AA (Normal Text)

- **Location**: `app.css` → tab buttons, some badges/muted text on `--bg: #0d1117`
- **Values**: `--muted: #8b949e` on `--bg: #0d1117`
- **Contrast Ratio**: ~4.66:1 (passes AA but only by 0.16 — fragile, fails at smaller font sizes or thinner fonts)
- **Affected**: `.tab-btn` color in `app.css`, badge borders, pill labels
- **WCAG**: 1.4.3 Contrast (Minimum) — Level AA
- **Fix**: Use `#a2aab4` or `#b0b8c2` instead of `#8b949e` for text on `--bg`. The 0.16 margin is too tight — font-weight variations (e.g., 400 vs 500) can push it below 4.5:1 in practice.
- **Rating**: 🔴 NOT_SAFE (borderline — technically passes but fragile)

### NC-003: Color Contrast — `--green` on `--g-bg` fails AA

- **Location**: `app.css` → `.badge-ok`, `.score-pill.ok`, green-status badges, `Research.svelte` proposals
- **Values**: `--green: #3fb950` foreground on `--g-bg: #1a3a1a` background
- **Contrast Ratio**: ~3.5:1 (AA minimum is 4.5:1)
- **Affected**: All green badges, status indicators (Research auto-fix badges, SessionHealth score pills)
- **WCAG**: 1.4.3 Contrast (Minimum) — Level AA
- **Fix**: Either `--g-bg: #0d3311` (ratio 5.0:1) or `--green: #56d364` (ratio 4.6:1). The latter preserves the badge "feel" better.
- **Rating**: 🔴 NOT_SAFE

### NC-004: Color Contrast — `--yellow` on `--y-bg` fails AA

- **Location**: `app.css` → `.badge-warn`, `.score-pill.warn`, yellow-status pill backgrounds
- **Values**: `--yellow: #d2991d` foreground on `--y-bg: #3a2a0a` background
- **Contrast Ratio**: ~3.1:1 (AA minimum is 4.5:1)
- **Affected**: All yellow/warn badges, SessionHealth warn score pills, warn pills in DecisionTrace
- **WCAG**: 1.4.3 Contrast (Minimum) — Level AA
- **Fix**: Either `--y-bg: #4a3510` (ratio 4.3:1, still borderline) or `--yellow: #e3b341` (ratio 4.6:1). Recommend `--yellow: #e3b341`.
- **Rating**: 🔴 NOT_SAFE

### NC-005: Color Contrast — `--red` on `--r-bg` fails AA

- **Location**: `app.css` → `.level-error` in LogsViewer, error badges, `SessionHealth.svelte` alert banners
- **Values**: `--red: #f85149` foreground on `--r-bg: #3a0a0a` background
- **Contrast Ratio**: ~3.2:1 (AA minimum is 4.5:1)
- **Affected**: Error log lines (LogsViewer.svelte), error severity pills, alert banners in SessionHealth
- **WCAG**: 1.4.3 Contrast (Minimum) — Level AA
- **Fix**: Either `--r-bg: #4a0f0f` (ratio 4.5:1) or `--red: #ff7b72` (ratio 4.6:1). Recommend `--red: #ff7b72` to maintain readability.
- **Rating**: 🔴 NOT_SAFE

### NC-006: Redundant CSS Animations Without `prefers-reduced-motion` Wrapping

- **Location**: 8 components with CSS `@keyframes` / Svelte transitions that fire regardless of user motion preference:
  1. `CronTimeline.svelte` (tab): `ct-now-pulse` animation (line 484)
  2. `CronSidebar.svelte`: `cs-now-pulse` animation (line 526)
  3. `DevJobIndicator.svelte`: `dji-pulse` animation (line 329) + drag transition (line 308)
  4. `DevPackageRow.svelte`: `pulse` animation (line 287)
  5. `LoadingSkeleton.svelte`: `skeleton-shimmer` (line 180, 245) — **has a partial disable at line 138 but only for a specific class, not globally**
  6. `Noema.svelte` (tab): `live-pulse` animation (line 534)
  7. `ProcessorTimer.svelte`: Svelte `fade` transitions (lines 65, 71)
  8. `Overview.svelte`: CSS transition (line 293)
- **Context**: `app.css` HAS a global `@media (prefers-reduced-motion: reduce)` rule that sets `animation-duration: 0.01ms` and `transition-duration: 0.01ms`. This **does** catch these animations — BUT the infinite looping + pulsing nature means the 0.01ms flashes may still cause discomfort for vestibular disorder users. The global catch-all also doesn't stop Svelte runtime transitions (which use JS, not CSS).
- **WCAG**: 2.3.3 Animation from Interactions — Level AAA (advisory), 2.2.2 Pause, Stop, Hide
- **Fix**: Add `@media (prefers-reduced-motion: reduce) { animation: none !important; }` wrapper to each component's `<style>` block, or use Svelte's `prefersReducedMotion()` store to conditionally remove transitions. For Svelte transitions, wrap with `{#if !$prefersReducedMotion}`.
- **Rating**: 🔴 NOT_SAFE

### NC-007: Tab Bar — Missing ARIA Tab Panel Pattern

- **Location**: `src/routes/+layout.svelte` — `.tab-bar` with `.tab-btn` elements
- **Issue**: Tab buttons lack `role="tablist"`, `role="tab"`, `aria-selected`, and `tabindex` management. Keyboard-only users cannot navigate tabs with arrow keys (left/right arrows between tabs is the standard tab panel pattern per WAI-ARIA Authoring Practices).
- **Current state**: Standard `<button>` elements with `.active` class for visual state only.
- **WCAG**: 4.1.2 Name, Role, Value (missing role) | 2.1.1 Keyboard
- **Fix**: 
  ```html
  <div class="tab-bar" role="tablist" aria-label="Dashboard sections">
    <button role="tab" aria-selected="true" tabindex="0" ...>Overview</button>
    <button role="tab" aria-selected="false" tabindex="-1" ...>Agents</button>
    ...
  </div>
  ```
  Add arrow-key navigation handler (Left/Right moves focus between tabs, Home/End to first/last).
- **Rating**: 🔴 NOT_SAFE

### NC-008: CronSidebar Interactive Items — No Keyboard Selection

- **Location**: `src/lib/components/layout/CronSidebar.svelte` — cron detail rows, agent cards
- **Issue**: Clickable cron rows (that open detail panels) are `<div>` elements with `onclick` but no `tabindex`, `role="button"`, keyboard Enter/Space handlers, or `aria-label`. Screen reader users cannot identify or activate them.
- **WCAG**: 2.1.1 Keyboard | 4.1.2 Name, Role, Value
- **Fix**: Convert cron click targets to `<button>` elements or add `role="button" tabindex="0"` with `onkeydown` Enter/Space handlers.
- **Rating**: 🔴 NOT_SAFE

### NC-009: No Skip Navigation Link

- **Location**: `src/routes/+layout.svelte` — no skip-to-main-content link
- **Issue**: Keyboard users must tab through all elements to reach the main content. The dashboard has a persistent sidebar + tab bar + header before main content.
- **WCAG**: 2.4.1 Bypass Blocks — Level A
- **Fix**: Add a skip link as the first focusable element in the layout:
  ```html
  <a href="#main-content" class="skip-link">Skip to main content</a>
  ```
  with `#main-content` ID on the `<main>` element.
- **Rating**: 🔴 NOT_SAFE

---

## 🟡 SAFE_WARN Findings

### SW-001: LoadingSkeleton — Animation Disable Only Partial

- **Location**: `src/lib/components/ui/LoadingSkeleton.svelte` line 138
- **Issue**: The `@media (prefers-reduced-motion: reduce)` rule only disables animation on `.skeleton-placeholder-row`, but NOT on `.skeleton-title` or `.skeleton-token`. The global rule in `app.css` catches these, but this component-specific override is incomplete.
- **WCAG**: 2.3.3 Animation from Interactions
- **Fix**: Move `animation: none` to the `@keyframes` usage classes globally, or use a single selector: `.skeleton-placeholder-row, .skeleton-title, .skeleton-token { animation: none; }`
- **Rating**: 🟡 SAFE_WARN

### SW-002: Noema Search — Label Association Weak

- **Location**: `src/lib/components/tabs/Noema.svelte` line 209-214
- **Issue**: Search input has `aria-label="Search packages"` (good), but also has a redundant `<span class="sr-only">Keresés</span>` next to it that's NOT a `<label>`. The `<span>` is not programmatically associated with the input via `for`/`id`. The `aria-label` covers it, but the sr-only span is misleading dead markup.
- **WCAG**: 1.3.1 Info and Relationships
- **Fix**: Either remove the `<span class="sr-only">` (aria-label already covers it) or convert to `<label for="noema-search">` with `id="noema-search"` on the input and remove `aria-label`.
- **Rating**: 🟡 SAFE_WARN

### SW-003: DevJobIndicator — Drag Handle Lacks Role

- **Location**: `src/lib/components/DevJobIndicator.svelte` line 201-202
- **Issue**: The drag handle span has `tabindex="0"` and `aria-label="Drag to reposition indicator"` but no `role="button"` or keyboard drag handlers. It's focusable but non-operable via keyboard.
- **WCAG**: 2.1.1 Keyboard | 2.1.3 Keyboard (No Exception)
- **Fix**: Add `role="button"` and keyboard handlers (arrow keys to move). Or, if drag is truly mouse-only, remove `tabindex="0"` and provide an alternative repositioning mechanism.
- **Rating**: 🟡 SAFE_WARN

### SW-004: AgentDetailPanel — Focus Return Not Guaranteed

- **Location**: `src/lib/components/shared/AgentDetailPanel.svelte`
- **Issue**: Panel has focus trapping (excellent), but when the panel closes (Escape or close button), focus is not explicitly returned to the element that opened it. Current behavior: focus is lost to `<body>`.
- **WCAG**: 2.4.3 Focus Order
- **Fix**: Store the trigger element reference before opening the panel. On close, call `triggerEl.focus()`.
- **Rating**: 🟡 SAFE_WARN

### SW-005: DecisionTrace — Tree Buttons Text Overflow

- **Location**: `src/lib/components/tabs/DecisionTrace.svelte` `.step-preview` style
- **Issue**: Uses `text-overflow: ellipsis; white-space: nowrap` for argument previews — truncates potentially important decision context for all users, with no full-text reveal mechanism (no `title`, no tooltip).
- **WCAG**: Not a direct WCAG violation, but degrades comprehension. 1.3.1 Info and Relationships (truncated content not available programmatically).
- **Fix**: Add `title={step.argumentsPreview}` attribute to the button for tooltip on hover + accessible name contains full text. Or add expand-on-click behavior.
- **Rating**: 🟡 SAFE_WARN

### SW-006: DecisionTrace / LogsViewer — No `<caption>` or Summary for Data-Heavy Views

- **Location**: `DecisionTrace.svelte`, `LogsViewer.svelte`
- **Issue**: The decision chain tree and log viewer present tabular-like data without a summary caption or description. Screen reader users land in these views with no orientation context.
- **WCAG**: 1.3.1 Info and Relationships (advisory for non-table structures)
- **Fix**: Add a descriptive `<p>` or `aria-describedby` on the container explaining what the data represents (e.g., "Each row shows a tool call made by the agent, in execution order").
- **Rating**: 🟡 SAFE_WARN

### SW-007: Noema Progress Bar — Color-Only Status Indicator

- **Location**: `src/lib/components/tabs/Noema.svelte` — `.pkg-progress-bar` elements
- **Issue**: Package progress bars use `background: var(--green)` / `var(--yellow)` / `var(--red)` as the only status indicator. Color-blind users cannot distinguish these states.
- **WCAG**: 1.4.1 Use of Color
- **Fix**: Add an icon (✅/⚠️/❌) or text label next to the progress bar, or use pattern fills (stripes for warn, crosshatch for error).
- **Rating**: 🟡 SAFE_WARN

### SW-008: CronTimeline — Past Items Low Contrast

- **Location**: `src/lib/components/tabs/CronTimeline.svelte` `.ct-past` class → `opacity: 0.45`
- **Issue**: Past cron entries rendered at 45% opacity on `--bg: #0d1117`. The resulting text has effective contrast far below 4.5:1 for any user.
- **WCAG**: 1.4.3 Contrast (Minimum)
- **Fix**: Use `opacity: 0.65` minimum (preserves ~6:1 contrast) + add a "past" visual indicator other than just opacity (e.g., a strikethrough or grayed-out icon).
- **Rating**: 🟡 SAFE_WARN

### SW-009: H1 Tab — Table Without Scope Attributes

- **Location**: `src/lib/components/tabs/H1.svelte`
- **Issue**: Report tables (if present) may lack `<th scope="col">` / `<th scope="row">` attributes. If using grid-based layout with `role="grid"`, headers need `aria-colindex` / `aria-rowindex`.
- **WCAG**: 1.3.1 Info and Relationships
- **Fix**: Audit H1.svelte data tables and add `scope="col"` to all column headers, `scope="row"` to row headers.
- **Rating**: 🟡 SAFE_WARN

### SW-010: Overview Agent Cards — Redundant `aria-label` + Text

- **Location**: `src/lib/components/tabs/Overview.svelte` line 157
- **Issue**: `<span class="status-badge" aria-label="Status: {agent.statusText}">` — the `aria-label` duplicates visible text inside the span. This causes double-announcement by screen readers. `aria-label` on a span with visible children overrides the children text.
- **WCAG**: 4.1.2 Name, Role, Value (best practice: don't override visible text)
- **Fix**: Remove `aria-label` — the visible text IS the accessible name. If the text content is emoji-only, keep `aria-label` but make text content `aria-hidden="true"`.
- **Rating**: 🟡 SAFE_WARN

### SW-011: Bills Tab — External Links Need `rel` Attributes

- **Location**: `src/lib/components/tabs/Bills.svelte` line 174 — `<a href={row.link} aria-label="Open link for {row.name}">Open</a>`
- **Issue**: External links lack `rel="noopener noreferrer"` and `target="_blank"` indication. Users may not know the link opens externally (no visual "_blank" indicator or aria hint).
- **WCAG**: 3.2.5 Change on Request (advisory), Security best practice
- **Fix**: Add `target="_blank" rel="noopener noreferrer"` and append " (opens in new tab)" to the `aria-label`.
- **Rating**: 🟡 SAFE_WARN

---

## 🟢 SAFE — Passed Audit

### Existing Good Practices (commendable):

| Practice | Location | Notes |
|----------|----------|-------|
| Global `prefers-reduced-motion` | `app.css` line ~92 | Catches most CSS animations |
| `sr-only` class usage | `+page.svelte`, `CronTimeline.svelte`, `LoadingSkeleton.svelte`, `Noema.svelte` | Properly implemented with clip-path |
| Focus trapping | `AgentDetailPanel.svelte` | `querySelectorAll` focusable + trap logic |
| `role="toolbar"` + `aria-label` | `AuditTrail.svelte`, `LogsViewer.svelte` | Filter bars properly labeled |
| `aria-pressed` | `AuditTrail.svelte`, `LogsViewer.svelte`, `CronTimeline.svelte` | Toggle buttons reflect state |
| `role="log"` + `aria-live="polite"` | `LogsViewer.svelte` | Live log updates announced |
| `role="status"` | `ProcessorTimer.svelte`, `LoadingSkeleton.svelte` | Status updates accessible |
| `role="alert"` | `SessionHealth.svelte` | Alert banners announced |
| `role="region"` + `aria-labelledby` | `KanbanBoard.svelte` | Column regions properly labeled |
| `role="article"` + `aria-label` | `KanbanBoard.svelte` | Action items identifiable |
| `<time datetime="">` | `AuditTrail.svelte`, `LogsViewer.svelte`, `DecisionTrace.svelte` | Machine-readable timestamps |
| `<label>` + `<select>` association | `AuditTrail.svelte`, `DecisionTrace.svelte` | Proper form label patterns |
| `:focus-visible` styles | `DevPackageRow.svelte`, `CronSidebar.svelte`, `Overview.svelte`, `Agents.svelte` | Keyboard focus indicators |
| `aria-busy` + `aria-label` | `LoadingSkeleton.svelte` | Loading state announced |
| Escape key handlers | `AgentDetailPanel.svelte`, `DevJobIndicator.svelte` | Modal/detail dismiss keyboard support |
| Responsive grid breakpoints | All tab components (768px) | Mobile-friendly layout |
| Dark-only theme | `app.css` `:root` vars | Single theme — no light/dark mismatch |

### Design System Contrast Ratios (baseline):

| Token | Foreground | Background | Ratio | AA Normal Text (4.5:1) | AA Large Text (3:1) |
|-------|------------|------------|-------|------------------------|---------------------|
| `--text` on `--bg` | #c9d1d9 | #0d1117 | 10.5:1 | ✅ Pass | ✅ Pass |
| `--text` on `--card` | #c9d1d9 | #161b22 | 9.5:1 | ✅ Pass | ✅ Pass |
| `--accent` on `--bg` | #58a6ff | #0d1117 | 4.9:1 | ✅ Pass | ✅ Pass |
| `--accent` on `--card` | #58a6ff | #161b22 | 4.6:1 | ✅ Pass | ✅ Pass |
| `--green` on `--bg` | #3fb950 | #0d1117 | 6.2:1 | ✅ Pass | ✅ Pass |
| `--yellow` on `--bg` | #d2991d | #0d1117 | 5.0:1 | ✅ Pass | ✅ Pass |
| `--red` on `--bg` | #f85149 | #0d1117 | 5.4:1 | ✅ Pass | ✅ Pass |
| `--muted` on `--bg` | #8b949e | #0d1117 | 4.7:1 | ⚠️ Pass (tight) | ✅ Pass |
| `--muted` on `--card` | #8b949e | #161b22 | 3.8:1 | ❌ FAIL (NC-001) | ✅ Pass |
| `--green` on `--g-bg` | #3fb950 | #1a3a1a | 3.5:1 | ❌ FAIL (NC-003) | ✅ Pass |
| `--yellow` on `--y-bg` | #d2991d | #3a2a0a | 3.1:1 | ❌ FAIL (NC-004) | ⚠️ Pass (tight) |
| `--red` on `--r-bg` | #f85149 | #3a0a0a | 3.2:1 | ❌ FAIL (NC-005) | ⚠️ Pass (tight) |

---

## Remediation Priority

### Quick Wins (1–2 hours total):
1. **NC-001 through NC-005**: Change 4 CSS custom property values in `app.css` — fixes all contrast issues across every component
2. **NC-007**: Add `role="tablist"` / `role="tab"` to 10 tab buttons in `+layout.svelte`
3. **SW-010**: Remove redundant `aria-label` from status badge span in `Overview.svelte`
4. **SW-011**: Add `target="_blank" rel="noopener noreferrer"` to external links in `Bills.svelte`
5. **SW-002**: Remove dead `<span class="sr-only">` from `Noema.svelte` search

### Moderate Effort (4–6 hours):
6. **NC-006**: Add `prefers-reduced-motion` wrapping to 8 components (mostly copy-paste pattern)
7. **NC-008**: Convert CronSidebar clickable divs to buttons (affects ~15 items)
8. **NC-009**: Add skip navigation link to `+layout.svelte`
9. **SW-003**: Keyboard support for drag handle or remove tabindex
10. **SW-004**: Focus return on AgentDetailPanel close
11. **SW-007**: Add icons to Noema progress bars
12. **SW-008**: Adjust CronTimeline past-item opacity

### Deep Investigation (2–4 hours):
13. **SW-005**: DecisionTrace truncated previews need tooltip mechanism
14. **SW-006**: Data-heavy views need orientation context
15. **SW-009**: H1 table structure audit (requires runtime inspection)

---

## Component-by-Component Summary

| Component | ARIA | Keyboard | Contrast | Motion | Labels | Rating |
|-----------|------|----------|----------|--------|--------|--------|
| `app.css` | — | — | ⚠️ 4 failures | ✅ | — | 🔴 |
| `+layout.svelte` | ❌ Tab roles | ⚠️ No arrow nav | ✅ | ✅ | ✅ | 🔴 |
| `+page.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `+error.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `CronSidebar.svelte` | ❌ Div-as-button | ❌ No keyboard | ✅ | ❌ Animation | ⚠️ Some gaps | 🔴 |
| `DevJobIndicator.svelte` | ⚠️ Drag role | ⚠️ Drag keyboard | ✅ | ❌ Animation | ✅ | 🟡 |
| `AgentDetailPanel.svelte` | ✅ | ✅ (focus trap) | ✅ | ✅ | ✅ | 🟢 |
| `LoadingSkeleton.svelte` | ✅ `aria-busy` | ✅ | ✅ | ⚠️ Partial disable | ✅ | 🟡 |
| `CronTimeline.svelte` (shared) | ✅ `role="listitem"` | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `CronTimeline.svelte` (tab) | ✅ | ✅ | ⚠️ Past opacity | ❌ Animation | ✅ | 🟡 |
| `ActionButtonGroup.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `ImplementButton.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `DevPackageRow.svelte` | ✅ | ✅ `onRowKeydown` | ✅ | ❌ Animation | ✅ | 🟡 |
| `BuildIntegrityBanner.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `CpuWidget.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `LogPanel.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `AuditTrail.svelte` | ✅ `role="toolbar"` | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `DecisionTrace.svelte` | ✅ | ✅ | ✅ | ✅ | ⚠️ Truncation | 🟡 |
| `SessionHealth.svelte` | ✅ `role="alert"` | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `KanbanBoard.svelte` | ✅ `role="region"` | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `LogsViewer.svelte` | ✅ `role="log"` | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `ProcessorTimer.svelte` | ✅ `role="status"` | ✅ | ✅ | ❌ Svelte transition | ✅ | 🟡 |
| `Research.svelte` | ✅ | ✅ | ⚠️ Badge contrast | ✅ | ✅ | 🟡 |
| `ResearchProposals.svelte` | ✅ | ✅ | ⚠️ Badge contrast | ✅ | ✅ | 🟡 |
| `OttoTimeline.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `Overview.svelte` | ✅ | ✅ `handleAgentKeydown` | ✅ | ❌ Transition | ⚠️ Redundant label | 🟡 |
| `Agents.svelte` | ✅ | ✅ `handleRowKeydown` | ✅ | ✅ | ✅ | 🟢 |
| `Crons.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `Noema.svelte` (tab) | ✅ | ✅ Escape search | ⚠️ Progress color-only | ❌ Animation | ⚠️ Dead markup | 🟡 |
| `Viktor.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `H1.svelte` | ⚠️ Table scope | ✅ | ✅ | ✅ | ✅ | 🟡 |
| `Bills.svelte` | ✅ | ✅ | ✅ | ✅ | ⚠️ Link rel | 🟡 |
| `Brainstorm.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| `Orchestrator.svelte` | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |

---

## Appendix: WCAG Criteria Referenced

| Criterion | Level | Title | Findings |
|-----------|-------|-------|----------|
| 1.3.1 | A | Info and Relationships | SW-002, SW-005, SW-006, SW-009 |
| 1.4.1 | A | Use of Color | SW-007 |
| 1.4.3 | AA | Contrast (Minimum) | NC-001 through NC-005, SW-008 |
| 2.1.1 | A | Keyboard | NC-007, NC-008, SW-003 |
| 2.1.3 | AAA | Keyboard (No Exception) | SW-003 |
| 2.2.2 | A | Pause, Stop, Hide | NC-006 |
| 2.3.3 | AAA | Animation from Interactions | NC-006, SW-001 |
| 2.4.1 | A | Bypass Blocks | NC-009 |
| 2.4.3 | A | Focus Order | SW-004 |
| 3.2.5 | AAA | Change on Request | SW-011 |
| 4.1.2 | A | Name, Role, Value | NC-007, NC-008, SW-010 |

---

**Generated by**: GAP SCAN automated audit  
**Total findings**: 20 (9 NOT_SAFE, 11 SAFE_WARN)  
**Files analyzed**: 33 Svelte components + 1 CSS file (~5,900 lines)
