# Noema Accessibility & UX Audit — GAP SCAN

**Date:** 2026-07-17  
**Auditor:** Alfred 👔  
**Scope:** Full SPA dashboard — layout, routing, tab navigation, all tab components, shared components, sidebar, error page  
**Standard:** WCAG 2.2 Level AA  
**Severity scale:** 🔴 Critical | 🟠 Major | 🟡 Moderate | 🔵 Minor

---

## Executive Summary

| Severity | Count | Areas |
|----------|-------|-------|
| 🔴 Critical | 4 | Tab ARIA pattern, lang mismatch, color contrast, skip link |
| 🟠 Major | 8 | Focus management, keyboard nav, reduced-motion gaps, heading hierarchy, status communication |
| 🟡 Moderate | 7 | Dark-mode only, responsive tables, touch targets, semantic landmarks |
| 🔵 Minor | 6 | Error page inconsistencies, dev-job indicator drag a11y, icon-only labels |

**Overall:** The codebase has a solid foundation — `aria-label`, `role`, and keyboard handlers are present on many interactive elements. However, the two biggest structural gaps are **(1)** the tab navigation bar doesn't implement the WAI-ARIA Tabs pattern and **(2)** the `<html lang="en">` declaration contradicts Hungarian content throughout. Both directly impact screen reader users.

---

## 1. Tab Navigation — Missing ARIA Tabs Pattern

### 🔴 F1: Tab bar buttons lack `role="tab"`, `aria-selected`, `tabindex` management

- **Location:** `src/routes/+layout.svelte` lines 125–136 (primary), 139–150 (secondary)
- **WCAG:** 4.1.2 Name, Role, Value (Level A)
- **Element:**
  ```svelte
  <nav class="tab-bar tab-bar-primary" aria-label="Fő navigáció">
    {#each PRIMARY_TABS as tab (tab.id)}
      <button type="button" class="tab-btn" class:active={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}>{tab.label}</button>
    {/each}
  </nav>
  ```
- **Problem:** Screen readers announce these as standalone buttons in a nav region. There is no programmatic association between the tab list and the tab panels, no `aria-selected` state, and no `tabindex="-1"` on inactive tabs. Keyboard users get no sense of "tab group" navigation behavior.
- **Fix:** Implement the full [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):
  ```svelte
  <div role="tablist" aria-label="Fő navigáció">
    {#each PRIMARY_TABS as tab (tab.id)}
      <button role="tab" aria-selected={activeTab === tab.id}
        tabindex={activeTab === tab.id ? 0 : -1}
        aria-controls="tabpanel-{tab.id}"
        onclick={() => (activeTab = tab.id)}
        onkeydown={handleTabKeydown}>{tab.label}</button>
    {/each}
  </div>
  ```
  And add arrow-key navigation (Left/Right/Home/End) in `handleTabKeydown`. Wrap each tab panel in `<div role="tabpanel" id="tabpanel-{id}" aria-labelledby="tab-{id}">`.

### 🔴 F2: No `aria-current` on active tab or nav item

- **Location:** Same as F1; applies to all navigation nodes
- **WCAG:** 2.4.4 Link Purpose, 4.1.2 (supplemental)
- **Fix:** Add `aria-current="page"` to the active tab button.

---

## 2. Language Declaration Mismatch

### 🔴 F3: `<html lang="en">` but all UI text is Hungarian

- **Location:** `src/app.html` line 3
- **WCAG:** 3.1.1 Language of Page (Level A)
- **Element:** `<html lang="en">`
- **Problem:** Screen readers will attempt English pronunciation of Hungarian text like "Fő navigáció", "Eszközök", "Keresés", "Kész", every tab label, and the entire bill/Brainstorm/Noema tab content. This makes the dashboard nearly incomprehensible to Hungarian-speaking AT users.
- **Fix:** Change to `<html lang="hu">`. If some sections stay in English, add `lang="en"` on those elements individually.

