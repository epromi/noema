# GAP Scan: Accessibility & UX — Noema Dashboard

> **Audit date**: 2026-07-17  
> **Scope**: `src/app.html`, `src/app.css`, all 32 Svelte components  
> **Standard**: WCAG 2.1 AA  
> **Severity**: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · ⚪ Info

---

## 1. Skip-to-Content Link

### 🔴 F1 — Missing skip-to-content link
- **Location**: `src/app.html`, `src/routes/+layout.svelte`
- **WCAG**: 2.4.1 Bypass Blocks (Level A)
- **Detail**: No "Skip to main content" link for keyboard users. They must tab through ~30+ tab bar buttons before reaching the content area.
- **Fix**: Add as first child of `<body>`:

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

- **CSS**:
```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  padding: 8px 16px;
  background: var(--accent);
  color: #000;
  z-index: 10000;
}
.skip-link:focus {
  top: 0;
}
```

---

## 2. Tab Navigation

### 🔴 F2 — Tab pattern missing ARIA roles
- **Location**: `src/routes/+layout.svelte` (lines ~130-155)
- **WCAG**: 4.1.2 Name, Role, Value (Level A)
- **Detail**: Tab bar buttons use bare `<button>` elements without `role="tab"`, `aria-selected`, or `aria-controls`. The tab panels in `+page.svelte` use conditional rendering without `role="tabpanel"` or `aria-labelledby`. Screen readers cannot announce the tab state or relationship.
- **Fix**:

```svelte
<!-- Tab button -->
<button
  type="button"
  role="tab"
  aria-selected={activeTab === tab.id}
  aria-controls="panel-{tab.id}"
  class="tab-btn"
  class:active={activeTab === tab.id}
  onclick={() => (activeTab = tab.id)}
>
  {tab.label}
</button>

<!-- Tab panel in +page.svelte -->
<div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
  <Overview ... />
</div>
```

- **Keyboard**: Add arrow-key navigation between tabs (Left/Right arrows move focus, Home/End for first/last).

### 🔴 F3 — No visible focus indicator on tab buttons
- **Location**: `src/routes/+layout.svelte` — `.tab-btn` style
- **WCAG**: 2.4.7 Focus Visible (Level AA)
- **Detail**: No `:focus-visible` style on tab buttons. Browser default outline may blend with dark theme on some browsers.
- **Fix**:
```css
.tab-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 3px;
}
```

---

## 3. Screen Reader Labels

### 🟠 F4 — Emoji-only UI controls lack accessible names
- **Location**: `src/lib/components/shared/ImplementButton.svelte` (lines 65-76), `src/lib/components/shared/ActionButtonGroup.svelte`
- **WCAG**: 1.1.1 Non-text Content (Level A), 4.1.2 Name, Role, Value
- **Detail**: Buttons in error/offline states render only emoji ("❌", "🔌", "⏳", "✅") as visual content. While `aria-label` is provided on some (`aria-label="Implementation failed"`), the `buttonLabel()` function for `ActionButtonGroup` only returns emoji for `loading`/`ok`/`error`/`offline` states without accompanying text for screen readers.
- **Fix**: Ensure ALL emoji-only state buttons have `aria-label` that describes the state:
```typescript
// Currently: aria-label="✅ Resolve: ok" — the emoji and "OK" are redundant noise
// Better:
function buttonAriaLabel(action: DashboardActionType, state: ActionBtnState): string {
  const base = ACTION_LABELS[action];
  switch (state) {
    case "loading": return `${base}: loading`;
    case "ok": return `${base}: completed`;
    case "error": return `${base}: failed`;
    case "offline": return `${base}: offline`;
    default: return base;
  }
}
```

### 🟠 F5 — Status dots convey information by color alone
- **Location**: `src/lib/components/tabs/Agents.svelte`, `Crons.svelte`, `Overview.svelte`
- **WCAG**: 1.4.1 Use of Color (Level A)
- **Detail**: Status indicator dots (`<span class="status-dot dot-ok"></span>`) convey green/yellow/red status purely through color. No text alternative inside the dot element itself. While some have `title` attributes, `title` is not consistently exposed to screen readers and is not available to touch/ keyboard-only users.
- **Fix**:
```html
<span class="status-dot dot-ok" role="img" aria-label="Status: OK"></span>
```
Or use a visually-hidden text span inside the dot.

