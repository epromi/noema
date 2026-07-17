# GAP SCAN: UI Components — 2026-07-17

**Scope:** `src/lib/components/` (29 `.svelte` files + 1 `.ts`)
**Audited for:** missing error/loading/empty states, missing aria-labels, hardcoded Hungarian strings, inconsistent naming, duplicate code.

---

## 🔴 CRITICAL

### C1. Shared localStorage key collision — LogPanel ⇄ LogsViewer

**File 1:** `src/lib/components/shared/LogPanel.svelte:11`
**File 2:** `src/lib/components/tabs/LogsViewer.svelte:7`

Both components use `const STORAGE_KEY = "log-reversed"` for their reverse-order toggle. They write to the **same localStorage key**, so toggling the log panel inside a DevPackageRow flips the LogsViewer tab's sort and vice versa.

**Before** (both files):
```ts
const STORAGE_KEY = "log-reversed";
```

**After** (LogPanel):
```ts
const STORAGE_KEY = "pkg-log-reversed";
```

**After** (LogsViewer):
```ts
const STORAGE_KEY = "logs-viewer-reversed";
```

---

### C2. Missing aria-label on CronSidebar collapsed icon buttons

**File:** `src/lib/components/layout/CronSidebar.svelte:185-188`

The collapsed-icon buttons only have `title={cron.name}`, no `aria-label`. Screen readers will announce a nameless button.

**Before:**
```svelte
<button type="button" class="cs-icon-btn" title={cron.name}>
  {cronIcon(cron)}
</button>
```

**After:**
```svelte
<button type="button" class="cs-icon-btn" title={cron.name} aria-label="Jump to cron: {cron.name}">
  {cronIcon(cron)}
</button>
```

---

## 🟠 HARDCODED HUNGARIAN STRINGS

These prevent i18n and make the UI untranslatable. Noted as `(intentional?)` where the user is Hungarian and the UI is internal — but still `hardcoded`.

### H1. DevJobIndicator.svelte — 8 Hungarian strings

**File:** `src/lib/components/DevJobIndicator.svelte`

| Line | String | Suggestion |
|------|--------|------------|
| ~105 | `"üres"` | Move to a labels map or i18n key |
| ~172 | `title="Részletes nézet"` | `title="Detailed view"` |
| ~182 | `title="Egysoros nézet"` | `title="Compact view"` |
| ~197 | `"Következő:"` | `"Next:"` |
| ~208 | `"Sorban áll:"` | `"Queued:"` |
| ~215 | `"Fut:"` | `"Running:"` |
| ~221 | `"⚠️ Hiba:"` | `"⚠️ Error:"` |

**Fix pattern — extract to module-level constants:**
```ts
const LABELS = {
  empty: "idle",
  next: "Next:",
  queued: "Queued:",
  running: "Running:",
  error: "⚠️ Error:",
} as const;
```

### H2. AgentDetailPanel.svelte — 1 Hungarian string

**File:** `src/lib/components/shared/AgentDetailPanel.svelte:81`

```
"Válassz egy agent-et a részletek megtekintéséhez"
```

**Fix:**
```svelte
<p>Select an agent to view details</p>
```

### H3. CronSidebar.svelte — 1 Hungarian string

**File:** `src/lib/components/layout/CronSidebar.svelte:160`

```svelte
<span class="cs-title">⏰ Cronok</span>
```

**Fix:**
```svelte
<span class="cs-title">⏰ Crons</span>
```

### H4. DevPackageRow.svelte — 5 Hungarian strings

**File:** `src/lib/components/shared/DevPackageRow.svelte`

| Line | String | Suggestion |
|------|--------|------------|
| ~95-97 | `"🔄 Fut…"` / `"⏳ Sorban"` / `"⏳ Sorban áll"` | `"🔄 Running…"` / `"⏳ Queued"` / `"⏳ Queued"` |
| ~133 | `"📁 Fájlok:"` | `"📁 Files:"` |
| ~138 | `"📋 Fázisok:"` | `"📋 Phases:"` |

### H5. ImplementButton.svelte — 2 Hungarian strings

**File:** `src/lib/components/shared/ImplementButton.svelte:28,30`