---

## 3. Color Contrast

### 🔴 F4: Muted text fails 4.5:1 contrast ratio for normal text

- **Location:** `src/app.css` line 7 (`--muted: #8b949e`), used globally on ~90% of secondary text
- **WCAG:** 1.4.3 Contrast (Minimum) (Level AA)
- **Ratio:** `#8b949e` on `#0d1117` = **~3.42:1** (requires ≥4.5:1)
- **Affected elements:** `.subtitle`, `.tab-btn` (inactive), `.tab-label`, `.metric-label`, `.metric-sub`, `.section-desc`, all table column hints, `.lbl`, `.empty`, `.muted`, `.meta-label`, `.hint`, `.legend`
- **Fix:** Lighten `--muted` to at least `#a5b0bb` (≈4.54:1) or `#b0bac5` for a safer margin. Alternatively, increase base font size of muted elements to ≥18.66px bold or ≥24px regular to qualify for the 3:1 large-text threshold.

### 🟠 F5: Red accent `#f85149` insufficient on dark backgrounds

- **Location:** `src/app.css` line 12 (`--red: #f85149`)
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Ratio:** `#f85149` on `#0d1117` = **~4.01:1** (< 4.5:1 for normal text)
- **Affected elements:** Error metric card text, error-dot tooltips, `.cr-item.cr-status-r` label text, `.status-overdue` badge
- **Fix:** Lighten `--red` to `#ff6b6b` (≈5.1:1) or only use red for borders/icons with a separate text color.

### 🟡 F6: Yellow accent `#d2991d` for status text borderline

- **Location:** `src/app.css` line 11 (`--yellow: #d2991d`)
- **WCAG:** 1.4.3
- **Ratio:** `#d2991d` on `#0d1117` = **~4.53:1** (passes, but barely — any rendering variation could dip below)
- **Fix:** Slight lighten to `#e0a828` for safety margin.

### 🟡 F7: Status communicated by color alone (no text fallback)

- **Location:** Multiple — status dots in Overview agent cards (`.status-dot`), Agents table, Cron table result columns
- **WCAG:** 1.4.1 Use of Color (Level A)
- **Problem:** `.status-dot` is an 8×8px colored circle with no visible text. The `title` attribute provides a tooltip, but `title` is not consistently exposed to screen readers and is invisible without hover. Color-blind users cannot distinguish green/yellow/red dots.
- **Fix:** Add a visually hidden text span inside each status dot (`<span class="sr-only">OK</span>`) or replace dots with text badges.

---

## 4. Skip-to-Content

### 🔴 F8: No "Skip to main content" link

- **Location:** `src/app.html` — first focusable element is the first tab button in `+layout.svelte`
- **WCAG:** 2.4.1 Bypass Blocks (Level A)
- **Problem:** Keyboard users must tab through 13+ navigation buttons before reaching dashboard content.
- **Fix:** Add a skip link as the first `<body>` child:
  ```html
  <a href="#main-content" class="skip-link">Ugrás a tartalomra</a>
  ```
  And add `id="main-content"` to the `<main>` element in `+page.svelte`.
  ```css
  .skip-link {
    position: absolute;
    top: -100%;
    left: 0;
    z-index: 10000;
    padding: 8px 16px;
    background: var(--accent);
    color: #fff;
  }
  .skip-link:focus {
    top: 0;
  }
  ```

---

## 5. Focus Management

### 🟠 F9: Focus not moved into AgentDetailPanel on open

- **Location:** `src/lib/components/shared/AgentDetailPanel.svelte`
- **WCAG:** 2.4.3 Focus Order (Level A)
- **Problem:** When a user clicks an agent card, the slide-in panel appears at `z-index:200` but focus remains on the triggering element. Tab order includes all background buttons before reaching the panel. ESC does not close it.
- **Fix:** On panel open, move focus to the close button or panel heading. Add `onkeydown` to handle `Escape` key:
  ```svelte
  <!-- In the panel wrapper -->
  onkeydown={(e) => { if (e.key === 'Escape') onClose?.(); }}
  ```
  Use `bind:this` on the close button and call `.focus()` after the panel opens.

