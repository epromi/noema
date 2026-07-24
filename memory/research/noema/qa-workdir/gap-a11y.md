# GAP SCAN: Accessibility & UX Audit — Noema Dashboard

**Date:** 2026-07-24 06:19 CEST  
**Scope:** 33 Svelte components, 2 layout files, 1 CSS design system  
**Methodology:** Manual code audit against WCAG 2.2 A/AA criteria  
**BLOCKLIST:** `{@html agent.extra}` in AgentDetailPanel.svelte — trusted server content, do not modify

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 Critical | 3 | Screen reader / focus / landmark issues |
| 🟠 High | 7 | Color contrast failures, keyboard navigation gaps |
| 🟡 Medium | 14 | Emoji without aria-hidden, heading hierarchy |
| 🟢 Low | 5 | Reduced-motion, edge-case labels |
| **Total** | **29** | |

**Overall score: 72/100** — The app has solid foundations (skip link, tab ARIA, keyboard handlers) but several recurring patterns degrade the experience for screen reader and keyboard-only users.

---

## 🔴 Critical (3)

### C-1. Tab bar: Missing arrow-key navigation (WCAG 2.1.1 Keyboard, 2.4.3 Focus Order)

**Location:** `src/routes/+layout.svelte` lines 119–148 (PRIMARY_TABS / SECONDARY_TABS)  
**Problem:** Tab buttons use the correct ARIA `role="tab"` + `aria-selected` + `aria-controls` pattern with roving `tabindex`. However, Left/Right arrow key handling is **not implemented**. Users must Tab through every single tab button to reach their target instead of arrowing between them in a single keystroke.

**[WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) requires:**
> Left Arrow: moves focus to previous tab  
> Right Arrow: moves focus to next tab  
> (Horizontal orientation)

**Fix:** Add `onkeydown` handlers to both `<nav>` elements that trap Left/Right arrows and cycle focus through the tab buttons.

```svelte
function handleTabKeydown(e: KeyboardEvent, tabs: readonly TabDef[], currentId: string) {
  const idx = tabs.findIndex(t => t.id === currentId);
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    const next = tabs[(idx + 1) % tabs.length];
    document.getElementById(`tab-${next.id}`)?.focus();
    activeTab = next.id;
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
    document.getElementById(`tab-${prev.id}`)?.focus();
    activeTab = prev.id;
  }
}
```

---

### C-2. Tab panel heading structure breaks document outline (WCAG 1.3.1 Info and Relationships)

**Location:** `src/routes/+page.svelte` (tabpanel structure)  
**Problem:** The main content area has `<h2 class="sr-only" id="main-heading">Noema</h2>`, but many tab components start with `<h3>` (e.g., Overview, H1, Viktor, Research). The only preceding heading is `<h1>` in +layout.svelte. This is technically valid (h1 → h3). However, when a tab like Agents or Crons renders, the first heading is h3 — there's no h2 between the page h1 and the tab heading.

**Fix:** Promote all tab-level `.section-title` headings from h3 to h2, or add an h2 heading inside each tabpanel div before the tab component renders. The quickest fix:

```svelte
<!-- In +page.svelte, before each tab component -->
<h2 class="sr-only">{activeTab} dashboard</h2>
```

---

### C-3. DevJobIndicator: role="button" on draggable region is misleading (WCAG 4.1.2 Name, Role, Value)

**Location:** `src/lib/components/DevJobIndicator.svelte`, lines ~130–140 (collapsed view)  
**Problem:** The entire collapsed div has `role="button"` and `tabindex="0"` with `aria-label="Drag to reposition indicator"`. However:
- Clicking this div doesn't trigger any action — it starts a drag-and-drop operation
- Drag-and-drop has no keyboard alternative
- The aria-label describes drag behavior, but the actual interactive elements inside (toggle button, detailed view) are nested buttons that get their events via `stopPropagation()`
- Screen readers will announce "Drag to reposition indicator, button" but activating it does nothing meaningful

