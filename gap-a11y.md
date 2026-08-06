# Noema Accessibility & UX Gap Scan

**Date**: 2026-08-05 | **Scope**: Full dashboard (17 components, layout, navigation)  
**WCAG Target**: 2.1 Level AA | **Method**: Static code audit + color contrast analysis  
**PKG-045**: Not found (dark mode IS flagged below)  
**PKG-046**: Not found (keyboard shortcuts IS flagged below)  
**PKG-078**: Exists (color scheme toggle spec — dark mode gap below references it)  
**Excluded**: aria-label fixes already in git (Jul 14–31 sweep verified as resolved)

---

## Findings Summary

| # | Severity | WCAG | Category | Component |
|---|----------|------|----------|-----------|
| F-1 | 🔴 CRITICAL | 2.4.1 A | Skip Navigation | `+layout.svelte`, `+page.svelte` |
| F-2 | 🔴 CRITICAL | 1.4.3 AA | Color Contrast | `ActionButtonGroup.svelte` (3 color pairs fail) |
| F-3 | 🟠 HIGH | 1.1.1 A | Non-text Content | `+layout.svelte` (tab button emoji) |
| F-4 | 🟠 HIGH | 4.1.2 A | Name/Role/Value | `+layout.svelte` (tablist pattern missing) |
| F-5 | 🟠 HIGH | 2.4.7 AA | Focus Visible | 7 interactive elements across 5 components |
| F-6 | 🟠 HIGH | 1.4.3 AA | Contrast (future-proof) | `LogPanel.svelte`, `AgentDetailPanel.svelte` |
| F-7 | 🟡 MEDIUM | 2.3.3 AAA | Reduced Motion | 5 CSS animations across 5 components |
| F-8 | 🟡 MEDIUM | 2.1.1 A | Keyboard Accessible | `DevJobIndicator.svelte` (drag only) |
| F-9 | 🟡 MEDIUM | 1.4.8 AAA | Visual Presentation | `app.css`, `app.html` (dark-only) |
| F-10 | 🟡 MEDIUM | 2.1.4 A | Char Key Shortcuts | Entire app (no tab-switch shortcuts) |
| F-11 | 🟢 LOW | 1.3.1 A | Info/Relationships | `CronSidebar.svelte` (emoji in title) |
| F-12 | 🟢 LOW | 2.4.4 A | Link Purpose | `Crons.svelte`, `Bills.svelte` (insufficient context) |

---

## 🔴 CRITICAL

### F-1: Missing Skip Navigation Link
**Location**: `src/routes/+layout.svelte` (no skip link present), `src/routes/+page.svelte`  
**WCAG**: 2.4.1 Bypass Blocks (Level A)  
**Problem**: The dashboard has a top header + two tab rows (primary + secondary) + a sidebar before reaching main content. Keyboard users must Tab through 20+ tab buttons and sidebar items on every page load to reach the dashboard content. No "Skip to main content" link exists.  
**Current state**: `<h2 class="sr-only">Noema 🧠</h2>` is present as a heading anchor but no skip link targets it.  
**Fix**: Add a visually-hidden skip link as the first focusable element in `+layout.svelte`:

```svelte
<a href="#main-content" class="skip-link">Skip to main content</a>
```

And add `id="main-content"` to the `<main class="dashboard-main">` in `+page.svelte`.

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 8px;
  background: var(--accent);
  color: #fff;
  padding: 8px 16px;
  z-index: 10000;
  border-radius: 0 0 4px 4px;
}
.skip-link:focus {
  top: 0;
}
```

---

### F-2: Action Button Text Color Contrast Failures
**Location**: `src/lib/components/shared/ActionButtonGroup.svelte` (lines 277-296 CSS)  
**WCAG**: 1.4.3 Contrast Minimum (Level AA) — requires 4.5:1 for normal text  
**Problem**: Three action button color schemes fail WCAG AA contrast:

| Button Style | Foreground | Background | Ratio | Required |
|---|---|---|---|---|
| `.primary` | `#ffffff` | `var(--green)` = `#3fb950` | **2.54:1** | 4.5:1 |
| `.danger` / `.error` | `#ffffff` | `var(--red)` = `#f85149` | **3.35:1** | 4.5:1 |
| `.ok` | `#ffffff` | `var(--accent)` = `#58a6ff` | **2.53:1** | 4.5:1 |

These are small text (~0.78em = ~12.5px) and the contrast is severely insufficient. Users with low vision cannot read button labels like "✅ Resolve", "🔥 Escalate", etc.

**Fix options** (in order of preference):
1. Darken green to `#1a7f37` (contrast 5.01:1 on white) — already in PKG-078 light theme
2. Use dark text on light backgrounds: `color: #000` on green/yellow, dark blue on accent
3. Add text-shadow or increase font-weight to 700+