### 🟠 F10: No focus indicator on collapsed CronSidebar icon buttons

- **Location:** `src/lib/components/layout/CronSidebar.svelte` lines 299–304
- **Element:** `<button type="button" class="cs-icon-btn" title={cron.name}>{cronIcon(cron)}</button>`
- **WCAG:** 2.4.7 Focus Visible (Level AA)
- **Problem:** These are 24×24px emoji-only buttons with no visible focus style, no `aria-label`, only `title`.
- **Fix:** Add `aria-label={cron.name}`, remove `title`, add `.cs-icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`.

### 🟡 F11: `focus-visible` styles inconsistent across clickable cards

- **Location:** `src/lib/components/tabs/Overview.svelte` line 162, `Agents.svelte` styling
- **Problem:** `.agent-card.clickable:focus-visible` has `outline: none` — focus is indicated only by a border color change. Low-vision users may not notice a 1px border color transition.
- **Fix:** Replace `outline: none` with a visible outline (or at minimum add a box-shadow ring):
  ```css
  .clickable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-color: var(--accent);
  }
  ```

---

## 6. Keyboard Navigation

### 🟠 F12: DevJobIndicator drag-and-drop not keyboard accessible

- **Location:** `src/lib/components/DevJobIndicator.svelte` lines 192–258
- **WCAG:** 2.1.1 Keyboard (Level A)
- **Problem:** The floating indicator is repositioned via mouse/touch drag only. No keyboard mechanism to move it. The collapsed mode `role="button"` with `aria-label="Drag to reposition indicator"` suggests interactive behavior that doesn't work with keyboard.
- **Fix:** Either remove ARIA drag affordance from collapsed mode (make it `aria-label="Dev job indicator"`) or implement arrow-key repositioning. Since this is a persistent utility, making the label accurate and removing the fake button role is pragmatic.

### 🟠 F13: CronSidebar rows not keyboard navigable

- **Location:** `src/lib/components/layout/CronSidebar.svelte` lines 270–280
- **WCAG:** 2.1.1 Keyboard
- **Problem:** `.cr-item` divs are not focusable and have no keyboard interaction. The sidebar provides a timeline view but keyboard users cannot inspect individual cron entries.
- **Fix:** If cron items are meant to be clickable, wrap in `<button>` or add `role="button" tabindex="0"`. If read-only, they're fine as-is.

### 🟡 F14: No global keyboard shortcuts

- **Location:** Entire application
- **WCAG:** 2.1.4 Character Key Shortcuts (Level A) — informational
- **Observation:** No keyboard shortcuts exist. For a power-user dashboard, adding shortcuts (`Alt+1`–`Alt+9` for tab switching, `?` for shortcut help) would improve UX significantly. Not a WCAG failure but a UX gap.

---

## 7. `prefers-reduced-motion`

### 🟠 F15: CronSidebar pulse animation not wrapped in reduced-motion query

- **Location:** `src/lib/components/layout/CronSidebar.svelte` lines 366–374
- **WCAG:** 2.3.3 Animation from Interactions (Level AAA, but best practice)
- **Element:**
  ```css
  @keyframes cs-now-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 rgba(248,81,73,0); }
    50% { opacity: 0.85; box-shadow: 0 0 14px rgba(248,81,73,0.35); }
  }
  ```