### 🟡 F6 — Crypto emoji not labeled for screen readers
- **Location**: `src/routes/+page.svelte` — `<h2 class="sr-only">Noema 🧠</h2>` (already screen-reader-only, so fine)
- **Location**: Various component headers use emoji (`🤖`, `⏰`, `📋`, `📊`) without `aria-hidden="true"` or `role="img"` with labels.
- **WCAG**: 1.1.1 Non-text Content
- **Detail**: Decorative emoji in section headers are read aloud by screen readers (e.g., "robot face Cron timeline"). These should be marked decorative or given labels.
- **Fix**: Wrap decorative emoji with `aria-hidden="true"`:
```html
<h3 class="section-title"><span aria-hidden="true">🤖</span> Agents</h3>
```

### 🔵 F7 — Missing `aria-label` on interactive `tr` rows in some tables
- **Location**: `src/lib/components/tabs/Crons.svelte` — cron table rows have agent-link buttons inside but the row itself is not interactive (good). However, the agent-link buttons have proper `aria-label` (good).
- **Verdict**: Acceptable. ✅

---

## 4. Color Contrast

### 🟠 F8 — Muted text fails WCAG AA on small text
- **Location**: `src/app.css` — `--muted: #8b949e` on `--bg: #0d1117`
- **WCAG**: 1.4.3 Contrast Minimum (Level AA)
- **Detail**: `#8b949e` on `#0d1117` has contrast ratio ~5.4:1. This passes AA for normal text (4.5:1) but is used extensively at `font-size: 0.78em–0.88em` which, at default 16px base, renders at ~12.5–14px — below the 18.66px (14pt) threshold for "large text". At these sizes it falls under "normal text" and technically passes 4.5:1, but is **borderline fatiguing** for extended reading. Many instances use even smaller sizes (`0.72em`, `0.74em`).
- **Fix**: Lighten `--muted` to `#a0aab5` (contrast ~6.5:1) or increase minimum font-size for muted text to 0.9em.

### 🟡 F9 — Yellow warning text contrast borderline
- **Location**: `src/app.css` — `--yellow: #d2991d` on `--bg: #0d1117`
- **WCAG**: 1.4.3 Contrast Minimum
- **Detail**: `#d2991d` on `#0d1117` ≈ 5.0:1. Passes AA but used for small text at 0.78em. Yellow-on-dark also has poor perceptual contrast.
- **Fix**: Consider `#e6b422` or increase font weight to bold for yellow text.

### 🟡 F10 — Red text at small sizes
- **Location**: `src/app.css` — `--red: #f85149` on `--bg: #0d1117`
- **WCAG**: 1.4.3
- **Detail**: `#f85149` on `#0d1117` ≈ 4.7:1. Passes AA but barely. Used in `.log-error` at 0.78em, `level-error` at 0.78em, error badges at 0.82em.
- **Fix**: Slightly lighten to `#ff6b63` for better small-text readability.

### 🟡 F11 — Action button white-on-green/borderline
- **Location**: `src/lib/components/shared/ActionButtonGroup.svelte` — `.action-btn.primary { background: var(--green); color: #fff }`
- **WCAG**: 1.4.3
- **Detail**: `#3fb950` on white ≈ 2.3:1 — **FAILS** for normal text. However, text is bold (`font-weight: 700`) and at 0.78em.
- **Fix**: Use `#1a7a2e` (darker green) for button background with white text, or `#000` text on green background.

### 🟡 F12 — `color-scheme: dark` only — no light mode support
- **Location**: `src/app.html` — `<meta name="color-scheme" content="dark" />`
- **Detail**: Dashboard is always dark. For an internal monitoring tool this is acceptable, but `prefers-color-scheme: light` users get no alternative. This is **intentional design** (the dashboard mimics terminal aesthetics) but should be documented.
- **Verdict**: ⚪ Info — acceptable for an internal admin dashboard. Add a comment in `app.html`.

---

## 5. Focus Management

