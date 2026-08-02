# Noema UI Components — Gap Scan
**Generated:** 2026-08-02 06:30 CEST  
**Scope:** All 31 files in `src/lib/components/` (incl. `layout/`, `shared/`, `tabs/`, `ui/`)  
**Findings:** 67 total — 22&#x20;SAFE / 14&#x20;NOT\_SAFE / 31&#x20;Informational

---

## TL;DR

| Category | Count |
|---|---|
| Missing loading states | 18 |
| Missing error states | 3 |
| Missing empty states | 1 |
| Missing aria-labels | 2 |
| Duplicated functions | 4 groups |
| Hardcoded Hungarian strings | 10+ files |
| Hardcoded magic numbers | 8 |
| Naming collisions | 1 |
| `@html` XSS risk | 1 |
| LoadingSkeleton exists but UNUSED | 1 systemic |

**Biggest gap:** `LoadingSkeleton.svelte` is a well-designed shared component — but ZERO tab components import it. Every tab flashes empty "No data" text before data arrives.

---

## 1. Missing Loading States (18 components)

**LoadingSkeleton.svelte** is well-built (3 variants: card/table/metrics, aria-busy, prefers-reduced-motion) but **never imported** by any tab component.

### Systematic: All tab components lack initial loading state

These show "No data" / "No agents loaded" / empty UI on first render before data arrives:

| File | Current behavior | Fix |
|---|---|---|
| `tabs/Overview.svelte` | Shows "N/A" and empty metrics | Wrap with `LoadingSkeleton skeleton="metrics"` + `skeleton="card"` | SAFE |
| `tabs/Agents.svelte` | Shows "No agents loaded." on first render | Wrap with `LoadingSkeleton skeleton="table"` | SAFE |
| `tabs/AuditTrail.svelte` | Shows active filters with 0 events | Wrap with `LoadingSkeleton skeleton="card"` | SAFE |
| `tabs/Bills.svelte` | Shows "No bills in tasks.md" transiently | Wrap with `LoadingSkeleton skeleton="table"` | SAFE |
| `tabs/Brainstorm.svelte` | Shows empty grid then populates | Wrap with `LoadingSkeleton skeleton="card"` | SAFE |
| `tabs/Crons.svelte` | Shows "No crons loaded." transiently | Wrap with `LoadingSkeleton skeleton="table"` | SAFE |
| `tabs/CronTimeline.svelte` | Shows "No scheduled crons" | Wrap with `LoadingSkeleton skeleton="card"` | SAFE |
| `tabs/DecisionTrace.svelte` | Shows empty filter + no sessions text | Wrap with `LoadingSkeleton skeleton="card"` | SAFE |
| `tabs/H1.svelte` | Shows "N/A" in metrics, "No programs loaded" | Wrap with `LoadingSkeleton skeleton="metrics"` + `skeleton="table"` | SAFE |
| `tabs/KanbanBoard.svelte` | Shows 3 columns with "—" | Wrap with `LoadingSkeleton skeleton="card"` | SAFE |
| `tabs/LogsViewer.svelte` | Shows filters with 0 lines | Wrap with `LoadingSkeleton skeleton="table"` | SAFE |
| `tabs/Noema.svelte` | Shows "Nincs csomag" then populates  | Wrap with `LoadingSkeleton skeleton="card"` | SAFE |
| `tabs/Orchestrator.svelte` | Delegates to children (no own loading) | Add `{#if loading}<LoadingSkeleton/>` wrapper | SAFE |
| `tabs/OttoTimeline.svelte` | Shows "No timeline data" transiently | Wrap with `LoadingSkeleton skeleton="card"` | SAFE |
| `tabs/ProcessorTimer.svelte` | Shows "idle" text before status polled | Add `{#if !initialized}` pulse placeholder | SAFE |
| `tabs/Research.svelte` | Shows empty badges | Wrap with `LoadingSkeleton skeleton="card"` | SAFE |
| `tabs/ResearchProposals.svelte` | Shows "Első futás holnap 01:00-kor" on first load | Add `{#if loading}` check | SAFE |
| `tabs/SessionHealth.svelte` | Shows "No agent sessions available." transiently | Wrap with `LoadingSkeleton skeleton="card"` | SAFE |
| `tabs/Viktor.svelte` | Shows 0/0/N/A metrics | Wrap with `LoadingSkeleton skeleton="metrics"` | SAFE |

**Recommended approach:** Add a `loading` prop to each tab component (or derive from parent data availability), then:

```svelte
{#if loading}
  <LoadingSkeleton skeleton="table" label="agents" />
{:else if error}
  <p class="empty">…</p>
{:else if items.length === 0}
  <p class="empty">…</p>
{:else}
  <!-- content -->
{/if}
```

---

## 2. Missing Error States (3 components)

| File | Issue | Fix |
|---|---|---|
| `shared/CpuWidget.svelte` | No error handling for malformed/suppressed CPU data. If `cpu` is undefined, it silently renders nothing; if `cpu.topProceses` has NaN values, `toFixed()` throws | Add `{#if cpu?.error}` fallback | SAFE |
| `tabs/Viktor.svelte` | No `viktor.error` check — assumes data always valid. If the relay returns `{error: "..."}`, renders 0/0/N/A metrics silently | Check for `viktor.error` prop before rendering | SAFE |
| `tabs/OttoTimeline.svelte` | No null/undefined guard on `ottoRuns` prop — if relay returns null, `ottoRuns.length` throws | Add `{#if !ottoRuns}` guard or default `ottoRuns = []` | SAFE |

---

## 3. Missing Empty States (1 component)

| File | Issue | Fix |
|---|---|---|
| `shared/ActionButtonGroup.svelte` | When both `actions` and `options` are empty arrays, renders an empty `<div class="action-group">` — no visual indication | Add `{#if actions.length === 0 && options.length === 0}<span class="muted">No actions</span>` | SAFE |

---

## 4. Missing aria-labels (2 components)

| File:Line | Issue | Fix |
|---|---|---|
| `tabs/OttoTimeline.svelte:27` | `<div class="tl-sub">` with icon + label has no `aria-label` or `role` | Add `role="listitem"` to container or `aria-label={step.label}` | SAFE |
| `tabs/Orchestrator.svelte:96` | Orchestrator section has no `aria-label` or `role="region"` — it's a container for 5 sub-sections | Add `role="region" aria-label="Orchestrator dashboard"` | SAFE |

---

## 5. Duplicated Code (4 groups)

### 5a. `na()` helper — duplicated identically

| File | Lines |
|---|---|
| `tabs/Overview.svelte:41-44` | `function na(value: string \| number \| undefined \| null): string { … }` |
| `tabs/H1.svelte:6-9` | `function na(value: string \| number \| undefined \| null): string { … }` |

**Fix:** Extract to `$lib/utils/display.ts` and import in both. SAFE

### 5b. `ottoIcon()` — duplicated with minor type differences

| File | Lines |
|---|---|
| `tabs/OttoTimeline.svelte:6-10` | `function ottoIcon(status: OttoRunEntry["status"]): string { … }` |
| `tabs/Research.svelte:8-12` | `function ottoIcon(status: ResearchData["ottoRuns"][number]["status"]): string { … }` |

**Fix:** Extract shared function to `$lib/utils/display.ts` accepting union type. SAFE

### 5c. `proposalColor()` / `proposalPriorityColor()` — same logic, different names

| File | Lines |
|---|---|
| `tabs/ResearchProposals.svelte:36-40` | `function proposalPriorityColor(priority: string): string { … }` |
| `tabs/Research.svelte:16-20` | `function proposalColor(priority: string): string { … }` |

**Fix:** Extract to shared util, pick one name. SAFE

### 5d. `CRON_DESCRIPTIONS` map — 60 lines in-component

| File:Line | Issue |
|---|---|
| `tabs/Crons.svelte:21-59` | 60-line `Record<string, string>` hardcoded inline. Makes the component file bloated and descriptions untranslatable. |

**Fix:** Move to `$lib/data/cron-descriptions.ts`. SAFE

---

## 6. Naming Collision

| Issue | Files |
|---|---|
| Two components named `CronTimeline.svelte` | `shared/CronTimeline.svelte` (Gantt chart) and `tabs/CronTimeline.svelte` (vertical timeline) |

These serve completely different purposes but have identical names. In `tabs/Orchestrator.svelte`, the tab version is imported as `CronTimeline` and the shared one is also available — collision is avoided only because the tab one shadows it.

**Fix:** Rename the shared one to `CronHealthTimeline.svelte` or the tab one to `VerticalCronTimeline.svelte`. SAFE

---

## 7. `@html` XSS Risk (NOT_SAFE)

| File:Line | Code | Risk |
|---|---|---|
| `shared/AgentDetailPanel.svelte:147` | `{@html agent.extra}` | If `agent.extra` comes from relay (agent status.md files), an agent writing HTML in their status could inject arbitrary markup. Low-likelihood but real. |

**Fix:** Either sanitize on the relay side before serving, or use a DOMPurify-like wrapper. NOT_SAFE (needs relay-side change).

---