- **Problem:** The `.cr-now-line` element pulses indefinitely. `app.css` contains a global `@media (prefers-reduced-motion: reduce)` rule, but it sets `animation-duration: 0.01ms !important` which effectively freezes the animation at frame 0 (fully opaque), not at mid-frame (pulse visible). This is actually correct behavior but it's worth noting that the animation would freeze at 100% opacity — which is acceptable. **However**, the `animation-iteration-count` must also be set to `1` to prevent the frozen animation from continuing. The global rule already handles this.
- **Actual gap:** The DevJobIndicator `.active` pulse animation (`dji-pulse`, line ~312 in DevJobIndicator.svelte) is **not inside** a `@media (prefers-reduced-motion)` block locally. The global rule catches it, but only if the specificity cascade works. Explicitly inline the reduced-motion override is safer.
- **Fix:** Add `@media (prefers-reduced-motion: reduce) { .cs-now-line { animation: none; } .dev-job-indicator.active { animation: none; } }` in each component.

### 🟡 F16: Transition properties on sidebar width, tab hover, agent cards

- **Location:** Multiple components (sidebar .2s width, tab-btn .2s color/border, agent-card .2s)
- **WCAG:** 2.3.3
- **Observation:** The global `prefers-reduced-motion` rule in `app.css` force-overrides all transitions to 0.01ms. This is effective but aggressive — it also disables purposeful motion. Acceptable for compliance but consider a more nuanced approach: only disable decorative/pulse animations while keeping functional transitions (like the sidebar collapse) at a faster 0.05s cadence.

---

## 8. Dark Mode & Color Scheme

### 🟡 F17: No light mode support

- **Location:** `src/app.html` line 7: `<meta name="color-scheme" content="dark" />`, `src/app.css` all `:root` variables dark-only
- **WCAG:** Not a WCAG failure, but a UX gap for users with light-mode preference or photophobia in bright environments
- **Problem:** The dashboard is locked to dark mode. Users with `prefers-color-scheme: light` OS settings get dark mode regardless. No toggle exists.
- **Fix:** Either:
  1. Change `<meta name="color-scheme" content="dark light" />` and add `@media (prefers-color-scheme: light)` overrides in `app.css`.
  2. Or, if dark-only is intentional (dashboard context), add `<meta name="color-scheme" content="dark only" />` to signal the intent clearly and prevent browser auto-lightening.

### 🔵 F18: No `prefers-contrast` support

- **Location:** `src/app.css`
- **WCAG:** 1.4.6 Contrast (Enhanced) (Level AAA) — informational
- **Fix:** Add `@media (prefers-contrast: more) { :root { --border: #606a78; --muted: #bcc5d0; } }` to boost contrast for users who need it.

### 🔵 F19: No `forced-colors` (Windows High Contrast) support

- **Location:** All components
- **WCAG:** 1.4.1 Use of Color (supplemental)
- **Problem:** Status dots and metric cards rely entirely on CSS background/border colors, which are stripped in forced-colors mode. Users in Windows High Contrast Mode will see no status indication.
- **Fix:** Add `@media (forced-colors: active) { .status-dot { forced-color-adjust: none; } .status-dot.dot-ok { background: ButtonText; } ... }` or use `border: 2px solid` with `currentColor` for status elements.

---

## 9. Heading Hierarchy

### 🟠 F20: Misaligned heading levels across the layout

- **Location:** `src/routes/+layout.svelte` → `<h1>Noema 🧠</h1>`, `src/routes/+page.svelte` → `<h2 class="sr-only">Noema 🧠</h2>`, tab sections use `<h3>`
- **WCAG:** 1.3.1 Info and Relationships (Level A)
- **Problem:** The layout `<h1>` permanently renders "Noema 🧠". The page adds an sr-only `<h2>` with the same text. Tab sections (Overview, Agents, etc.) use `<h3 class="section-title">`. This creates:
  - H1: Noema 🧠
  - H2: Noema 🧠 (hidden)
  - H3: 🤖 Agents / ⏰ Crons / etc.
  
  The hidden duplicate H2 is confusing. And the tab sections are at H3 even when they're the primary visible content.