**Recommended**: Use `#1a7f37` (green), `#cf222e` (red), `#0969da` (accent) — these are PKG-078's light-theme variants which produce >= 4.5:1 on white. Dark theme needs separate variants.

---

## 🟠 HIGH

### F-3: Tab Button Emoji Not Hidden from Screen Readers
**Location**: `src/routes/+layout.svelte` (lines 30-47, PRIMARY_TABS + SECONDARY_TABS)  
**WCAG**: 1.1.1 Non-text Content (Level A)  
**Problem**: Tab button labels are strings like `"🏠 Overview"`, `"🤖 Agents"`, `"⏰ Crons"` with emoji inline in the text. Screen readers will read these as "house Overview", "robot Agents", etc. — redundant and noisy.  
**Context**: The Jul 19-23 aria-hidden sweep fixed ALL section title emoji (6 QA batches) but NEVER touched the tab button labels. They were missed because the sweep targeted `<h3 class="section-title">` elements, not `<button class="tab-btn">` elements.  
**Fix**: Split emoji into separate `<span aria-hidden="true">` elements:

```diff
- { id: "overview", label: "🏠 Overview" },
+ { id: "overview", label: "Overview", emoji: "🏠" },
```

```svelte
<button ...>
- {tab.label}
+ <span aria-hidden="true">{tab.emoji}</span> {tab.label}
</button>
```

---

### F-4: Tab Navigation Missing ARIA Tab Pattern
**Location**: `src/routes/+layout.svelte` (lines 99-126)  
**WCAG**: 4.1.2 Name, Role, Value (Level A)  
**Problem**: Tab navigation uses `<nav>` + `<button>` elements with `aria-current="page"` but does NOT implement the ARIA tab pattern (`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-controls`, arrow key navigation). Users expect Left/Right arrow keys to move between tabs (per ARIA Authoring Practices). Currently, Tab key is the only way to navigate, requiring 20+ Tab presses.  
**Fix**: Add `role="tablist"` to `<nav>`, `role="tab"` to each `<button>`, `aria-selected` instead of `aria-current`, and add `onkeydown` for ArrowLeft/ArrowRight to cycle focus:

```svelte
<nav class="tab-bar" role="tablist" aria-label="Fő navigáció">
  <button
    role="tab"
    aria-selected={activeTab === tab.id}
    aria-controls="tabpanel-{tab.id}"
    onkeydown={(e) => handleTabKeydown(e, index)}
  >
```

Add `role="tabpanel"` + `id` on the content wrapper in `+page.svelte`.

---

### F-5: Missing Focus-Visible Styles on 7 Interactive Elements
**Location**: Multiple components  
**WCAG**: 2.4.7 Focus Visible (Level AA)  
**Problem**: These interactive elements have no `:focus-visible` CSS rule (browser default outline only, which may be suppressed by some browsers/resets):

| Element | File | Line |
|---|---|---|
| Tab buttons (`.tab-btn`) | `+layout.svelte` | ~176 |
| Secondary tab buttons (`.tab-btn-secondary`) | `+layout.svelte` | ~176 |
| Collapse toggle (`.cs-toggle`) | `CronSidebar.svelte` | ~416 |
| Agent link buttons (`.agent-link`) | `Crons.svelte` | ~270 |
| Section header buttons (`.section-header`) | `Noema.svelte` | ~475 |
| Compact toggle (`.compact-toggle`) | `Noema.svelte` | ~337 |
| Filter buttons (`.filter-btn`) | `LogsViewer.svelte` | ~179 |

**Fix**: Add a global `:focus-visible` rule in `app.css`:

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

For elements with custom borders (tab buttons), use border highlight instead:

```css
.tab-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 4px;
}
```

---

### F-6: Hardcoded Dark Backgrounds Break Future Light Mode
**Location**: 
- `src/lib/components/shared/LogPanel.svelte` line 223: `background: #0a0e14`
- `src/lib/components/shared/AgentDetailPanel.svelte` line 302: `background: #0a0e14`

**WCAG**: 1.4.3 Contrast Minimum (Level AA) — forward-looking  
**Problem**: Two components use hardcoded `#0a0e14` (not a CSS variable) for dark code/preformatted backgrounds. When PKG-078 implements light mode, these will remain nearly-black, creating severe contrast issues with light text.  
**Context**: PKG-078 (Color Scheme Toggle, spec phase) will add light theme CSS variables. These hardcoded colors are blockers.  
**Fix**: Add a CSS variable for code backgrounds:

```css
:root {
  --code-bg: #0a0e14;
}
:root[data-theme="light"] {
  --code-bg: #f6f8fa;
}
```

Then use `background: var(--code-bg)` in both locations.

---

## 🟡 MEDIUM