### 🔴 F13 — Agent Detail Panel: no focus trap, no ESC close
- **Location**: `src/lib/components/shared/AgentDetailPanel.svelte`
- **WCAG**: 2.4.3 Focus Order (Level A), 2.1.2 No Keyboard Trap
- **Detail**: When the slide-in panel opens, focus remains on the triggering element behind the overlay. Keyboard users can tab into elements behind the panel. No ESC key handler to dismiss.
- **Fix**:
```typescript
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") onClose?.();
}
```
Add `onkeydown={handleKeydown}` to the `<aside>`, move focus to the close button on open, trap Tab/Shift+Tab within the panel.

### 🟠 F14 — DevJobIndicator: drag-only positioning, no keyboard alternative
- **Location**: `src/lib/components/DevJobIndicator.svelte`
- **WCAG**: 2.1.1 Keyboard (Level A), 2.5.7 Dragging Movements (Level AA)
- **Detail**: The floating indicator can only be repositioned via mouse/touch drag. No keyboard mechanism to move it. The collapsed view uses `role="button" tabindex="0"` on a drag handle — misleading semantics (it's not a button, it's a movable panel handle).
- **Fix**: Either remove `role="button"` from drag areas (use `role="none"`) or provide arrow-key based repositioning with a toggle button: "Move panel (arrow keys)" → Enter activates move mode → arrows nudge → Enter or Escape exits move mode.

### 🟡 F15 — Focus not managed after tab switch
- **Location**: `src/routes/+page.svelte`, `src/routes/+layout.svelte`
- **WCAG**: 2.4.3 Focus Order
- **Detail**: When a tab button is clicked, the content changes but focus remains on the tab button. User must then tab forward into the new content. Better practice: move focus to the `tabpanel` heading or first interactive element.
- **Fix**: After `activeTab` change, use `requestAnimationFrame` + `focus()` on the tabpanel heading.

---

## 6. Keyboard Shortcuts

### 🟡 F16 — No keyboard shortcuts documented
- **Location**: Entire application
- **WCAG**: 2.1.4 Character Key Shortcuts (Level A) — only if shortcuts exist, but...
- **Detail**: No keyboard shortcuts exist at all. For a power-user dashboard, common shortcuts like `Ctrl+1`–`Ctrl+9` for tab switching, `?` for shortcut help, `/` for search focus, and `ESC` to close panels would significantly improve efficiency.
- **Fix**: Add a keyboard shortcut layer. At minimum:
```typescript
// Alt+1 through Alt+8 for primary tabs
// / to focus search
// Escape to close panels
// ? to show shortcuts help modal
```
Document via a `?` key hint in the footer and a modal.

---

## 7. Responsive Layout

### 🟢 Good — Responsive design is generally solid
- **Breakpoints**: 900px (sidebar width), 768px (grid columns, padding), 599px (mobile sidebar hide, mobile cron tab)
- **Grid adaptation**: Metric cards go from 4→2 columns, agent grids from 4→2, kanban from 3→1
- **Sidebar**: Hides below 599px and appears as a mobile-only tab

### 🟡 F17 — Sidebar collapse to 40px hides all content without accessible alternative
- **Location**: `src/lib/components/layout/CronSidebar.svelte`
- **WCAG**: 1.4.10 Reflow (Level AA)
- **Detail**: Collapsed sidebar at 40px shows only emoji icons — no text labels. Screen reader users get the text from `aria-label` on buttons but these are crammed into 40px. The collapsed state is persisted in localStorage.
- **Fix**: Add `aria-label` with cron name to each collapsed icon button (they already have this), and ensure the expand button is always visible.

### 🔵 F18 — Log viewer grid collapses timestamps and level tags on mobile
- **Location**: `src/lib/components/tabs/LogsViewer.svelte`
- **WCAG**: 1.4.10 Reflow
- **Detail**: At ≤768px, `.timestamp` and `.level-tag` columns are `display: none`. This hides severity information. For error logs this is critical context.
- **Fix**: Instead of hiding, wrap or abbreviate:
```css
@media (max-width: 768px) {
  .log-line {
    grid-template-columns: 36px 64px 1fr;
  }
  .level-tag {
    font-size: 0.65em;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
```

---

## 8. Dark Mode / `prefers-color-scheme`