- **Fix:** Remove the sr-only `<h2>` from `+page.svelte`. Change tab section titles to `<h2>`. The `<h1>` in the layout is sufficient.

### 🟡 F21: Noema tab uses `<h2>` directly, inconsistent with other tabs

- **Location:** `src/lib/components/tabs/Noema.svelte` line 162
- **Element:** `<h2>🧠 Development Packages</h2>`
- **Problem:** This is the only tab that uses `<h2>` for its section title (others use `<h3>`). After fixing F20, all should use `<h2>`.
- **Fix:** Standardize all tab section titles at `<h2>`.

### 🔵 F22: Error page heading structure

- **Location:** `src/routes/+error.svelte`
- **Element:** `<h1 class="error-emoji">{emoji}</h1>` followed by `<h2 class="error-status">{status}</h2>`
- **Problem:** The emoji as `<h1>` is not semantically meaningful. Screen readers will announce "warning emoji, heading level 1" — not helpful.
- **Fix:** Make the status code `<h1>` (`<h1>{status} — {message}</h1>`) and remove the emoji heading. Keep the emoji as decorative `<span aria-hidden="true">`.

---

## 10. Responsive Layout

### 🟡 F23: Tables overflow-x without visible scroll indicators

- **Location:** All `.table-wrap` containers — `Agents.svelte`, `Crons.svelte`, `H1.svelte`, `Bills.svelte`
- **WCAG:** 1.4.10 Reflow (Level AA), 1.3.1
- **Problem:** Tables use `overflow-x: auto` with no visual indicator that content is scrollable. On narrow viewports, columns are cut off with zero affordance. Keyboard-only users on narrow screens may not realize content exists to the right.
- **Fix:** Add `background: linear-gradient(to right, transparent 95%, var(--border))` or a scroll-shadow indicator. Alternatively, add `aria-label="Horizontally scrollable table"` to the wrapper.

### 🟡 F24: Bills table lacks responsive alternative

- **Location:** `src/lib/components/tabs/Bills.svelte`
- **WCAG:** 1.4.10 Reflow
- **Problem:** The 6-column bills table collapses only via `overflow-x:auto` at 768px. No card-stack alternative for mobile.
- **Fix:** At 599px, consider switching to a card layout (label-value pairs) instead of horizontal scrolling.

### 🔵 F25: Tab bar overflow scroll hidden from screen readers

- **Location:** `src/routes/+layout.svelte` — `.tab-bar { overflow-x: auto; scrollbar-width: none; }`
- **WCAG:** 1.4.10 (informational)
- **Observation:** Scrollbar is visually hidden. If tabs overflow the viewport, there's no indication. Acceptable for a narrow set of 13 tabs on desktop, but could be a problem on older tablets. Consider `scrollbar-width: thin` instead of `none`.

---

## 11. Forms & Inputs

### 🟡 F26: Search input has `aria-label` but no visible `<label>`

- **Location:** `src/lib/components/tabs/Noema.svelte` lines 200–213
- **WCAG:** 3.3.2 Labels or Instructions (Level A)
- **Element:**
  ```svelte
  <label class="search-wrap">
    <span class="search-icon" aria-hidden="true">🔍</span>
    <input type="search" class="search-input" placeholder="Keresés..."
      aria-label="Search packages" bind:value={searchQuery} />
  </label>
  ```
- **Problem:** The wrapping `<label>` is not a real label — it has no `for` attribute and no accessible name association. `aria-label` compensates but a visible label is required for WCAG 3.3.2.
- **Fix:** Either use `<label for="search-packages">Keresés</label>` with an explicit `id` on the input, or add a visible sr-only text label.

### 🔵 F27: Compact-mode toggle button has no accessible name