### F-7: CSS Animations Don't Respect prefers-reduced-motion
**Location**: 5 animation keyframes across 5 components  
**WCAG**: 2.3.3 Animation from Interactions (Level AAA)  
**Problem**: These components have continuous CSS animations that can trigger vestibular disorders. None of them check `@media (prefers-reduced-motion: reduce)`:

| Animation | File | Line | Description |
|---|---|---|---|
| `pulse` | `DevPackageRow.svelte` | 287 | Running/queued status pulsing |
| `cs-now-pulse` | `CronSidebar.svelte` | 526 | "NOW" marker pulsing |
| `dji-pulse` | `DevJobIndicator.svelte` | 329 | Active dev job border glow |
| `live-pulse` | `Noema.svelte` | 534 | Live package status pulse |
| `ct-now-pulse` | `CronTimeline.svelte` | 484 | Timeline "NOW" marker pulse |

**Note**: `LoadingSkeleton.svelte` already has `prefers-reduced-motion` support (line 138). Good.  
**Fix**: Add to each component's `<style>`:

```css
@media (prefers-reduced-motion: reduce) {
  .component-class {
    animation: none;
  }
}
```

Or alternatively, add a central rule to `app.css` that already exists — extend it:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

The `app.css` already HAS this (line 115-120) — so these animations ARE actually disabled globally. It just uses an aggressive `*` selector. **Reclassified**: This is partially mitigated by the global rule. Still worth noting that per-component control would be cleaner — the `*` selector disables ALL transitions including useful ones like the sidebar width transition. A better approach: use `animation-name: none` instead of `animation-duration: 0.01ms`.

---

### F-8: Draggable DevJobIndicator Has No Keyboard Alternative
**Location**: `src/lib/components/DevJobIndicator.svelte` (lines 168-240)  
**WCAG**: 2.1.1 Keyboard (Level A)  
**Problem**: The floating Dev Job indicator can be dragged with mouse/touch to reposition it. There is no keyboard-accessible way to reposition the indicator. The drag handlers (`onDragStart`, `onDragMove`, `onDragEnd`) are bound to mouse/touch events only.  
**Fix**: Add arrow key support on the grip button with visible feedback:

```svelte
onkeydown={(e) => {
  const step = 10;
  if (e.key === 'ArrowLeft') setPosition((posLeft ?? DEFAULT_RIGHT) - step, posTop ?? DEFAULT_TOP);
  if (e.key === 'ArrowRight') setPosition((posLeft ?? DEFAULT_RIGHT) + step, posTop ?? DEFAULT_TOP);
  if (e.key === 'ArrowUp') setPosition(posLeft ?? DEFAULT_RIGHT, (posTop ?? DEFAULT_TOP) - step);
  if (e.key === 'ArrowDown') setPosition(posLeft ?? DEFAULT_RIGHT, (posTop ?? DEFAULT_TOP) + step);
}}
```

---

### F-9: No Light Mode / Color Scheme Toggle
**Location**: `src/app.html` line 7, `src/app.css` lines 1-19  
**WCAG**: 1.4.8 Visual Presentation (Level AAA)  
**Problem**: The dashboard forces dark mode via `<meta name="color-scheme" content="dark">` and only defines dark theme CSS variables in `:root`. There is no light theme, no OS preference detection, and no manual toggle.  
**Status**: PKG-078 (Color Scheme Toggle spec) exists — spec-only, not implemented.  
**Fix**: Implement PKG-078: add light theme CSS variables, change meta to `"dark light"`, add ThemeToggle component with localStorage persistence.

---

### F-10: No Keyboard Shortcuts for Tab Switching
**Location**: `src/routes/+layout.svelte` (entire tab navigation)  
**WCAG**: 2.1.4 Character Key Shortcuts (Level A)  
**Problem**: The dashboard has 8 primary tabs and 8 secondary tabs but no keyboard shortcuts to quickly jump between them. Power users and keyboard-only users must Tab-navigate through the entire tab bar.  
**Fix**: Add Ctrl+1-8 shortcuts for primary tabs (matching common dashboard patterns like GitHub, Grafana):

```typescript
function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const num = parseInt(e.key);
    if (num >= 1 && num <= PRIMARY_TABS.length) {
      e.preventDefault();
      activeTab = PRIMARY_TABS[num - 1].id;
    }
  }
}
```

Add to `onMount` in `+layout.svelte` with `window.addEventListener('keydown', handleGlobalKeydown)`.

---

## 🟢 LOW

### F-11: CronSidebar Title Emoji Not aria-hidden
**Location**: `src/lib/components/layout/CronSidebar.svelte` line 197  
**WCAG**: 1.3.1 Info and Relationships (Level A)  
**Problem**: `<span class="cs-title">⏰ Cronok</span>` has a clock emoji inline in text — screen reader reads "alarm clock Cronok".  
**Fix**: Split: `<span class="cs-title"><span aria-hidden="true">⏰</span> Cronok</span>`