### 🟡 F19 — No light mode alternative
- **Location**: `src/app.html`, `src/app.css`
- **WCAG**: Not strictly a WCAG violation, but best practice.
- **Detail**: Design system is hardcoded dark (`color-scheme: dark`). No CSS custom property swap for `prefers-color-scheme: light`. For an internal dev dashboard this is acceptable but worth documenting.
- **Fix**: If light mode is desired, use:
```css
@media (prefers-color-scheme: light) {
  :root {
    --bg: #ffffff;
    --card: #f6f8fa;
    /* ... etc */
  }
}
```

---

## 9. `prefers-reduced-motion`

### 🟢 Good — `prefers-reduced-motion` is respected
- **Location**: `src/app.css` (lines at bottom)
- **Detail**: Correctly disables animations and transitions:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
- **Caveat**: CSS-only approach means JS-driven animations (e.g., `setInterval` for NOW-marker pulses, countdown updates) still run. These are functional (real-time data updates), not decorative, so acceptable. ✅

### 🟡 F20 — NOW-marker pulse animation has no reduced-motion alternative
- **Location**: `src/lib/components/layout/CronSidebar.svelte` — `@keyframes cs-now-pulse`
- **WCAG**: 2.3.3 Animation from Interactions (Level AAA)
- **Detail**: The "NOW" marker has a pulsing `box-shadow` animation via `cs-now-pulse`. The global `prefers-reduced-motion` media query should catch this, but only if the animation is applied via `animation` property. It is (`animation: cs-now-pulse 2s ease-in-out infinite`), so the global rule will override it. ✅ (verified — global rule handles it)

---

## 10. `<html>` & Document Structure

### 🟡 F21 — Missing `<title>` element
- **Location**: `src/app.html`
- **WCAG**: 2.4.2 Page Titled (Level A)
- **Detail**: No `<title>` tag. SvelteKit manages this via `%sveltekit.head%` — depending on the SvelteKit config, a title should be set in `+layout.svelte` via `<svelte:head>`.
- **Fix**: In `src/routes/+layout.svelte`:
```svelte
<svelte:head>
  <title>Noema — System Intelligence Dashboard</title>
</svelte:head>
```

