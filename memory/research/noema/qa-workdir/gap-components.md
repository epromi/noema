# Noema UI Components — Gap Scan Report

**Date**: 2026-07-23 06:16 CEST
**Scope**: 30 files in `src/lib/components/` (27 .svelte + 1 .ts + 1 .gitkeep + 1 layout/)
**Methodology**: Full read of every component, categorized by gap type.
**Context**: Yesterday's QA run fixed 6 `aria-hidden` emoji additions. This report covers **NEW/remaining gaps only** (does not re-report fixed items).
**Exclusions**: `{@html agent.extra}` in AgentDetailPanel.svelte (trusted HTML, reverted 3×). `.btn-green`/`.btn-red` color changes (pre-verified contrast).

---

## 1. Loading States (Critical — 26/30 files)

**The `LoadingSkeleton.svelte` component (ui/) exists with 3 variants (`card`, `table`, `metrics`), proper `aria-busy`, `prefers-reduced-motion` support — but it is NEVER imported by any tab component.** Every tab component that receives async data props falls through directly to empty/error states instead of showing a loading indicator before data arrives.

| File | Line | Issue | Fix |
|------|------|-------|-----|
| **ALL tab components** (23 files) | N/A | `LoadingSkeleton.svelte` is defined but unused. Every tab shows "No data" / empty state during initial load, indistinguishable from truly empty data. | Wrap each tab's main content in `{#if loading}<LoadingSkeleton skeleton="table" />{:else}...`. Use appropriate variant per tab: `card` for agent grids/kanban, `table` for Crons/Bills/H1/Agents, `metrics` for Overview/Viktor metric bars. |
| **LogsViewer.svelte** | `:1` | Polls `/api/logs` on mount with no loading state. Shows `filteredEntries.length` before first fetch completes. | Add `{#if !liveLogs && !resolvedLogs.entries.length}<LoadingSkeleton skeleton="table" rows={8} cols={4} />` guard. |
| **DecisionTrace.svelte** | `:1` | Data arrives via prop — no loading gate. During init, shows "No agent sessions available" when data hasn't arrived. | Add `{#if !decisionTrace.sessions}...` loading guard. |
| **Noema.svelte** | `:1` | No loading state for initial package list. Shows "Nincs csomag az INDEX.md-ben." on first paint if SSR didn't populate. | Add `{#if packages.length === 0 && !polledPackages}<LoadingSkeleton skeleton="table" label="dev packages" />`. |

---

## 2. Error States (4 findings)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| **OttoTimeline.svelte** | `18-27` | No error handling at all. Only checks `ottoRuns.length === 0`. If ottoRuns data fails silently, shows "No timeline data" — same as empty, no way to distinguish. | Add `{#if ottoError}...` or check for an error prop. At minimum: add `ottoRuns` as a data wrapper with error field. |
| **Viktor.svelte** | `:1` | No error state — `H1ViktorStatus` type has no `error` field. If data fetch fails, shows stale/blank data. | Add `viktor.error` to the type and render `<p class="empty">No Viktor data — {viktor.error}</p>`. |
| **CpuWidget.svelte** | `42-43` | Silent fail when `cpu` is undefined/null. The `{#if cpu && ...}` guard renders nothing — no indication to user that CPU data is unavailable. | Add `{:else}` branch: `<p class="empty">CPU data unavailable.</p>`. |
| **Noema.svelte** | `134-137` | `pollLivePackages()` silently swallows errors with empty `catch {}`. If the API is down, the user never knows — stale data persists indefinitely. | Set an error state: `catch { pollError = 'API unreachable'; }` and show a non-blocking banner. |

---

## 3. Empty States (2 findings)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| **CpuWidget.svelte** | `42-43` | When `cpu` is null/undefined and `part="list"`, renders nothing at all (not even the card shell). | Render card with empty message: `<p class="empty">CPU data not available.</p>` inside the `.cpu-top-card`. |
| **ResearchProposals.svelte** | `39` | Text "⏳ Első futás holnap 01:00-kor. Még nincs adat." is shown when `!research.latestDate`. This is ambiguous — it could mean "data hasn't loaded yet" vs "no cron has ever run". If the first run was >24h ago and it still shows this, it's misleading. | Add a timestamp check: if `Date.now() - research.latestDate > 24h`, show "No research data — may need manual cron trigger." |

---