```svelte
title="Kattints a Cursor log megtekintéséhez"
```

**Fix:**
```svelte
title="Toggle Cursor log view"
```

### H6. LogPanel.svelte — 1 Hungarian string

**File:** `src/lib/components/shared/LogPanel.svelte:99`

```svelte
title={reversed ? "Legújabb felül (↑)" : "Legrégebbi felül (↓)"}
```

**Fix:**
```svelte
title={reversed ? "Newest first (↑)" : "Oldest first (↓)"}
```

### H7. Noema.svelte — 12 Hungarian strings

**File:** `src/lib/components/tabs/Noema.svelte`

| Line | String | Suggestion |
|------|--------|------------|
| ~80 | Hint text: `"▶ Mehet indítja…"` | English equivalent |
| ~84 | `"Nincs csomag az INDEX.md-ben."` | `"No packages in INDEX.md."` |
| ~88 | `"{stats.done}/{stats.total} kész"` | `"{stats.done}/{stats.total} done"` |
| ~93 | `title="Részletes nézet"` / `"Kompakt nézet"` | English |
| ~111-113 | Stats chips: `"spec"`, `"aktív"`, `"kész"` | `"spec"`, `"active"`, `"done"` |
| ~118 | `placeholder="Keresés..."` | `placeholder="Search..."` |
| ~122 | `"Nincs találat a keresésre."` | `"No results."` |
| ~135 | Section: `"📋 Specifikáció Kész"` | `"📋 Specification Done"` |
| ~142 | `"Nincs specifikációs csomag."` | `"No specification packages."` |
| ~160 | Section: `"🔨 Fejlesztés Alatt"` | `"🔨 In Development"` |
| ~167 | `"Nincs aktív csomag."` | `"No active packages."` |
| ~184 | Section: `"✅ Kész"` | `"✅ Done"` |

### H8. CronTimeline.svelte (tabs/) — 6 Hungarian strings

**File:** `src/lib/components/tabs/CronTimeline.svelte:6-14`

```ts
const GROUP_LABELS: Record<CronGroup, string> = {
  NIGHT: "🌙 ÉJSZAKA (00:00–06:00)",
  MORNING: "🌅 REGGEL (06:00–08:00)",
  DAYTIME: "☀️ NAPPAL (08:00–18:00)",
  EVENING: "🌆 ESTE (18:00–24:00)",
  SPANNING: "🔄 AUTOMATIKUS (nincs fix idő)",
};
```
And:
```ts
spanning: "🌐 EGÉSZ NAP (több időpont / range)",
```

**Fix:** Use English labels consistent with the rest of the UI.

### H9. LogsViewer.svelte — 1 Hungarian string

**File:** `src/lib/components/tabs/LogsViewer.svelte:106-107`

Same Hungarian title as LogPanel.svelte (H6):
```svelte
title={reversed ? "Legújabb felül (↑)" : "Legrégebbi felül (↓)"}
```

**Fix:** Same as H6.

### H10. ProcessorTimer.svelte — 6 Hungarian strings

**File:** `src/lib/components/tabs/ProcessorTimer.svelte:28-40`

```ts
"folyamatban…"       → "in progress…"
"elem a sorban"      → "item(s) queued"
"most indul"          → "starting now"
"következő ellenőrzés … múlva" → "next check in …"
"következő trigger"  → "next trigger"
"most"                → "now"
```

### H11. ResearchProposals.svelte — 2 Hungarian strings

**File:** `src/lib/components/tabs/ResearchProposals.svelte:49,79,81`

```svelte
"⏳ Első futás holnap 01:00-kor. Még nincs adat."
"✅ Kész"
"⏳ Fut..."
```

**Fix:**
```svelte
"⏳ First run tomorrow at 01:00. No data yet."
"✅ Done"
"⏳ Running…"
```

### H12. Bills.svelte — 4 Hungarian table headers

**File:** `src/lib/components/tabs/Bills.svelte:119-124`

```svelte
<th scope="col">Név</th>
<th scope="col">Összeg</th>
<th scope="col">Határidő</th>
<th scope="col">Státusz</th>
```

**Fix:**
```svelte
<th scope="col">Name</th>
<th scope="col">Amount</th>
<th scope="col">Due</th>
<th scope="col">Status</th>
```

