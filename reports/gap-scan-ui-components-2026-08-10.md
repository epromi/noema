# GAP SCAN: UI Components — 2026-08-10

**Scope:** `src/lib/components/` — 30 files (excl. `.gitkeep`)  
**Analyzed for:** missing error/loading/empty states, missing aria-labels, hardcoded strings, inconsistent naming, duplicate code

---

## CRITICAL (3 findings)

### C1: ZERO loading states in tab components
**Files:** All `tabs/*.svelte` (17 files) plus `shared/CpuWidget.svelte`, `shared/CronTimeline.svelte`, `shared/AgentDetailPanel.svelte`, `layout/CronSidebar.svelte`  
**What:** `LoadingSkeleton.svelte` exists with 3 variants (`card`, `table`, `metrics`) and proper `aria-busy`/`aria-label`/`prefers-reduced-motion` support — but it is **never imported** by any component. No component shows a skeleton, spinner, or any visual feedback while data loads. Only `DevJobIndicator` and `LogPanel` implement loading states at all.
**Fix:** Add `{#if loading}` blocks at the top of every tab that fetches data asynchronously, rendering `<LoadingSkeleton skeleton="card" label="agents" count={6} />` etc. The component is ready — just wire it in.

### C2: Overview.svelte — H1 data field mismatch (likely crash)
**File:** `tabs/Overview.svelte:60` and `:63`  
**What:** References `h1.signal.signal` and `h1.signal.reputation`, but the `H1Data` type (used in `H1.svelte`) exposes `h1.stats.signal` and `h1.stats.reputation`. If `H1Data` has no `signal` sub-object, this throws a runtime error.
```svelte
<!-- Overview.svelte:60 — WRONG -->
{h1.error ? "N/A" : na(h1.signal.signal)}
<!-- Should be -->
{h1.error ? "N/A" : na(h1.stats.signal)}
```
**Fix:** Replace all `h1.signal.*` with `h1.stats.*` to match the schema used in `H1.svelte` and the `H1Data` type.