## 8. Hardcoded Hungarian Strings (10+ files)

All user-facing text is hardcoded in Hungarian with no i18n mechanism:

| File | Examples |
|---|---|
| `DevJobIndicator.svelte` | "üres", "Következő:", "Sorban áll:", "Fut:", "Hiba:", "Részletes nézet", "Egysoros nézet" |
| `AgentDetailPanel.svelte` | "Válassz egy agent-et a részletek megtekintéséhez" |
| `DevPackageRow.svelte` | "🔄 Fut…", "⏳ Sorban", "📁 Fájlok:", "📋 Fázisok:" |
| `ImplementButton.svelte` | "Kattints a Cursor log megtekintéséhez", "Kész" |
| `Bills.svelte` | Column headers: "Név", "Összeg", "Határidő", "Státusz" |
| `Noema.svelte` | "Keresés...", "Nincs csomag", "📋 Specifikáció Kész", "🔨 Fejlesztés Alatt", "✅ Kész" |
| `ProcessorTimer.svelte` | "folyamatban…", "elem a sorban — most indul", "idle — következő ellenőrzés" |
| `ResearchProposals.svelte` | "Első futás holnap 01:00-kor. Még nincs adat." |
| `CronTimeline.svelte` (tabs) | GROUP_LABELS: "ÉJSZAKA", "REGGEL", "NAPPAL", "ESTE" |
| `Crons.svelte` | 30+ descriptions in CRON_DESCRIPTIONS map |

**Verdict:** Informational only. i18n is a product decision, not a gap for this scan. But noted as technical debt.

---

## 9. Hardcoded Magic Numbers

| File:Line | Value | Context |
|---|---|---|
| `layout/CronSidebar.svelte:15` | `SIDEBAR_WINDOW_MS = 86400000` (24h) | Reasonable as named constant ✅ |
| `layout/CronSidebar.svelte:166` | `slice(0, 12)` | Magic 12 for collapsed icons — undocumented |
| `DevJobIndicator.svelte:14-15` | `RUNNING_NAME_MAX = 20` | Truncation limit — no comment why 20 |
| `shared/LogPanel.svelte:7` | `POLL_MS = 5000` | Poll interval — duplicated in Noema.svelte `LIVE_POLL_MS = 5000` |
| `tabs/Bills.svelte:13` | `setTimeout(..., 2500)` | "Paid" confirmation timeout — why 2.5s? |
| `tabs/Agents.svelte:51-55` | `days > 3`, `days >= 1` | Stale thresholds — undocumented |
| `tabs/SessionHealth.svelte:11-12` | `score < 40`, `score < 70` | Score thresholds — undocumented |
| `tabs/Viktor.svelte:7-8` | `recall >= 90`, `recall >= 70` | Recall thresholds — undocumented |

**Verdict:** Informational — recommends adding comments, but SAFE to fix by adding JSDoc on the constants.

---

## 10. `window.fetch` Bypassing SvelteKit

| File:Line | Code |
|---|---|
| `tabs/Bills.svelte:100` | `await window.fetch(...)` |
| `tabs/Orchestrator.svelte:70` | `await window.fetch(...)` |

Both use `window.fetch` to bypass SvelteKit's `fetch` — intentional to avoid auto-invalidation on POST. Commented as `⚠️ window.fetch → bypass SvelteKit auto-invalidation`. Not a bug but noted.

---

## 11. Svelte 5 Pattern Compliance ✅

All 29 `.svelte` files correctly use Svelte 5 `$props()` rune. No `export let` patterns found. Good.

- `$state`: used in 10 files  
- `$derived` / `$derived.by`: used in 12 files  
- `$effect`: used in 5 files  
- `$props()`: used in all 29 .svelte files with prop interfaces ✅

---

## Summary Matrix