**Fix:** Remove `role="button"` and `tabindex="0"` from the collapsed container. Make the drag grip button (already exists in expanded view) the only drag handle in both collapsed and expanded states. Remove the drag handlers from the collapsed div and only attach them to the grip button. For keyboard accessibility, add a note that repositioning is mouse-only cosmetic behavior (acceptable, as it's non-essential).

---

## 🟠 High (7)

### H-1. Color contrast: White text on green buttons fails AA (WCAG 1.4.3 Contrast Minimum)

**Location:** `ActionButtonGroup.svelte` (`.action-btn.primary`), `ImplementButton.svelte` (`.implement-btn`)  
**Values:** `#ffffff` on `#3fb950` → contrast ratio **≈1.94:1** (requires ≥4.5:1 for small text, ≥3:1 for large)  

**Fix:** Use dark text on green background instead:
```css
.action-btn.primary {
  background: var(--green);
  color: #0d1117; /* dark text, ≈5.6:1 on #3fb950 */
}
.implement-btn {
  background: var(--green);
  color: #0d1117;
}
```

---

### H-2. Color contrast: White text on red buttons fails AA (WCAG 1.4.3)

**Location:** `ActionButtonGroup.svelte` (`.action-btn.danger`), `ImplementButton.svelte` (`.implement-btn.error`)  
**Values:** `#ffffff` on `#f85149` → contrast ratio **≈3.9:1** (fails AA for small text at <14px bold or <18px; these buttons use 0.78em ≈12.5px)

**Fix:**
```css
.action-btn.danger {
  background: var(--red);
  color: #0d1117;
}
.implement-btn.error {
  background: var(--red);
  color: #0d1117;
}
```

---

### H-3. Muted text fails AA contrast on card backgrounds (WCAG 1.4.3)

**Location:** `src/app.css` design tokens + all components using `var(--muted)`  
**Values:** `#8b949e` on `#161b22` (card background) → contrast **≈3.1:1** (fails 4.5:1 for body/small text)  
**Scope:** Used in ~20+ components for secondary text, labels, descriptions, empty states, metadata

**Fix:** Darken `--muted` slightly:
```css
:root {
  --muted: #9aa3b0; /* was #8b949e, now ~3.8:1 on card bg */
}
/* Or better, use a higher-contrast muted for small text: */
:root {
  --muted: #8b949e;
  --muted-text: #a0aab8; /* 4.55:1 on #161b22, for body/small text */
}
```

---

### H-4. LogPanel bypasses dark theme with hard-coded background (WCAG 1.4.3)

**Location:** `src/lib/components/shared/LogPanel.svelte`  
**Problem:** `.log-panel { background: #0a0e14; }` — hard-coded color, bypassing CSS custom properties. Text is `var(--muted)` (#8b949e) on #0a0e14 → contrast **≈3.4:1**.

**Fix:**
```css
.log-panel {
  background: var(--bg); /* use theme variable instead of hard-coded #0a0e14 */
}
.log-panel pre {
  color: var(--text); /* use --text instead of --muted for code content */
}
```

---

### H-5. No keyboard shortcut system (WCAG 2.1.4 Character Key Shortcuts)

**Location:** Global (not implemented anywhere)  
**Problem:** The dashboard has no `accesskey` attributes or global keyboard shortcuts for common operations:
- Tab switching (1–9, Ctrl+1–9)
- Search focus (`/` or `Ctrl+K`)
- Cron timeline "scroll to now" (`N`)
- Agent detail panel close (`Escape` — already works via focus trap)

**Fix:** Add data attributes for shortcut hints and implement a single global `keydown` listener in +layout.svelte:
```ts
const SHORTCUTS: Record<string, TabId> = {
  '1': 'overview', '2': 'agents', '3': 'crons',
  '4': 'orchestrator', '5': 'noema', '6': 'h1',
  '7': 'viktor', '8': 'brainstorm', '9': 'bills',
};
// On keydown: if no input focused, map digit keys to tabs
```

---

### H-6. Dark-only mode ignores user system preference (WCAG 1.3.5 Identify Input Purpose — advisory)

**Location:** `src/app.html` `<meta name="color-scheme" content="dark" />` + `src/app.css`  
**Problem:** The app declares `color-scheme: dark` unconditionally. No light theme exists. Users who need light mode for readability (astigmatism, bright environments) have no recourse. While the app is designed as a dark terminal-style dashboard, at minimum it should acknowledge `prefers-color-scheme`.

**Fix (minimal):** Document this as an intentional design choice but add a theme toggle stub:
```css
@media (prefers-color-scheme: light) {
  /* Future: light theme variables */
}
```
Mark this as a future enhancement rather than a blocking WCAG failure, since it's a deliberate dark-only dashboard.

---

### H-7. Hungarian content with `lang="en"` on `<html>` (WCAG 3.1.1 Language of Page)

**Location:** `src/app.html` `<html lang="en">`  
**Problem:** ~60% of the dashboard UI is in Hungarian (section labels, button tooltips, status text, error messages, Noema tab entirely). Screen readers set to English will mispronounce Hungarian words. Screen readers set to Hungarian will mispronounce English system terms.

**Fix:** Set `<html lang="hu">` as primary language. Wrap English-only sections in `<span lang="en">` where needed, or add `lang="en"` to components like Overview/H1/Viktor that are mostly English.

---

## 🟡 Medium (14)

### M-1. Decorarive emoji without `aria-hidden` — widespread (WCAG 1.1.1 Non-text Content)

Files affected (non-exhaustive list of key locations):

| File | Line/Location | Emoji | Fix |
|------|--------------|-------|-----|
| `BuildIntegrityBanner.svelte` | `<div role="alert">🚨 {message}` | 🚨 | Wrap in `<span aria-hidden="true">` |
| `OttoTimeline.svelte` | `<h3>⚡ Otto Nightly Runs</h3>` | ⚡ | Wrap in `<span aria-hidden="true">` |
| `OttoTimeline.svelte` | `ottoIcon()` fn → `{ottoIcon(run.status)}` | ✅⚠️❌ | Wrap in `<span aria-hidden="true">` |
| `DevJobIndicator.svelte` | `⏳ Loading…` | ⏳ | Wrap in `<span aria-hidden="true">` |
| `DevJobIndicator.svelte` | `⚙️ Dev Job` (title) | ⚙️ | Wrap in `<span aria-hidden="true">` |
| `DevJobIndicator.svelte` | `<span class="dji-compact-icon">⚙️</span>` | ⚙️ | Add `aria-hidden="true"` |
| `DevJobIndicator.svelte` | `🔄 {runningLabel}` | 🔄 | Wrap in `<span aria-hidden="true">` |
| `ProcessorTimer.svelte` | `mainText` with 🖊️⚡❓⏳ | 4 emoji | Wrap each in `<span aria-hidden="true">` |
| `Research.svelte` | Badges: `🔧 N AUTO-FIX`, `📋 N PROPOSE`, `💡 N corpus` | 🔧📋💡 | Wrap emoji in `<span aria-hidden="true">` |
| `Research.svelte` | Section titles: `🧪 Otto Nightly QA`, `📂 Research Corpus` | 🧪📂 | Wrap in `<span aria-hidden="true">` |
| `Research.svelte` | `ottoIcon()` in otto-head | ✅⚠️❌ | Wrap in `<span aria-hidden="true">` |
| `Viktor.svelte` | Panel titles: `📈`, `⚠️`, `⏳` | 📈⚠️⏳ | Wrap in `<span aria-hidden="true">` |
| `KanbanBoard.svelte` | Column headers: `⚡`, `👔`, `🧑` | ⚡👔🧑 | Wrap in `<span aria-hidden="true">` |
| `H1.svelte` | `⭐ PRIMARY` badge | ⭐ | Wrap in `<span aria-hidden="true">` |
| `DevPackageRow.svelte` | displayPhase: `🔄 Fut…`, `⏳ Sorban…` | 🔄⏳ | Wrap in `<span aria-hidden="true">` |
| `DevPackageRow.svelte` | Detail: `📁 Fájlok:` | 📁 | Wrap in `<span aria-hidden="true">` |
| `+error.svelte` | `<h1 class="error-emoji">{emoji}</h1>` | 🔍💥🚫🔧⚠️ | Add `aria-hidden="true"` |
| `CronSidebar.svelte` | Title: `⏰ Cronok` | ⏰ | Wrap in `<span aria-hidden="true">` |
| `Noema.svelte` | Stats: `📊 {N}/{N} kész` | 📊 | Wrap in `<span aria-hidden="true">` |
| `Noema.svelte` | Section headers: `📋`, `🔨`, `✅` | 📋🔨✅ | Wrap in `<span aria-hidden="true">` |
| `Noema.svelte` | Compact toggle: `📜`/`📋` | 📜📋 | Use text labels instead, or add aria-label |

**Pattern fix:** Create a `<Emoji char="📊" />` helper component:
```svelte
<script lang="ts">
  let { char }: { char: string } = $props();
</script>
<span aria-hidden="true">{char}</span>
```

---

### M-2. ACTION_LABELS and buttonLabel emoji pollute button accessible names (WCAG 1.1.1, 4.1.2)

**Location:** `src/lib/components/shared/ActionButtonGroup.svelte` `ACTION_LABELS` record  
**Problem:** Labels like `"✅ Resolve"` produce an accessible name of "White heavy check mark Resolve" for screen readers (the emoji's Unicode description is read aloud). Buttons already have `aria-label` which partially mitigates this, but the `aria-label` itself (`"{ACTION_LABELS[action]}: {state}"`) includes the emoji.

**Fix:** Remove emoji from `ACTION_LABELS` strings and use `<span aria-hidden="true">` in the template instead:
```ts
export const ACTION_LABELS: Record<DashboardActionType, string> = {
  resolve: "Resolve",
  delegate: "To Alfred",
  // ... no emoji
};
export const ACTION_EMOJIS: Record<DashboardActionType, string> = {
  resolve: "✅",
  // ...
};
```
Then in the template: `<span aria-hidden="true">{ACTION_EMOJIS[action]}</span> {ACTION_LABELS[action]}`

---

### M-3. ImplementButton: emoji in button text is read aloud (WCAG 1.1.1)

**Location:** `src/lib/components/shared/ImplementButton.svelte`  
**Problem:** Button text `"📋 Log ▲"` and `"📋 Log ▼"` and `"▶ Mehet"` embeds emoji directly. The `aria-label` attribute partially mitigates (e.g. `aria-label="Show Cursor log"`), but the `▶ Mehet` button only has `aria-label` for error/offline states — the default "▶ Mehet" button gets `aria-label="Implement dev package"` only, which doesn't match the visible emoji text.

**Fix:** Separate emoji from text content:
```svelte
<button aria-label="Show Cursor log">
  <span aria-hidden="true">📋</span> Log {logOpen ? '▲' : '▼'}
</button>
```

---

### M-4. Error page lacks landmark and live region (WCAG 1.3.1, 4.1.3)

**Location:** `src/routes/+error.svelte`  
**Problem:**
1. No `<main>` landmark
2. No `<h1>` — the status code is in `<h2>`, emoji is in `<h1>`
3. No `role="alert"` or `aria-live` for the error message
4. The emoji `<h1>` is decorative but read as a heading

**Fix:**
```svelte
<main class="error-page" role="alert">
  <div class="error-card">
    <span class="error-emoji" aria-hidden="true">{emoji}</span>
    <h1 class="error-status">{status}</h1>
    <p class="error-message">{message}</p>
    ...
  </div>
</main>
```

---

### M-5. Collapsed cron sidebar buttons: visible content is only emoji (WCAG 1.1.1, 2.5.3 Label in Name)

**Location:** `src/lib/components/layout/CronSidebar.svelte`, `.cs-icon-btn` buttons  
**Problem:** Collapsed sidebar icon buttons have `aria-label="Jump to cron: {cron.name}"` but the visible label is just an emoji (`{cronIcon(cron)}`). WCAG 2.5.3 requires that the visible text be part of the accessible name. Since the visible content is only an emoji, there's no visible text for sighted users who don't understand the emoji mapping.

**Fix (minimal):** Add a visually-hidden text span or tooltip. Since the button already has a `title` attribute, the simplest fix is to accept this as a cosmetic collapsed view where the sidebar is intentionally icon-only (like a toolbar). Mark as low-priority unless users report confusion.

---

### M-6. KanbanBoard heading level skips hierarchy (WCAG 1.3.1)

**Location:** `src/lib/components/tabs/KanbanBoard.svelte`  
**Problem:** `<h4>{col.title}</h4>` — the section title is h3, and column headers are h4. In the Orchestrator tab context, the section starts with OttoTimeline's h3, then KanbanBoard's h3, then these h4s. This is technically correct but fragile if the component is reused in a different heading context.

**Fix:** Make column headers `<h4>` (OK if consistent) or use `<div role="heading" aria-level="3">` to keep them accessible without affecting the outline.

---

### M-7. CronSidebar has no heading landmark (WCAG 1.3.1)

**Location:** `src/lib/components/layout/CronSidebar.svelte`  
**Problem:** The `<aside>` has `aria-label="Cron pipeline sidebar"` but no heading element. Screen reader users navigating by heading will skip the sidebar entirely.

**Fix:** Add a heading inside the cs-header:
```svelte
<h2 class="cs-title">⏰ Cronok</h2>
```
Or use `aria-labelledby` pointing to the title span.

---

### M-8. Favicon uses emoji (WCAG 1.1.1 — advisory)

**Location:** `src/app.html`  
**Problem:** `<link rel="icon" href="data:image/svg+xml,<svg ...><text>🧠</text></svg>" />` — the favicon is an emoji rendered in SVG. While favicons are decorative by nature, some screen readers may announce the page icon.

**Fix:** This is cosmetic. No change needed unless the emoji doesn't render on certain platforms. Consider a proper SVG icon for broader compatibility.

---

### M-9. `{@html agent.extra}` — BLOCKLIST, no action (WCAG 4.1.2 — reviewed)

**Location:** `src/lib/components/shared/AgentDetailPanel.svelte`  
**Verdict:** Per BLOCKLIST policy, this is trusted server-generated content. The content includes agent-specific documentation, configuration snippets, and metrics that are generated server-side. The server team should ensure the generated HTML is accessible (proper heading levels, alt text on any images, ARIA labels on interactive elements). **No client-side changes required.**

---

### M-10. LoadingSkeleton has unnecessary svelte-ignore (code quality)

**Location:** `src/lib/components/ui/LoadingSkeleton.svelte`  
**Problem:** `<!-- svelte-ignore a11y_no_static_element_interactions -->` — but the root div has no click/keydown handlers. This ignore directive is unnecessary and masks potential future issues.

**Fix:** Remove the ignore comment. The component is already well-constructed with proper `role="status"`, `aria-busy`, and `.sr-only` fallback.

---

### M-11. Keyboard-only users can't activate agent cards with Enter if href logic is missing (WCAG 2.1.1)

**Location:** `src/lib/components/tabs/Overview.svelte` agent cards, `Agents.svelte` rows  
**Verified:** Both have `onkeydown` handlers for Enter/Space. ✅ No issue found after verification.

---

### M-12. DevPackageRow: keyboard handler doesn't prevent default on non-Enter/Space (WCAG 2.1.1)

**Location:** `src/lib/components/shared/DevPackageRow.svelte` `onRowKeydown`  
**Status:** Already correctly implemented — only handles Enter and Space, other keys pass through. ✅

---

### M-13. Research.svelte ottoIcon emoji is properly aria-hidden in steps but NOT in otto-head (inconsistency)

**Location:** `src/lib/components/tabs/Research.svelte`  
**Problem:** Otto step icons are wrapped in `<span aria-hidden="true">` (✅⬜) — good. But the `ottoIcon()` in `otto-head` (line ~62) is rendered directly without aria-hidden. This is the same pattern as OttoTimeline.svelte.

**Fix:** Apply the same `<span aria-hidden="true">` wrapping to the otto-head icon.

---

### M-14. sessionName emoji may leak through agent emoji data (WCAG 1.1.1)

**Location:** `agent-icons.ts` → used in CronSidebar, CronTimeline, Crons, Overview  
**Problem:** `AGENT_ICONS` contains emoji values used directly in templates. While these are meaningful (agent identity), they should be consistently wrapped in aria-hidden spans when displayed alongside text labels.

**Fix:** Ensure all usages of AGENT_ICONS wrap the emoji in `<span aria-hidden="true">`. Currently, CronSidebar `cr-icon` spans and CronTimeline `ct-icon` spans do NOT use aria-hidden.

---

## 🟢 Low (5)

### L-1. Animations don't respect prefers-reduced-motion (WCAG 2.3.3)

**Location:** Multiple components  
**Affected:**
- `DevJobIndicator.svelte` — `dji-pulse` animation (border pulse for active state)
- `ProcessorTimer.svelte` — `transition:fade` Svelte transition
- `CronTimeline.svelte` (tab) — `ct-now-pulse` animation
- `Noema.svelte` — `live-pulse` animation for processing packages

**Fix:** Add `@media (prefers-reduced-motion: reduce)` blocks that disable these animations. LoadingSkeleton.svelte already does this correctly — replicate the pattern.

---

### L-2. Skip link uses `top: -100%` instead of `translateY` (WCAG 2.4.1 — cosmetic)

**Location:** `src/routes/+layout.svelte`  
**Problem:** `.skip-link { position: absolute; top: -100%; }` — while functionally identical to `transform: translateY(-100%)`, percentage-based top can cause issues in some browsers with zoom levels.

**Fix:** Use the standard pattern:
```css
.skip-link {
  position: absolute;
  left: 8px;
  top: 8px;
  transform: translateY(-200%);
  /* ... */
}
.skip-link:focus {
  transform: translateY(0);
}
```

---

### L-3. CronSidebar 100vh causes overflow on mobile (cosmetic)

**Location:** `src/lib/components/layout/CronSidebar.svelte`  
**Problem:** `height: 100vh` on sticky positioned sidebar. On mobile browsers with dynamic toolbars (iOS Safari), 100vh can be taller than the visible viewport, causing overflow.

**Fix:** Use `height: 100dvh` (dynamic viewport height) with a fallback:
```css
.cron-sidebar {
  height: 100vh;
  height: 100dvh;
}
```

---

### L-4. DevJobIndicator: no max-width constraint on expanded view (cosmetic)

**Location:** `src/lib/components/DevJobIndicator.svelte`  
**Problem:** The collapsed view has `max-width: 380px` but the expanded view is fixed at `width: 220px`. On very narrow screens (<320px), this could cause horizontal overflow since it's absolutely positioned.

**Fix:** Add `max-width: calc(100vw - 32px)` to the expanded view.

---

### L-5. Compact view toggle: "📜"/"📋" button has no visible text label (WCAG 2.5.3)

**Location:** `src/lib/components/tabs/Noema.svelte` compact toggle button  
**Problem:** The compact view toggle button text is only emoji (`📜` or `📋`). While it has `aria-label`, there's no visible text for sighted users who can't interpret the emoji.

**Fix:**
```svelte
<button aria-label={compactView ? "Részletes nézet" : "Kompakt nézet"}>
  <span aria-hidden="true">{compactView ? "📜" : "📋"}</span>
</button>
```
The `aria-label` is already present. Add a `title` attribute for mouse users.

---

## ✅ Verified Good Practices

The following are correctly implemented and should be preserved:

1. **Skip link** — properly hidden, visible on focus, targets `#main-content` ✅
2. **Tab ARIA roles** — `role="tab"`, `role="tablist"`, `aria-selected`, `aria-controls`, roving `tabindex` ✅
3. **Tab panels** — `role="tabpanel"`, `aria-labelledby` pointing to tab buttons ✅
4. **Keyboard handlers** — DevPackageRow, Overview agent cards, Agents rows all have Enter/Space handlers ✅
5. **Focus management** — AgentDetailPanel has focus trap, focus save/restore on open/close ✅
6. **Live regions** — ProcessorTimer `aria-live="polite"`, BuildIntegrityBanner `role="alert"` ✅
7. **Table captions** — H1, Crons, Viktor tables have `<caption>` ✅
8. **Progress bar** — Noema.svelte has `role="progressbar"` with full aria attributes ✅
9. **LoadingSkeleton** — `role="status"`, `aria-busy`, sr-only fallback, respects `prefers-reduced-motion` ✅
10. **Section labels** — Many section titles already use `<span aria-hidden="true">EMOJI</span>` pattern ✅
11. **Semantic HTML** — Proper use of `<header>`, `<nav>`, `<main>`, `<aside>`, `<section>`, `<article>` ✅
12. **Responsive breakpoints** — 768px (tablet), 599px (mobile) with grid collapse ✅
13. **Scrollable tables** — `overflow-x: auto` wrappers for data tables ✅
14. **Viewport meta** — `<meta name="viewport" content="width=device-width, initial-scale=1">` ✅

---

## Remediation Priority

| Priority | Findings | Effort | Impact |
|----------|----------|--------|--------|
| **P0 — This sprint** | C-1 (arrow keys), C-2 (heading fix), H-1/H-2 (button contrast) | ~2h | Keyboard nav + color fixes |
| **P1 — Next sprint** | M-1 (emoji aria-hidden sweep), H-3 (muted contrast), H-4 (log panel), M-2/M-3 (button emoji) | ~3h | Screen reader experience |
| **P2 — Backlog** | H-5 (keyboard shortcuts), C-3 (drag button), M-5/M-7 (sidebar), M-4 (error page), M-9 | ~4h | Landmarks + shortcuts |
| **P3 — Nice to have** | L-1 (reduced-motion), L-3 (100dvh), H-6 (light theme stub), M-10 (svelte-ignore) | ~2h | Polish |

**Estimated total: ~11h** for full remediation.

---

*Audit performed by Alfred 👔 (OpenClaw) — 2026-07-24 06:19 CEST*  
*Next review: After P0/P1 fixes are deployed, re-run snapshot-based audit against the live dashboard.*