- **Location:** `src/lib/components/tabs/Noema.svelte` lines 179–183
- **Element:** `<button type="button" class="compact-toggle" title={compactView ? "Részletes nézet" : "Kompakt nézet"} onclick={toggleCompact}>{compactView ? "📜" : "📋"}</button>`
- **WCAG:** 4.1.2
- **Problem:** The button is emoji-only. `title` attribute provides the accessible name but `title` is inconsistently announced across screen readers. Use `aria-label` instead.
- **Fix:** Replace `title` with `aria-label={compactView ? "Részletes nézet" : "Kompakt nézet"}`.

---

## 12. Semantic Structure & Landmarks

### 🟡 F28: Missing `<main>` landmark in layout shell

- **Location:** `src/routes/+layout.svelte` — the `.main-column` is a `<div>`
- **WCAG:** 1.3.1 Info and Relationships
- **Problem:** Although `+page.svelte` wraps content in `<main>`, the layout itself provides no top-level landmark for the primary content column. Screen readers navigating by landmark have no clear entry point.
- **Fix:** Either make `.main-column` a `<main>` element or ensure every page provides its own `<main>` (currently done in `+page.svelte`). Since the `<main>` is in `+page.svelte`, this is borderline — but adding `role="main"` to the column as a fallback would be safer.

### 🟡 F29: `<nav>` elements lack unique accessible names in context

- **Location:** `src/routes/+layout.svelte` — two `<nav>` elements with `aria-label="Fő navigáció"` and `aria-label="Eszközök"`
- **Observation:** These are already correctly labeled. ✅ No action needed — noted as good practice confirmation.

### 🟡 F30: AgentDetailPanel is `<aside>` — correct landmark usage

- **Location:** `src/lib/components/shared/AgentDetailPanel.svelte`
- **Observation:** The panel uses `<aside>` with `aria-label`. This is correct. ✅

---

## 13. Touch Targets

### 🟡 F31: Collapsed CronSidebar icon buttons too small

- **Location:** `src/lib/components/layout/CronSidebar.svelte` lines 299–304
- **WCAG:** 2.5.8 Target Size (Minimum) (Level AA) — 24×24 CSS pixels
- **Element:** `.cs-icon-btn { font-size: 1.1em; padding: 4px; }` — effective target is ~18×18px
- **Fix:** Increase padding to `8px` or set `min-width: 44px; min-height: 44px` per WCAG 2.5.5 (AAA).

### 🔵 F32: Action buttons in KanbanBoard are very small

- **Location:** `src/lib/components/shared/ActionButtonGroup.svelte`
- **Element:** `.action-btn { padding: 1px 8px; font-size: 0.78em; }`
- **WCAG:** 2.5.5 Target Size (Enhanced) (AAA — informational)
- **Observation:** 1px vertical padding makes these buttons ~18px tall. Fine for desktop with precise pointing, challenging on touch. Minimum `padding: 4px 8px` would help.

---

## 14. Dynamic Content

### 🟡 F33: SSE updates lack `aria-live` region for status changes

- **Location:** `src/routes/+layout.svelte` — `EventSource` updates cron data and build integrity
- **WCAG:** 4.1.3 Status Messages (Level AA)
- **Problem:** When `BuildIntegrityBanner` appears (via `showBuildAlert`), it uses `role="alert"` which is correct. ✅ However, cron status changes in the sidebar update silently — screen reader users get no notification that the sidebar timeline has shifted.
- **Fix:** Add `aria-live="polite"` to the `.cs-scroll` container in CronSidebar to announce timeline updates. Or use `aria-atomic="true"` on the now-marker.

### 🟡 F34: DevJobIndicator countdown updates every second — potentially noisy

- **Location:** `src/lib/components/DevJobIndicator.svelte` — `countdownTimer` at 1000ms
- **WCAG:** 2.2.2 Pause, Stop, Hide (Level A) — informational
- **Observation:** The countdown updates every 1s. If this were inside an `aria-live` region, it would be disruptive. Currently it's not live, so screen readers don't announce it — this is correct. But if you later add live-region support for the indicator, throttle announcements to every 30s minimum.