---

### F-12: Action Buttons with Insufficient Context for Screen Readers
**Location**: 
- `src/lib/components/tabs/Crons.svelte` line 105: Agent link button reads "View agent {agentId}" but not the cron context
- `src/lib/components/tabs/Bills.svelte` line 174: "Open link for {name}" with no context about what is being opened

**WCAG**: 2.4.4 Link Purpose (Level A)  
**Problem**: Some action aria-labels don't include enough context for screen reader users who navigate by links/buttons.  
**Fix**: Expand aria-labels with contextual information:

```svelte
aria-label="View agent {cron.agentId} from cron {cron.name}"
aria-label="Open billing link for {row.name} — {row.amount}"
```

---

## Responsive Layout Audit

✅ **Pass**: Two-tier breakpoint system (768px tablet, 599px mobile)  
✅ **Pass**: All tables use `overflow-x: auto` wrapper — no horizontal scrollbar clipping  
✅ **Pass**: Grid layouts collapse (`4→2→1` columns)  
✅ **Pass**: CronSidebar hides on mobile, shows in a dedicated mobile-only tab  
✅ **Pass**: AgentDetailPanel goes full-width on mobile  
⚠️ **Minor**: Tab bar horizontal scroll uses `scrollbar-width: none` — scrollable region has no visible indicator for sighted users that more tabs exist. Consider adding a gradient fade indicator or scroll buttons at ends.

---

## Focus Management Audit

✅ **Pass**: AgentDetailPanel focus trap (PKG-061) — Esc to close, Tab wraps  
✅ **Pass**: AgentDetailPanel restores focus to trigger element on close  
✅ **Pass**: Noema search input clears on Escape (Jul 24 fix)  
✅ **Pass**: DevPackageRow has `role="button"` + `tabindex` + keyboard handler  
✅ **Pass**: Agent cards in Overview have `role="button"` + `tabindex` + Space/Enter handler  
✅ **Pass**: Agents table rows have `role="button"` + `tabindex` + keyboard handler  
⚠️ **See F-5**: Multiple elements lack visible `:focus-visible` styles  

---

## Screen Reader Audit

✅ **Pass**: All section title emoji have `aria-hidden` (Jul 19-23 sweep COMPLETE)  
✅ **Pass**: Inline emoji have `aria-hidden` (⚠ stale, 🛡️, agent emoji — Jul 24 sweep)  
✅ **Pass**: Status dots have `role="img"` + `aria-label` (Jul 24 fix)  
✅ **Pass**: Filter buttons have `aria-pressed` (Jul 24 fix)  
✅ **Pass**: CronSidebar toggle has `aria-expanded`  
✅ **Pass**: Package section headers have `aria-expanded`  
✅ **Pass**: KanbanBoard columns have `role="region"` + `aria-labelledby`  
✅ **Pass**: LogsViewer has `role="log"` + `aria-live="polite"`  
✅ **Pass**: ProcessorTimer has `role="status"` + `aria-live="off"` (SR flood prevention — Jul 24)  
✅ **Pass**: Noema search has `aria-describedby` linking to stats summary (Jul 24 fix)  
✅ **Pass**: CronTimeline rows have `sr-only` schedule text (Jul 24 fix)  
⚠️ **See F-3**: Tab button emoji NOT hidden — PRIMARY gap  
⚠️ **See F-11**: CronSidebar title emoji NOT hidden  

---

## Keyboard Navigation Audit

✅ **Pass**: All interactive elements are native `<button>`, `<a>`, `<select>`, or have `role + tabindex`  
✅ **Pass**: Tab order is logical (header → primary tabs → secondary tabs → content → sidebar)  
✅ **Pass**: AgentDetailPanel Escape to close  
✅ **Pass**: Noema search Escape to clear  
✅ **Pass**: DevPackageRow Enter/Space to expand details  
⚠️ **See F-4**: No arrow key navigation in tab bar (ARIA tab pattern missing)  
⚠️ **See F-1**: No skip link — 20+ Tab presses to reach content  
⚠️ **See F-10**: No keyboard shortcuts for power users  

---

## Verification Notes

- **Prior QA runs verified**: 11 QA runs (Jul 18 – Jul 31) from git log with ~50 aria fixes. All verified as applied and still present in current source.
- **PKG-045/PKG-046 check**: Neither exists in git history, specs, or dev packages. Both gaps are flagged.
- **PKG-078**: Exists as spec (not implemented). Dark mode gap is flagged, referencing PKG-078.
- **Color contrast**: Python script verified with WCAG 2.1 relative luminance formula.
- **Animation scan**: All 5 animation locations confirmed via grep — none have local `prefers-reduced-motion` guards. Global `*` rule in `app.css` partially mitigates.