### 🔵 F22 — `display: contents` on body wrapper removes semantics
- **Location**: `src/app.html` — `<div style="display: contents">%sveltekit.body%</div>`
- **Detail**: `display: contents` removes the div from the accessibility tree, which is the intent here (it's a SvelteKit mount wrapper). However, some browser/screen-reader combinations have bugs with `display: contents` on elements that contain interactive content.
- **Fix**: SvelteKit convention. Monitor SvelteKit upgrades for better patterns. Low risk for this dashboard's target audience.

---

## 11. Table Accessibility

### 🟢 Good — Tables use `<caption>` and `<th scope="col">`
- **Location**: `Agents.svelte`, `Crons.svelte`, `H1.svelte`, `Viktor.svelte`, `Bills.svelte`
- **Detail**: All data tables have proper `<caption>`, `<thead>`, `<th scope="col">` structure. ✅

### 🟡 F23 — Clickable table rows with `role="button"` are unusual
- **Location**: `Agents.svelte` — `<tr role="button" tabindex="0" ...>`
- **WCAG**: 1.3.1 Info and Relationships
- **Detail**: An `<tr>` with `role="button"` overrides the row semantics. Screen readers will announce "button" not "row 3 of 10, Agent Name". Nested interactive elements (like status dots) lose their semantics inside the button.
- **Fix**: Add an explicit "View" button/link as a cell instead:
```html
<td><button class="view-agent-btn" aria-label="View agent {agent.name}">→</button></td>
```
Or use `role="row"` on the tr and a click handler with `Enter`/`Space` on a specific cell.

---

## 12. Forms & Inputs

### 🟡 F24 — Search input not in a `<form>` or `<search>` landmark
- **Location**: `src/lib/components/tabs/Noema.svelte`
- **WCAG**: 1.3.1 Info and Relationships
- **Detail**: The search input is a standalone `<input type="search">` wrapped in a `<label>`. It's not inside a `<form>` or `<search>` landmark. A `<search>` landmark would help screen reader users locate it quickly.
- **Fix**:
```html
<div role="search" aria-label="Search packages">
  <label class="search-wrap">...</label>
</div>
```

### 🔵 F25 — Filter `<select>` elements lack associated `<label>` in some contexts
- **Location**: `src/lib/components/tabs/AuditTrail.svelte`, `DecisionTrace.svelte`
- **WCAG**: 1.3.1, 3.3.2 Labels or Instructions
- **Detail**: Audit trail and Decision trace use `<label class="filter-group"><span>Session</span><select>...</select></label>` — this is correct implicit labeling. ✅

---

## 13. Content & Semantics

### 🟡 F26 — `@html` usage without sanitization
- **Location**: `src/lib/components/shared/AgentDetailPanel.svelte` — `{@html agent.extra}`
- **WCAG**: Not directly WCAG but security/accessibility.
- **Detail**: Raw HTML injection from server data. If `agent.extra` contains images without `alt` text, unlabeled links, or interactive elements without ARIA, it creates accessibility failures. No sanitization is applied.
- **Fix**: Sanitize HTML, ensure images have alt text, or render via a structured component instead of `@html`.

### 🔵 F27 — Landmark structure is reasonable
- **Detail**: One `<header>`, one `<main>`, one `<aside>` (sidebar), one `<aside>` (agent panel), `<nav>` elements. No `<footer>`. No duplicate top-level landmarks.
- **Verdict**: Acceptable. Optionally add `<footer>` with version/build info.

---

## 14. Additional UX Observations

### 🟡 F28 — No loading states for data-dependent sections
- **Location**: All tab components
- **Detail**: When SSE data hasn't arrived, components show "No data" or "N/A" messages. No skeleton loaders, no `aria-busy` indicators. Screen reader users have no indication that data is loading.
- **Fix**: Add `aria-busy="true"` and `aria-live="polite"` regions during initial data fetch. Example:
```html
<section aria-busy={loading} aria-live="polite">
  {#if loading}
    <p>Loading system data…</p>
  {:else}
    <!-- content -->
  {/if}
</section>
```

### 🔵 F29 — No zoom/scale lock
- **Detail**: Viewport meta tag uses `initial-scale=1` without `maximum-scale` or `user-scalable=no`. ✅ Good — allows pinch-zoom on mobile.

### 🔵 F30 — Timestamps not in `<time>` element consistently
- **Location**: Most components use plain `<span>` for timestamps. `AuditTrail.svelte` and `DecisionTrace.svelte` correctly use `<time datetime="...">`.
- **WCAG**: 1.3.1
- **Fix**: Wrap all timestamps in `<time>` elements with `datetime` attributes.

---

## Summary

| Severity | Count | Category |
|----------|-------|----------|
| 🔴 Critical | 3 | Skip link (F1), Tab ARIA (F2), Focus trap (F13) |
| 🟠 High | 4 | Emoji labels (F4), Color-only info (F5), Muted contrast (F8), Drag-only (F14) |
| 🟡 Medium | 12 | Various contrast, focus, shortcuts, semantics |
| 🔵 Low | 6 | Minor structural issues |
| ⚪ Info | 1 | Dark-mode only by design |

### Quick Wins (fix in < 30 min)
1. **Add skip-to-content link** (F1) — 5 lines in `app.html`
2. **Add `role="tab"` + `aria-selected`** to tab buttons (F2) — 2 lines per tab
3. **Add `:focus-visible` styles** globally (F3) — 3 CSS rules
4. **Add ESC key handler** to AgentDetailPanel (F13) — 5 lines
5. **Add `<title>` in `<svelte:head>`** (F21) — 3 lines
6. **Wrap decorative emoji** with `aria-hidden="true"` (F6) — find-and-replace

### Medium Effort (fix in 1-2 hours)
- Tab keyboard navigation (arrows between tabs)
- Focus trap for Agent Detail Panel
- Button label improvements for emoji-only states
- Status dot text alternatives
- Keyboard shortcuts system

### Design Decisions (discuss first)
- Light mode support (F19) — intentional dark-only design?
- Muted text contrast increase (F8) — affects visual design
- Table row `role="button"` refactor (F23) — significant markup change