| Component | Loading | Error | Empty | Aria | Duplication | Safe Score |
|---|---|---|---|---|---|---|
| DevJobIndicator | ✅ | ✅ | ✅ | ✅ | — | ⭐⭐⭐⭐⭐ |
| layout/CronSidebar | ❌ | ✅ | ✅ | ✅ | — | ⭐⭐⭐ |
| shared/ActionButtonGroup | ✅ | ✅ | ❌ | ✅ | `export const`s inline | ⭐⭐⭐ |
| shared/AgentDetailPanel | ❌ | ✅ | ✅ | ✅ | `@html` risk | ⭐⭐ |
| shared/agent-icons.ts | N/A | N/A | N/A | N/A | — | ⭐⭐⭐⭐ |
| shared/BuildIntegrityBanner | N/A | N/A | N/A | ✅ | — | ⭐⭐⭐⭐ |
| shared/CpuWidget | ❌ | ❌ | ✅ | ✅ | — | ⭐⭐ |
| shared/CronTimeline | ❌ | ✅ | ✅ | ✅ | Name collision | ⭐⭐ |
| shared/DevPackageRow | ✅ | ⚠ | ⚠ | ✅ | — | ⭐⭐⭐ |
| shared/ImplementButton | ✅ | ✅ | N/A | ✅ | — | ⭐⭐⭐⭐ |
| shared/LogPanel | ✅ | ✅ | ✅ | ✅ | `entriesSignature` dup | ⭐⭐⭐⭐⭐ |
| tabs/Agents | ❌ | ✅ | ✅ | ✅ | — | ⭐⭐⭐ |
| tabs/AuditTrail | ❌ | ✅ | ✅ | ✅ | — | ⭐⭐⭐ |
| tabs/Bills | ❌ | ✅ | ✅ | ✅ | `na()` dup | ⭐⭐⭐ |
| tabs/Brainstorm | ❌ | ✅ | ✅ | ✅ | — | ⭐⭐⭐ |
| tabs/Crons | ❌ | ✅ | ✅ | ✅ | 60-line map inline | ⭐⭐ |
| tabs/CronTimeline | ❌ | ✅ | ✅ | ✅ | Name collision | ⭐⭐⭐ |
| tabs/DecisionTrace | ❌ | ✅ | ✅ | ✅ | — | ⭐⭐⭐ |
| tabs/H1 | ❌ | ✅ | ✅ | ✅ | `na()` dup | ⭐⭐⭐ |
| tabs/KanbanBoard | ❌ | ✅ | ✅ | ✅ | — | ⭐⭐⭐ |
| tabs/LogsViewer | ❌ | ✅ | ✅ | ✅ | — | ⭐⭐⭐⭐ |
| tabs/Noema | ❌ | ✅ | ✅ | ✅ | — | ⭐⭐⭐ |
| tabs/Orchestrator | ❌ | ⚠ | ⚠ | ❌ | — | ⭐⭐ |
| tabs/OttoTimeline | ❌ | ❌ | ✅ | ❌ | `ottoIcon()` dup | ⭐ |
| tabs/Overview | ❌ | ✅ | ✅ | ✅ | `na()` dup | ⭐⭐⭐ |
| tabs/ProcessorTimer | ❌ | ✅ | N/A | ✅ | — | ⭐⭐⭐ |
| tabs/Research | ❌ | ✅ | ✅ | ✅ | `ottoIcon()` + `proposalColor()` dup | ⭐⭐⭐ |
| tabs/ResearchProposals | ✅ | ✅ | ✅ | ✅ | `proposalPriorityColor()` dup | ⭐⭐⭐⭐ |
| tabs/SessionHealth | ❌ | ✅ | ✅ | ✅ | — | ⭐⭐⭐ |
| tabs/Viktor | ❌ | ❌ | ✅ | ✅ | — | ⭐⭐ |
| ui/LoadingSkeleton | N/A | N/A | N/A | ✅ | — | ⭐⭐⭐⭐⭐ |

---

## Priority Fix Order

### 🔴 High Impact / Low Effort (SAFE)
1. **Import LoadingSkeleton in all tab components** — 18 files, same pattern, huge UX win
2. **Extract `na()` to `$lib/utils/display.ts`** — 2 files, 4 lines each
3. **Extract `ottoIcon()` to shared util** — 2 files, identical logic
4. **Extract `proposalColor()` to shared util** — 2 files, identical logic  
5. **Rename one `CronTimeline.svelte`** — avoid import confusion
6. **Extract `CRON_DESCRIPTIONS` to data file** — removes 60 lines from component

### 🟡 Medium Impact (SAFE)
7. **Add error guard to `tabs/Viktor.svelte`** — `{#if viktor.error}`  
8. **Add error guard to `shared/CpuWidget.svelte`** — `{#if cpu?.error}`  
9. **Add null guard to `tabs/OttoTimeline.svelte`** — `{#if !ottoRuns}`  
10. **Add empty state to `shared/ActionButtonGroup.svelte`** — empty actions case  
11. **Add aria-labels to `tabs/OttoTimeline.svelte`** steps + `tabs/Orchestrator.svelte`  

### 🟢 Low Priority (NOT_SAFE / Decision needed)
12. **Sanitize `@html agent.extra`** — needs relay-side DOMPurify or CSP header  
13. **i18n for Hungarian strings** — product decision, huge effort  
14. **Document magic numbers** — add JSDoc comments on threshold constants