## 4. Aria Labels & Accessibility (10 findings)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| **CpuWidget.svelte** | `43` | `aria-label="Top CPU processes"` on `<div>` without `role` attribute. Screen readers may ignore the label on a generic div. | Add `role="region"` to the `.cpu-top-card` div. |
| **Crons.svelte (tabs/)** | `148` | Agent-link buttons have `aria-label="View agent {cron.agentId}"` but no `aria-haspopup="dialog"`. These open the AgentDetailPanel (a modal dialog). | Add `aria-haspopup="dialog"` and optionally `aria-expanded` tracking. |
| **H1.svelte (tabs/)** | `58-75` | Metric cards (Open reports, Signal, Reputation, Trial count) have NO `aria-label`. Contrast with Viktor.svelte which has `aria-label` on all metric cards. **Inconsistent pattern.** | Add `aria-label="Open reports: {na(h1.stats.open)}"` etc. to each `.metric-card`. |
| **AuditTrail.svelte** | `89-113` | Filter `<label>` elements use `<span>` as children instead of proper `<label for="...">` + `<select id="...">` association. Screen readers may not announce the label-select relationship. | Add `id` to each `<select>` and `for={id}` to each `<label>`. |
| **DecisionTrace.svelte** | `74-85` | Session `<select>` has `<label>` with a `<span>` child but no `for`/`id` binding. | Add `id="trace-session-select"` to `<select>` and `for="trace-session-select"` to `<label>`. |
| **Bills.svelte** | `153-161` | All "💰 Paid" buttons share the same `aria-label="Mark bill as paid"`. Screen reader users can't distinguish which bill they're acting on. | Use `aria-label="Mark {row.name} as paid"`. |
| **Agents.svelte** | `97-100` | Status dots have `title={agent.statusText}` but no `aria-label`. `title` is not reliably announced by all screen readers. | Add `aria-label={agent.statusText}` alongside `title`. |
| **Viktor.svelte** | `84-89` | Circuit badge has no `aria-label`. Uses color-only class (`circuit-badge ok/warn/error`) for status differentiation. | Add `aria-label="Circuit status: {viktor.circuit}"` to the circuit badge `<span>`. |
| **OttoTimeline.svelte** | `18-41` | No `aria-label` on the timeline container, timeline items, or step elements. Completely invisible to screen reader structural navigation. | Add `aria-label="Otto nightly run: {run.title}"` on each `.tl-item`, `role="list"` on `.timeline`, `role="listitem"` on `.tl-item`. |
| **AgentDetailPanel.svelte** | `131` | Memory `<pre>` block has `overflow-y: auto` (scrollable) but no `tabindex="0"`. Keyboard users cannot scroll the memory content. | Add `tabindex="0"` to the `.memory-block` `<pre>` and `aria-label="Agent memory content (scrollable)"`. |

---

## 5. Hardcoded Strings (Mixed Hungarian/English — 7 findings)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| **ImplementButton.svelte** | `39-42` | `title="Kattints a Cursor log megtekintéséhez"` — hardcoded Hungarian tooltip. Mixed language (aria-label is English, title is Hungarian). | Use consistent language or extract to i18n. Suggestion: `title="Click to view Cursor log"`. |
| **ImplementButton.svelte** | `65` | `title="Kész"` on the done badge — hardcoded Hungarian. | Use `title="Done"` or consistent language. |
| **Noema.svelte** | `152-154` | Hint text `"▶ Mehet indítja a dev-loop-ot. Futás közben 📋 Log mutatja a Cursor kimenetét (3s frissítés)."` — hardcoded Hungarian. | Extract to constant or parent prop. |
| **Noema.svelte** | `156` | `"Nincs csomag az INDEX.md-ben."` — hardcoded Hungarian. | Same. |
| **Noema.svelte** | Lines throughout | Section labels: `"Specifikáció Kész"`, `"Fejlesztés Alatt"`, `"Kész"`, `"Keresés..."`, `"Nincs találat a keresésre."` — all hardcoded Hungarian. | Extract to `SECTION_LABELS` constant (consistent with how `CronTimeline` already uses `SECTION_LABELS`/`GROUP_LABELS` constants). |
| **DevJobIndicator.svelte** | Expanded view | Labels: `"Következő:"`, `"Sorban áll:"`, `"Fut:"`, `"⚠️ Hiba:"`, `"Részletes nézet"`, `"Egysoros nézet"` — Hungarian mixed with English `aria-label`s. | Consistent language choice. If Hungarian UI is intended, aria-labels should also be Hungarian. |
| **AgentDetailPanel.svelte** | `184` | `"Válassz egy agent-et a részletek megtekintéséhez"` — hardcoded Hungarian empty state text. | Extract to constant. |

---

## 6. Code Quality (6 findings)

### 6.1 Duplicate Code