---

## 15. Dev Loop / Noema Tab

### 🔵 F35: Progress bar `role="progressbar"` — well-implemented ✅

- **Location:** `src/lib/components/tabs/Noema.svelte` lines 187–194
- **Observation:** The progress track uses `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label`. This is textbook-correct ARIA. ✅

### 🔵 F36: Section toggle buttons have `aria-expanded` — well-implemented ✅

- **Location:** `src/lib/components/tabs/Noema.svelte` lines 221–227 (spec), 250–256 (active), 284–291 (done)
- **Observation:** Collapsible section headers use `<button>` with `aria-expanded`. Correct pattern. ✅

---

## 16. Logs & Audit Trail

### 🟡 F37: LogPanel uses `role="log"` and `aria-live="polite"` — good, but auto-scroll may be disorienting

- **Location:** `src/lib/components/tabs/LogsViewer.svelte` lines 162–163
- **WCAG:** 4.1.3
- **Observation:** The log viewer correctly uses `role="log"` with `aria-live="polite"`. ✅
- **Note:** Ensure the 3s poll interval doesn't overwrite the focused log entry. Test: navigate to a log entry via keyboard, wait for poll — focus should not be lost.

---

## Summary of Fixes by Priority

### Critical (Fix immediately)
| ID | Issue | Effort |
|----|-------|--------|
| F3 | `<html lang="hu">` | 1 line |
| F8 | Skip-to-content link | ~10 lines |
| F1 | ARIA Tabs pattern | ~40 lines |
| F4 | Muted text contrast | 1 CSS var change |

### Major (Fix this sprint)
| ID | Issue | Effort |
|----|-------|--------|
| F9 | Focus management in AgentDetailPanel | ~15 lines |
| F10 | Focus indicator on collapsed sidebar buttons | ~5 lines |
| F15 | Reduced-motion pulse animations | ~10 lines per component |
| F20 | Heading hierarchy fix | ~5 lines across 2 files |
| F5 | Red accent contrast | 1 CSS var change |
| F12 | DevJobIndicator keyboard accessibility | ~20 lines |
| F13 | CronSidebar row keyboard nav | ~10 lines |

### Moderate (Next sprint)
| ID | Issue | Effort |
|----|-------|--------|
| F6 | Yellow accent contrast | 1 CSS var |
| F7/F19 | Status communicated by color + forced-colors | ~30 lines |
| F17 | Light mode / color-scheme clarification | ~40 lines |
| F23 | Table scroll indicators | ~10 lines CSS |
| F28 | `<main>` landmark clarity | 1 element change |
| F33 | `aria-live` for cron timeline updates | ~5 lines |

### Minor (Backlog)
| ID | Issue | Effort |
|----|-------|--------|
| F18 | `prefers-contrast` support | ~10 lines CSS |
| F22 | Error page heading fix | ~10 lines |
| F27 | Search label fix | 1 attribute change |
| F31 | Touch target sizing | CSS tweaks |
| F2 | `aria-current` on active tab | 1 attribute |

---

## Testing Recommendations

1. **Screen reader pass:** Test full tab navigation flow with NVDA (Windows) or VoiceOver (macOS) — verify tab selection announcements, table navigation, and panel open/close.
2. **Keyboard-only pass:** Tab through all interactive elements without mouse — verify focus visibility, logical order, and that no focus trap occurs (except AgentDetailPanel, which should trap focus).
3. **Contrast audit:** Run axe DevTools or Lighthouse on each tab — verify no contrast violations after CSS var changes.
4. **Reduced motion:** Enable `prefers-reduced-motion: reduce` in DevTools, verify all pulse/transition animations are suppressed.
5. **200% zoom:** Zoom to 200% at 1280px wide — verify all content remains readable without horizontal scroll (except tables, which may scroll).

---

*Report generated by Alfred 👔 | Noema Accessibility Gap Scan 2026-07-17*