---

## 🟡 MISSING ARIA-LABELS

### A1. CpuWidget — no aria-label on the section

**File:** `src/lib/components/shared/CpuWidget.svelte:35`

**Before:**
```svelte
<div class="cpu-top-card">
  <h3 class="section-title">🔥 Top CPU</h3>
```

**After:**
```svelte
<div class="cpu-top-card" aria-label="Top CPU processes">
  <h3 class="section-title">🔥 Top CPU</h3>
```

### A2. CronTimeline (shared) — no aria-label on timeline rows

**File:** `src/lib/components/shared/CronTimeline.svelte:57-65`

Each `<li class="timeline-row">` has no `aria-label` or `role`. The row names only exist as visual text in `<span class="row-name">`.

**Before:**
```svelte
<li class="timeline-row">
```

**After:**
```svelte
<li class="timeline-row" role="listitem" aria-label="Cron timeline row: {row.name}">
```

### A3. CronTimeline (tabs/) — scroll-to-now button missing aria-label

**File:** `src/lib/components/tabs/CronTimeline.svelte:164-170`

**Before:**
```svelte
<button type="button" class="ct-now-btn" title="Scroll to current time" onclick={scrollToNow}>
  📍 NOW
</button>
```

It has `title` but no `aria-label`. Screen readers may not read `title`.

**After:**
```svelte
<button type="button" class="ct-now-btn" title="Scroll to current time" aria-label="Scroll to current time" onclick={scrollToNow}>
  📍 NOW
</button>
```

### A4. Crons tab — table rows not keyboard-accessible for agent linking

**File:** `src/lib/components/tabs/Crons.svelte:107-111`

The agent-link buttons inside table rows have click handlers but no `aria-label`.

**Before:**
```svelte
<button type="button" class="agent-link" onclick={(e) => handleAgentSelect(cron.agentId, e)}>
  {cron.agentId}
</button>
```

**After:**
```svelte
<button type="button" class="agent-link" aria-label="View agent {cron.agentId}" onclick={(e) => handleAgentSelect(cron.agentId, e)}>
  {cron.agentId}
</button>
```

### A5. OttoTimeline — no aria-label on section

**File:** `src/lib/components/tabs/OttoTimeline.svelte:13`

**Before:**
```svelte
<h3 class="section-title">⚡ Otto Nightly Runs</h3>
<div class="card timeline-card">
```

**After:**
```svelte
<h3 class="section-title">⚡ Otto Nightly Runs</h3>
<div class="card timeline-card" role="region" aria-label="Otto nightly run timeline">
```

### A6. Viktor tab — no aria-label on section

**File:** `src/lib/components/tabs/Viktor.svelte:51`

**Before:**
```svelte
<section class="viktor-tab">
```

**After:**
```svelte
<section class="viktor-tab" aria-label="Viktor security audit status">
```

### A7. Bills table — generic aria-label on paid button

**File:** `src/lib/components/tabs/Bills.svelte:151`

Every "Paid" button has the same `aria-label="Mark bill as paid"`. Screen reader users cannot tell which bill.

**Before:**
```svelte
aria-label="Mark bill as paid"
```

**After:**
```svelte
aria-label="Mark {row.name} as paid"
```

---

## 🟠 DUPLICATE CODE (DRY violations)

### D1. `na()` function duplicated

**Files:**
- `src/lib/components/tabs/H1.svelte:8-11`
- `src/lib/components/tabs/Overview.svelte:37-40`

Both define the identical function:
```ts
function na(value: string | number | undefined | null): string {
  if (value == null || value === "" || value === "unknown") return "N/A";
  return String(value);
}
```

**Fix:** Extract to `$lib/utils/display.ts`:
```ts
export function na(value: string | number | undefined | null): string {
  if (value == null || value === "" || value === "unknown") return "N/A";
  return String(value);
}
```
Import in both components.

### D2. Status-dot CSS duplicated across 3 components

**Files:**
- `Agents.svelte:112-120` — `.dot-ok`, `.dot-warn`, `.dot-error`
- `Crons.svelte:154-162` — `.dot-ok`, `.dot-error` (missing `.dot-warn`)
- `Overview.svelte:120-128` — `.dot-ok`, `.dot-warn`, `.dot-error`