### C3: OttoTimeline.svelte — status value mismatch (err vs warn)
**File:** `tabs/OttoTimeline.svelte:4-8` + template CSS class  
**What:** `ottoIcon()` function checks `status === "warn" → "⚠️"` but the template renders `class:tl-warn={run.status === "warn"}` — however the type `OttoRunEntry["status"]` likely has values `"ok" | "err"` (used in template's `tl-err` class), not `"warn"`. This means the `tl-warn` class and the ⚠️ icon will never apply, silently degrading to the default green dot for any non-error non-ok status.
```typescript
// Current: never matches if type is "ok" | "err"
if (status === "warn") return "⚠️";

// Template: also broken — tl-warn never applies
class:tl-warn={run.status === "warn"}
```
**Fix:** Either align `OttoRunEntry.status` type to include `"warn"`, or change the checks to use whatever the actual third value is.

---

## HIGH (5 findings)

### H1: Massive hardcoded Hungarian strings — 20+ files, no i18n
**Files:** 22 components contain inline Hungarian/English mixed labels  
**What:** All UI text is hardcoded in components: section titles, column headers, button labels, status text, placeholders. No i18n key system exists. Changing language requires touching every component.
- `DevJobIndicator.svelte`: "üres", "Következő:", "Sorban áll:", "Fut:", "⚠️ Hiba:", "Részletes nézet", "Egysoros nézet"
- `DevPackageRow.svelte`: "🔄 Fut…", "⏳ Sorban", "Sorban áll", "📁 Fájlok:", "📋 Fázisok:"
- `ImplementButton.svelte`: "▶ Mehet", Hungarian title attributes  
- `Bills.svelte`: "Név", "Összeg", "Határidő", "Státusz" column headers  
- `Brainstorm.svelte`: "Brainstorming Action Tracker" heading, "pending" labels  
- `Crons.svelte`: `CRON_DESCRIPTIONS` big object — 32 Hungarian descriptions  
- `CronTimeline.svelte` (tabs): "🌙 ÉJSZAKA (00:00–06:00)", "🌅 REGGEL", "☀️ NAPPAL", "🌆 ESTE"  
- `Noema.svelte`: "Kész", "Fejlesztés Alatt", "Specifikáció Kész", "Keresés…", "Nincs találat a keresésre."  
- `ProcessorTimer.svelte`: "folyamatban…", "elem a sorban", "következő ellenőrzés", "most"  
- `ResearchProposals.svelte`: "✅ Kész", "⏳ Fut…"  
- `AgentDetailPanel.svelte`: "Válassz egy agent-et a részletek megtekintéséhez"

**Fix:** Extract all strings to a `$lib/i18n/hu.ts` and `$lib/i18n/en.ts` key-value map. Start with a single `t('key')` helper. Prioritize: column headers, button labels, status text.

### H2: Noema.svelte — zero error handling
**File:** `tabs/Noema.svelte`  
**What:** The component only handles the empty state (`packages.length === 0`), nothing for fetch failures, parse errors, or corrupted data. If `/api/dev-packages` returns a 500, the user sees a blank page or stale content with no indication.
**Fix:** Add an `error` state:
```svelte
{#if error}
  <div class="error-banner" role="alert">⚠️ Failed to load packages — {error}</div>
{:else if packages.length === 0}
  <p class="empty">Nincs csomag az INDEX.md-ben.</p>
...
```

### H3: `(as any).error` type casts — fragile and unsafe
**Files affected:**
- `shared/CpuWidget.svelte:35,59` — `(cpu as any).error` checked twice  
- `tabs/Viktor.svelte:46` — `(viktor as any).error`  
**What:** Using `as any` to access `.error` means the type system can't protect these components. If the data schema changes, these break silently.
**Fix:** Add a proper optional `error?: string` field to `CpuData` and `H1ViktorStatus` types.

### H4: `CRON_DESCRIPTIONS` — 32-entry object inline in component
**File:** `tabs/Crons.svelte:12-45`  
**What:** A 32-entry Hungarian descriptions map is defined directly in the component script block. This is data, not component logic. It bloats the component, can't be shared, and can't be localized.
**Fix:** Move to `$lib/data/cron-descriptions.ts` or embed descriptions in the cron data from the relay API.

### H5: Missing loading states on `AgentDetailPanel`
**File:** `shared/AgentDetailPanel.svelte`  
**What:** When `open=true` and `agent=true`, the panel renders immediately. If agent detail data (memory, logs, extra) arrives asynchronously, there's no visual feedback. The panel jumps from empty to populated without transition.
**Fix:** Wrap the agent detail content in a loading guard — show `LoadingSkeleton` variant for the metadata fields if data is still resolving.

---

## MEDIUM (7 findings)

### M1: Duplicate action state logic — Orchestrator duplicates KanbanBoard
**Files:** `tabs/Orchestrator.svelte` and `tabs/KanbanBoard.svelte`  
**What:** Both components manage their own `actionBtnStates`, `actionKey()`, `getActionState()`, `sendAction()` functions with identical logic. Orchestrator passes its own `getActionState`/`sendAction` to `KanbanBoard`, but also duplicates the state tracking.
**Fix:** Extract the action-state management to a shared Svelte store or composable (`$lib/stores/action-states.ts`). Both components import it.

### M2: Inconsistent button state type names
**Files:**
- `shared/ActionButtonGroup.svelte:3` — `ActionBtnState = "idle" | "loading" | "ok" | "error" | "offline"`
- `shared/ImplementButton.svelte:2` — `ImplementState` (imported from `$lib/types`)  
- `tabs/Bills.svelte:15` — `type ActionBtnState = ...` (redefined locally!)  
**What:** Three different files define their own button-state types. Bills.svelte duplicates the type from ActionButtonGroup. ImplementButton uses a different type from `$lib/types`.
**Fix:** Use `ActionBtnState` globally. Add "running" and "done" variants to it so `ImplementState` is unnecessary. Remove local redefinition in `Bills.svelte`.

### M3: Inconsistent "error" vs "err" status values
**Files:**
- `tabs/OttoTimeline.svelte:13` — CSS class `tl-err` checks `run.status === "err"`
- `tabs/OttoTimeline.svelte:7` — `ottoIcon()` checks `status === "warn"` (not "err")  
- `tabs/Research.svelte:13` — `ottoItem` CSS class checks `run.status === "err"`  
**What:** "err" and "warn" are used inconsistently. OttoTimeline checks for both but they map to the same CSS classes.
**Fix:** Normalize to `"ok" | "warning" | "error"` everywhere, with a shared mapping function.

### M4: Model column hardcoded to "—"
**File:** `tabs/Agents.svelte:120`  
**What:** The `<td class="muted">—</td>` in the model column is a placeholder with no real data. Either this column should show actual model info from the `AgentEntry` type, or it should be removed from the table.
**Fix:** Add a `model` field to `AgentEntry` type and wire it through, or remove the column.

### M5: Missing aria-labels on metric cards and interactive elements
**Files affected:**
- `tabs/Overview.svelte` — metric cards (Crons, Agents, H1 Signal, Disk) have no `aria-label`
- `tabs/H1.svelte` — metric cards (Open reports, Signal, Reputation, Trial) have no `aria-label`  
- `shared/BuildIntegrityBanner.svelte` — has `role="alert"` but no `aria-label`
- `tabs/Viktor.svelte` — metric cards have `aria-label` on some but not others  
**Fix:** Add `aria-label` to every metric card with a human-readable description of its content.

### M6: LogPanel and LogsViewer — reverse order logic inverted
**Files:** `shared/LogPanel.svelte` and `tabs/LogsViewer.svelte`  
**What:** Both have `reversed` state with localStorage persistence, but LogPanel shows newest-first when `reversed=true` and LogsViewer shows newest-first when `reversed=false`. This is commented in LogsViewer as intentional ("Inverted vs LogPanel") but is confusing for users.
**Fix:** Standardize the behavior — `reversed=true` should always mean "newest first" in both. Unify the localStorage key behavior.

### M7: `Viktor.svelte` — "Pending" is hardcoded as a comma-separated static number
**File:** `tabs/Agents.svelte:126`  
**What:** The Viktor mini-summary has `Pending: —` hardcoded. This should be data-driven from `viktor.pending`.
**Fix:**
```svelte
Pending: {viktor.pending ?? "—"}
```

---

## LOW (7 findings)

### L1: Unused `browser` import in DevJobIndicator
**File:** `DevJobIndicator.svelte:1`  
**What:** `import { browser } from "$app/environment"` is imported but only used in `onDestroy` — and SvelteKit handles SSR destroy cleanup automatically. The guard is unnecessary.
**Fix:** Remove the import and the `if (!browser) return;` in `onDestroy`.

### L2: Hungarian capitalization inconsistency
**Files:**
- `ProcessorTimer.svelte:33` — `"folyamatban…"` (lowercase)  
- `DevPackageRow.svelte:52` — `"🔄 Fut…"` (capitalized)  
- `Noema.svelte:156` — `"Keresés..."` (capitalized)  
**What:** Status labels alternate between lowercase and capitalized Hungarian.
**Fix:** Pick a convention — either all lowercase or all sentence-case Hungarian. Document it.

### L3: `ResearchProposals` duplicates logic from `OttoTimeline`
**Files:** `tabs/ResearchProposals.svelte` and `tabs/OttoTimeline.svelte`  
**What:** Both render Otto run data with identical `ottoIcon()` logic and similar proposal styling. This is conceptual duplication.
**Fix:** Extract shared Otto run rendering to a `OttoRunSummary` component, use it in both places.

### L4: `CronTimeline` (shared) vs `CronTimeline` (tabs) — confusing naming
**Files:** `shared/CronTimeline.svelte` and `tabs/CronTimeline.svelte`  
**What:** Two components with the same name in different directories. The shared one renders a Gantt chart; the tabs one renders a vertical 24h timeline.
**Fix:** Rename `shared/CronTimeline.svelte` → `CronGanttChart.svelte` to disambiguate.

### L5: Missing `caption` on some data tables
**Files:**
- `tabs/Bills.svelte` — table has `<caption>Bills &amp; Open Loops</caption>` ✅  
- `tabs/Viktor.svelte` — table has `<caption>Security Audit Repositories</caption>` ✅  
- `tabs/Agents.svelte` — table has `<caption>Agent Registry</caption>` ✅  
- `tabs/H1.svelte` — table has `<caption>H1 Bug Bounty Programs</caption>` ✅  
- `tabs/Crons.svelte` — table has `<caption>Cron Job Registry</caption>` ✅  
**What:** Actually, all tables in tab components have captions. ✅ Well done. The shared CronTimeline and LogsViewer don't use `<table>` though — they use `<div>` layouts which lack structural semantics.
**Fix:** Consider `<table>` or `role="table"` layouts for the Gantt timeline and log lines.

### L6: `DevJobIndicator` — hardcoded z-index without CSS custom property
**File:** `DevJobIndicator.svelte:191`  
**What:** `z-index: 9999` is the only hardcoded z-index in the entire component tree. Noema has no z-index system; if other overlays (sidebar, detail panel, modals) need stacking, this becomes a collision risk.
**Fix:** Define z-index layers as CSS custom properties:
```css
:root { --z-sidebar: 100; --z-panel: 200; --z-indicator: 300; --z-modal: 400; }
```

### L7: SVG/emoji as icons — no icon system
**What:** All icons are emoji (⚙️, 📋, 🛡️, etc.) or raw Unicode (⠿, ▸, ▾, ✕). No icon library or SVG sprite is used. This means: no color control, inconsistent rendering across platforms (Windows emoji vs Mac emoji differ significantly), and no dark/light mode adaptation.
**Fix:** Not urgent — emoji works fine for now. If visual polish becomes a priority, evaluate `lucide-svelte` or a custom SVG icon set with CSS `currentColor` support.

---

## Summary Stats

| Severity | Count | Files affected |
|----------|-------|----------------|
| CRITICAL | 3 | Overview.svelte, OttoTimeline.svelte, all 17 tab components |
| HIGH | 5 | 22 files (hardcoded strings), Noema.svelte, CpuWidget, Viktor, Crons, AgentDetailPanel |
| MEDIUM | 7 | Orchestrator, KanbanBoard, Bills, LogsViewer, LogPanel, Agents, Overview, H1, Viktor |
| LOW | 7 | DevJobIndicator, ProcessorTimer, ResearchProposals, OttoTimeline, multiple shared components |
| **Total** | **22** | **28 of 30 files** |

---

## Quick Wins (≤30 min each)

1. **C2**: Fix `h1.signal.*` → `h1.stats.*` in Overview.svelte (5 min, prevents crash)
2. **L2**: Normalize Hungarian capitalization — pick one convention, apply across 6 files (15 min)  
3. **M4**: Remove or wire up the "—" model column in Agents.svelte (10 min)  
4. **M2**: Remove `ActionBtnState` redefinition in Bills.svelte, import from ActionButtonGroup (5 min)  
5. **L4**: Rename `shared/CronTimeline.svelte` → `CronGanttChart.svelte` + update imports (10 min)

## Biggest Impact (plan as package)

1. **C1 + H1**: Create a PKG to wire in `LoadingSkeleton` across all tabs (affects every page load UX)
2. **H1**: i18n key system — extract all Hungarian strings to `$lib/i18n/` (affects future maintenance)
3. **M1**: Extract action state management to a shared store (eliminates Orchestrator/KanbanBoard duplication)