| File(s) | Lines | Issue | Fix |
|---------|-------|-------|-----|
| **H1.svelte** + **Overview.svelte** | Multiple | `na()` helper function duplicated verbatim in both files. Same logic for null/empty/"unknown" → "N/A" fallback. | Extract to `$lib/core/format.ts` as `export function na(value: unknown): string`. |
| **CronSidebar.svelte (layout/)** + **CronTimeline.svelte (tabs/)** | Both ~entire files | Massive logic duplication: both compute `enrichedCrons`, `nextCronId`, `cronIcon`, `isSpanningSched` checks, `formatTimeLabel`, sort-key logic, past/next detection. ~150+ lines of near-identical derivation logic duplicated. | Extract shared cron-enrichment pipeline to `$lib/core/cron-enrich.ts`. Both components should consume pre-enriched data or share a `useCronTimeline()` composition function. |
| **Agents.svelte** `parseDays` vs **Overview.svelte** `isStale` | `Agents:41-46`, `Overview:68-72` | Same regex `/^(\d+)d ago$/` for parsing agent staleness, implemented differently. `parseDays` returns number, `isStale` returns boolean with threshold 3. | Use shared `parseStaleDays(lastRun: string): number` and `isStale(lastRun: string, threshold?: number): boolean` in `$lib/core/agent-utils.ts`. |
| **Research.svelte** + **ResearchProposals.svelte** + **OttoTimeline.svelte** | All 3 files | Otto run rendering logic duplicated: `ottoIcon()` function (✅/⚠️/❌ mapping), Otto item structure, step rendering. Research.svelte shows last 3, ResearchProposals in orchestrator, OttoTimeline standalone. | Extract `<OttoRunCard>` shared component or use `$lib/core/otto-utils.ts` for `ottoIcon()`. |

### 6.2 Inconsistent Patterns

| File | Line | Issue | Fix |
|------|------|-------|-----|
| **H1.svelte metric cards** vs **Viktor.svelte metric cards** | Both | Viktor metric cards have `aria-label`, H1 metric cards don't. Both use identical `.metric-card` CSS class structure but diverge on accessibility. | Standardize: all `.metric-card` components should include `aria-label`. |
| **Research.svelte proposals** vs **ResearchProposals.svelte proposals** | Both | Same proposal data rendered in two different components with different markup: Research.svelte uses `.proposal-row` without actions, ResearchProposals.svelte uses `.proposal-row` with `ActionButtonGroup`/`ImplementButton`. Different DOM structure for same data type. | Unify into a single `<ProposalRow>` component with optional action slot. |

### 6.3 Missing Defensive Guards

| File | Line | Issue | Fix |
|------|------|-------|-----|
| **Crons.svelte (tabs/)** | `51-103` | `CRON_DESCRIPTIONS` lookup falls back to `"—"` but uses hardcoded string keys. If a cron name changes but the map isn't updated, descriptions silently vanish. | Add fallback: log a console.warn when a cron name isn't in the map (dev-only). Or derive descriptions from cron metadata instead of a static map. |
| **LogPanel.svelte** | `97-106` | `fetchLog()` tries to parse JSON without checking `Content-Type`. If the API returns HTML error page, `body.content` is undefined → `liveContent` becomes `"undefined"` string via template literal. | Check `res.ok` before parsing, or use `body?.content ?? ""`. |

---

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Loading States | 26 | 🔴 Critical — LoadingSkeleton exists but unused |
| Error States | 4 | 🟡 Warning |
| Empty States | 2 | 🟢 Info |
| Aria Labels | 10 | 🟡 Warning |
| Hardcoded Strings | 7 | 🟢 Info |
| Code Quality | 6 | 🟡 Warning |
| **Total** | **55** | |

### Quick Wins (low effort, high impact):

1. **Import LoadingSkeleton in 3-4 representative tabs** (Overview, Agents, Crons, Noema) — demonstrates pattern, rest can follow.
2. **Extract `na()` to `$lib/core/format.ts`** — used in 2 files, trivial.
3. **Add `aria-haspopup="dialog"` to Crons agent buttons** — 1 attribute addition.
4. **Add `aria-label` to H1 metric cards** — copy pattern from Viktor.svelte.
5. **Fix Bills paid button aria-labels** — include bill name in label.
6. **Add tabindex to AgentDetailPanel memory pre** — 1 attribute.

### Largest Impact (high effort, high value):

1. **Use LoadingSkeleton across all tab components** — eliminates the biggest UX regression (blank/empty flash during data fetch).
2. **Extract shared cron-enrichment logic** — reduces ~150 lines of duplicated derivation between CronSidebar and CronTimeline tabs.
3. **Unify duplicate Otto rendering** — 3 components rendering same data with different markup.