All three define the same `width: 8px; height: 8px; border-radius: 50%` dot with color variants.

**Fix:** Extract to `$lib/styles/dots.css` or a shared `<StatusDot>` component:
```svelte
<!-- shared/StatusDot.svelte -->
<script lang="ts">
  let { status, label = "" }: { status: "ok" | "warn" | "error"; label?: string } = $props();
</script>
<span class="status-dot dot-{status}" title={label} aria-hidden="true"></span>
<style>
  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
  .dot-ok { background: var(--green); }
  .dot-warn { background: var(--yellow); }
  .dot-error { background: var(--red); }
</style>
```

### D3. `ottoIcon()` function duplicated

**Files:**
- `src/lib/components/tabs/OttoTimeline.svelte:6-10`
- `src/lib/components/tabs/Research.svelte:7-12`

Identical logic:
```ts
function ottoIcon(status: "ok" | "warn" | "err"): string {
  if (status === "ok") return "✅";
  if (status === "warn") return "⚠️";
  return "❌";
}
```

**Fix:** Extract to `$lib/utils/icons.ts`.

### D4. Priority-color logic duplicated

**Files:**
- `src/lib/components/tabs/Research.svelte:12-15` → `proposalColor()`
- `src/lib/components/tabs/ResearchProposals.svelte:32-36` → `proposalPriorityColor()`

Same logic: 🔴 → `var(--red)`, 🟡 → `var(--yellow)`, else → `var(--muted)`.

**Fix:** Extract to shared utility:
```ts
// $lib/utils/priority.ts
export function priorityColor(priority: string): string {
  if (priority.includes("🔴")) return "var(--red)";
  if (priority.includes("🟡")) return "var(--yellow)";
  return "var(--muted)";
}
```

### D5. Ok/warn/error classification pattern duplicated

**Files:**
- `SessionHealth.svelte:11-15` — `scoreClass()`: `<40 → error, <70 → warn, else ok`
- `Overview.svelte:41-47` — `cronMetricClass()`: ratio thresholds
- `Viktor.svelte:7-11` — `recallClass()`: `≥90 → ok, ≥70 → warn, else error`

Different thresholds but same ternary/if-else pattern returning `"ok" | "warn" | "error"`.

**Fix:** Consider extracting `thresholdClass(value, okThreshold, warnThreshold)` to `$lib/utils/display.ts`.

### D6. `formatTime` / `formatLastRun` duplicated

**Files:**
- `Crons.svelte:47-56` — `formatLastRun()`: relative time ("just now", "5m ago", "2h ago")
- `AuditTrail.svelte:73-75` — `formatTime()`: `new Date(ms).toLocaleString()`
- `DecisionTrace.svelte:26-28` — `formatTime()`: same as AuditTrail

Two different implementations. `formatTime` (toLocaleString) is identical in AuditTrail + DecisionTrace.

**Fix:** Extract both to `$lib/utils/time.ts`:
```ts
export function formatLastRun(ms: number | undefined): string { … }
export function formatTimestamp(ms: number): string { return new Date(ms).toLocaleString(); }
```

---

## 🟡 MISSING ERROR STATES

### E1. Noema tab — no error state for packages data

**File:** `src/lib/components/tabs/Noema.svelte:82-84`

The component only checks `packages.length === 0` (empty state) but has no error state. If the API fails, users see `"Nincs csomag az INDEX.md-ben."` which is misleading.

**Before:**
```svelte
{#if packages.length === 0}
  <p class="empty">Nincs csomag az INDEX.md-ben.</p>
```

**After:**
```svelte
{#if packagesError}
  <p class="empty error">Failed to load packages — {packagesError}</p>
{:else if packages.length === 0}
  <p class="empty">No packages in INDEX.md.</p>
```
(Requires adding `packagesError` prop — see S1 below.)

### E2. Orchestrator tab — no error boundary

**File:** `src/lib/components/tabs/Orchestrator.svelte:103-121`

The orchestrator renders multiple sub-components but has no error boundary. If one child's data is broken, nothing surfaces.

**Fix:** Wrap children in error boundaries (Svelte 5 `{#snippet}` or `<ErrorBoundary>`). At minimum, check each data prop for errors before rendering.

### E3. Overview — health error rendering is inconsistent

**File:** `src/lib/components/tabs/Overview.svelte:57-59`

Only `health.error` renders inside the system bar. The H1 card falls back to `"N/A"` but with no explanation that data failed.

**Before:**
```svelte
{#if health.error}
  <span class="sys-item sys-error">⚠ {health.error}</span>
{/if}
```

This is fine for health, but the disk/CPU cards have no error indication. The Disk card shows `diskPercent(health.disk)` which could parse garbage.

**Fix:** Guard the disk/CPU display with the same error check pattern.

---

## 🟡 MISSING LOADING STATES

### L1. No explicit loading state in any component

All 29 components are designed for SSR (data arrives pre-fetched). None have a loading skeleton or spinner. If the dashboard were to add client-side navigation or slow API endpoints, users would see stale/empty content with no loading indicator.

**Recommendation for future:** Add an optional `loading` prop pattern to the major container components:
```svelte
{#if loading}
  <SkeletonPlaceholder />
{:else if error}
  <ErrorBanner />
{:else if items.length === 0}
  <EmptyState />
{:else}
  <Content />
{/if}
```

---

## 🟢 MINOR / NITPICKS

### M1. Crons tab — inconsistent column width handling

**File:** `src/lib/components/tabs/Crons.svelte:144`

`.col-desc` has `max-width: 320px` but no `text-overflow: ellipsis` or `overflow: hidden`, so long descriptions can overflow.

**Fix:**
```css
.col-desc {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### M2. ActionButtonGroup — action tooltips are all Hungarian

**File:** `src/lib/components/shared/ActionButtonGroup.svelte:22-34`

The `ACTION_TOOLTIPS` map contains Hungarian tooltips while the button labels (`ACTION_LABELS`) are English. Inconsistent.

**Fix:** Either make both English or both Hungarian (prefer English for internal tool).

### M3. DevPackageRow — row click handler on compact mode

**File:** `src/lib/components/shared/DevPackageRow.svelte:105-107`

The compact row sets `tabindex={compact ? -1 : 0}` and `onclick={compact ? undefined : onRowClick}`. This means compact rows are entirely non-interactive. If the compact view is the only one visible on mobile, users can't expand details. Consider whether this is intentional vs. whether compact rows should still expand.

### M4. H1 tab — `submissionState` string shows raw snake_case

**File:** `src/lib/components/tabs/H1.svelte:17`

```ts
function programStatus(program: H1Program): string {
  return program.submissionState.replace(/_/g, " ");
}
```

This only replaces underscores with spaces. If the value is `"disabled"`, it shows as-is. A title-case transform would be better:

**Fix:**
```ts
function programStatus(program: H1Program): string {
  return program.submissionState
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
```

---

## 📊 SUMMARY

| Category | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 Hungarian strings | 12 files, ~48 strings |
| 🟡 Missing aria-labels | 7 |
| 🟠 Duplicate code (DRY) | 6 patterns |
| 🟡 Missing error states | 3 |
| 🟡 Missing loading states | 1 (systemic) |
| 🟢 Minor/nitpicks | 4 |
| **Total findings** | **35** |

### Recommended remediation priority

1. **C1** (localStorage collision) — immediate bug fix
2. **C2** (aria-label on CronSidebar icons) — quick accessibility win
3. **D1-D6** (duplicate code) — extract shared utilities, prevents future divergence
4. **H1-H12** (Hungarian strings) — systematic sweep, consider a labels map
5. **A1-A7** (aria-labels) — round out remaining accessibility gaps
6. **E1-E3** (error states) — add error props where missing
7. **M1-M4** (minor) — polish pass

### Files with zero findings
- `AgentDetailPanel.svelte` — clean except H2 (one Hungarian string, already noted)
- `BuildIntegrityBanner.svelte` — clean
- `Brainstorm.svelte` — clean
- `DecisionTrace.svelte` — clean (only D6 duplicate, minor)
- `SessionHealth.svelte` — clean
- `agent-icons.ts` — clean
