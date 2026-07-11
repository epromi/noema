# Spec: Action Queue Decision Redesign v2

**Status**: Ready for Cursor/Sparkl  
**Date**: 2026-07-08  
**Scope**: 4 files, backward compatible, 0 new deps

---

## Problem

Current decision buttons (`done`, `escalate`, `investigate`) are generic verbs with no contextual meaning. When András needs to pick between A/B/C options (e.g., "A: Reactivate Albert, B: Decommission, C: Hibernate"), those options only exist in the description text — the buttons just say "Done" and "Escalate". Additionally, per-column defaults don't match the column's semantic purpose (decisions vs tasks).

## Design

### 1. Column Semantics (unchanged structure, clarified meaning)

| Column | Who | What |
|--------|-----|------|
| ⚡ Auto | Display only | Otto auto-resolved items, no buttons |
| 👔 Alfred | Alfred | Tasks to execute |
| 🧑 András | András | Decisions to make |

### 2. New Default Actions Per Column

| Column | Buttons |
|--------|---------|
| ⚡ Auto | *none* |
| 👔 Alfred | `✅ Done` — task completed<br>`🔍 Investigate` — deep research needed (spawn Albert/Scout) |
| 🧑 András | `✅ Resolve` — decision made, close<br>`👔 To Alfred` — delegate task to Alfred |

When a line in `action-queue.md` has `→ [A: label|B: label|C: label]` trailing syntax, these **override** the default buttons with labeled option buttons.

### 3. A/B/C Option Syntax (extends existing parser)

**Format** (in `action-queue.md` description text):
```
- [ ] [07-08] [P1] decide_noema_crons — Noema QA timeout → [A: Csak build+test|B: Timeout 900s|C: V4 Pro modell]
```

**Parser rules**:
- Pattern: `→\s*\[([^\]]+)\]` at end of description
- Split by `|`
- Each option: `(letter): rest of text` — e.g. `A: Csak build+test`
- `letter` must be a single uppercase letter A-Z
- After first `:`, everything is the label
- Fallback: if no `:`, use the whole text as label with the letter prefix

**Fallback on parse failure**:
- No `[`...`]` pattern → use column defaults
- Missing colon on any option → use column defaults (log console.warn)
- More than 5 options → use column defaults (log console.warn)
- Empty options list after parse → use column defaults

### 4. Click → Outcome Pipeline

```
User clicks button
  → POST /action { action: "option_a", id: "decide_noema_crons", description: "Csak build+test" }
  → noema-actions.jsonl: { id, action, description, status: "pending", ts: nowISO() }
  → Relay responds OK
  → Dashboard: item moves to Resolved section (visual only — the JSONL entry is the SSOT)
  → action-processor.service picks up JSONL entry:
      - If handler exists for action → execute (e.g., cron edit, agent spawn)
      - If no handler → next Otto nightly creates Alfred task: "option_a selected for X → implement"
```

Note: The relay (`relay.cjs`) is **unchanged** — it already handles `POST /action` with arbitrary action strings.

### 5. UI: Option Buttons

When `item.options.length > 0`:
- Render option buttons instead of default action buttons
- Button label: `A: <label text>` (truncated with ellipsis if >40 chars, full text in `title`)
- Style: `primary` (green) — these are decision buttons, same visual weight as current "implement"
- Button sends `option_a`/`option_b`/`option_c` as the action type

When `item.options.length === 0`:
- Render default action buttons per column (as defined above)

### 6. Button Label Management

Long option labels: `max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` + `title` attribute with full text.

---

## Technical Changes

### File 1: `src/lib/types/index.ts`

**Add `ActionOption` interface and new action types:**

```typescript
/** A single A/B/C decision option parsed from → [A: label|B: label] syntax. */
export interface ActionOption {
  key: string;   // "option_a", "option_b", etc.
  label: string; // "A: Csak build+test"
}

/** Add new action types, deprecate old ones (keep for backward compat). */
export type DashboardActionType =
  // New — clear semantic actions
  | "resolve"      // ✅ Resolve — rozhodnuté / hotovo
  | "delegate"     // 👔 To Alfred — delegovanie úlohy
  | "investigate"  // 🔍 Investigate — hlbší research
  // New — option-based (generated from → [A|B|C] syntax)
  | "option_a"
  | "option_b"
  | "option_c"
  | "option_d"
  | "option_e"
  // Old — keep for backward compat with existing code/proposals
  | "done"
  | "escalate"
  | "implement"
  | "restart"
  | "trigger"
  | "activate"
  | "paid";
```

**Extend `ActionQueueItem`:**

```typescript
export interface ActionQueueItem {
  id: string;
  desc: string;
  meta: string;
  actions: DashboardActionType[];
  options: ActionOption[];  // NEW — when → [A:...|B:...] syntax present
}
```

### File 2: `src/lib/core/action-parse.ts`

**Update `parseActionSyntax` to return options:**

```typescript
import type { ActionOption, DashboardActionType } from "$lib/types";

// Keep old mapping for backward compat
export const LABEL_TO_ACTION: Record<string, DashboardActionType> = {
  done: "done",
  escalate: "escalate",
  investigate: "investigate",
  restart: "restart",
  trigger: "trigger",
  activate: "activate",
  paid: "paid",
  implement: "implement",
  mehet: "implement",
};

/** Result of parsing action-queue line description. */
export interface ParsedActionLine {
  cleanText: string;
  actions: DashboardActionType[];
  options: ActionOption[];
}

/**
 * Parse trailing `→ [A: label|B: label|C: label]` syntax.
 * When options are found, they OVERRIDE the fallback actions.
 * Falls back to `fallback` when syntax is missing or malformed.
 */
export function parseActionSyntax(
  text: string,
  fallback: DashboardActionType[],
): ParsedActionLine {
  const match = text.match(/→\s*\[([^\]]+)\]\s*$/);
  if (!match) {
    return { cleanText: text.trim(), actions: fallback, options: [] };
  }

  const rawOptions = (match[1] ?? "").split("|").map((s) => s.trim());

  // Try parsing as A: label format (new style)
  const options: ActionOption[] = [];
  for (let i = 0; i < rawOptions.length; i++) {
    const opt = rawOptions[i];
    if (!opt) continue;
    const colonIdx = opt.indexOf(":");
    if (colonIdx === -1) {
      // Malformed — no colon. Fallback entirely.
      console.warn(`[action-parse] Malformed option (no colon): "${opt}" in "${text}"`);
      return { cleanText: text.replace(match[0], "").trim(), actions: fallback, options: [] };
    }
    const letter = opt.substring(0, colonIdx).trim().toUpperCase();
    const label = opt.substring(colonIdx + 1).trim();
    if (!/^[A-Z]$/.test(letter)) {
      console.warn(`[action-parse] Malformed option letter: "${letter}" in "${text}"`);
      return { cleanText: text.replace(match[0], "").trim(), actions: fallback, options: [] };
    }
    if (options.length >= 5) {
      console.warn(`[action-parse] Too many options (max 5): ${rawOptions.length} in "${text}"`);
      return { cleanText: text.replace(match[0], "").trim(), actions: fallback, options: [] };
    }
    const key = `option_${letter.toLowerCase()}`;
    options.push({ key, label: `${letter}: ${label}` });
  }

  if (options.length === 0) {
    return { cleanText: text.replace(match[0], "").trim(), actions: fallback, options: [] };
  }

  const cleanText = text.replace(match[0], "").trim();
  // When options are present, they replace (not supplement) default actions
  return { cleanText, actions: [], options };
}
```

**Also: update `LABEL_TO_ACTION` to map new + old labels for backward compat with existing action-queue.md lines.**

### File 3: `src/lib/core/noema.ts`

**Update `DEFAULT_ACTIONS`:**

```typescript
const DEFAULT_ACTIONS: Record<ActionQueueColumn, DashboardActionType[]> = {
  auto: [],
  alfred: ["resolve", "investigate"],  // was: done, escalate, investigate
  andras: ["resolve", "delegate"],      // was: done, escalate
};
```

**Update `buildActionItem` to include `options`:**

```typescript
function buildActionItem(...): ActionQueueItem | null {
  // ... existing check logic unchanged ...
  const { cleanText, actions, options } = parseActionSyntax(
    rawDesc,
    DEFAULT_ACTIONS[section],
  );
  return { id, desc: cleanText, meta, actions, options };
}
```

The `actions` field is set by `parseActionSyntax`:
- If options are present: `actions = []`, `options = [...]`
- If no option syntax: `actions = DEFAULT_ACTIONS[section]`, `options = []`

### File 4: `src/lib/components/shared/ActionButtonGroup.svelte`

**Update labels:**

```typescript
export const ACTION_LABELS: Record<DashboardActionType, string> = {
  // New
  resolve: "✅ Resolve",
  delegate: "👔 To Alfred",
  investigate: "🔍 Investigate",
  option_a: "A",
  option_b: "B",
  option_c: "C",
  option_d: "D",
  option_e: "E",
  // Old (kept for backward compat)
  implement: "▶ Mehet",
  done: "✅ Done",
  escalate: "🔥 Escalate",
  restart: "🔄 Restart",
  trigger: "⚡ Trigger",
  activate: "🚀 Activate",
  paid: "💰 Paid",
};

export const ACTION_TOOLTIPS: Record<DashboardActionType, string> = {
  resolve: "Döntés megszületett / feladat kész — lezárás",
  delegate: "Átadás Alfred-nak végrehajtásra",
  investigate: "Kivizsgálás indítása (Albert/Scout agent spawn)",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  option_e: "",
  implement: "Implementálás indítása (Cursor agent)",
  done: "Item lezárása (legacy)",
  escalate: "Eszkalálás (legacy)",
  restart: "Agent vagy cron újraindítása",
  trigger: "Cron azonnali futtatása",
  activate: "Brainstorming item aktiválása",
  paid: "Számla kifizetve — tasks.md frissítés",
};
```

**Update props — add `options`:**

```typescript
import type { ActionOption, DashboardActionType } from "$lib/types";

let {
  actions,
  options = [],   // NEW
  itemId,
  description,
  getState,
  onAction,
}: {
  actions: DashboardActionType[];
  options: ActionOption[];   // NEW
  itemId: string;
  description: string;
  getState: (itemId: string, action: DashboardActionType) => ActionBtnState;
  onAction: (action: DashboardActionType, itemId: string, description: string) => void;
} = $props();
```

**Render logic — options mode vs actions mode:**

```svelte
<div class="action-group">
  {#if options.length > 0}
    <!-- Option buttons (A/B/C) -->
    {#each options as opt (opt.key)}
      {@const state = getState(itemId, opt.key as DashboardActionType)}
      <button
        type="button"
        class="action-btn primary option-btn"
        class:loading={state === "loading"}
        class:ok={state === "ok"}
        class:error={state === "error" || state === "offline"}
        disabled={state === "loading"}
        title={opt.label}
        onclick={() => onAction(opt.key as DashboardActionType, itemId, opt.label)}
      >
        {buttonLabel(state, opt.label)}
      </button>
    {/each}
  {:else}
    <!-- Default action buttons -->
    {#each actions as action (actionKey(itemId, action))}
      {@const state = getState(itemId, action)}
      <button ...existing button code...>
        {buttonLabel(action, state)}
      </button>
    {/each}
  {/if}
</div>
```

**Add `.option-btn` CSS:**

```css
.action-btn.option-btn {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Update `buttonLabel` helper** to accept a custom label for option buttons:

```typescript
function buttonLabel(actionOrLabel: DashboardActionType | string, state: ActionBtnState): string {
  if (state === "loading") return "⏳";
  if (state === "ok") return "✅";
  if (state === "error") return "❌";
  if (state === "offline") return "🔌";
  // If it's a string that's not a DashboardActionType, it's an option label
  if (typeof actionOrLabel === "string" && !(actionOrLabel in ACTION_LABELS)) {
    return actionOrLabel;
  }
  return ACTION_LABELS[actionOrLabel as DashboardActionType] ?? actionOrLabel;
}
```

**Note**: The option buttons use a different onclick flow — they pass the option label as `description` instead of the item description, so the relay logs the actual choice text.

### File 5: `src/lib/components/tabs/Orchestrator.svelte`

**No structural changes needed.** But need to verify `ActionButtonGroup` usage passes `options` prop:

```svelte
<ActionButtonGroup
  actions={item.actions}
  options={item.options}   <!-- NEW: add this line -->
  itemId={item.id}
  description={item.desc}
  {getState}
  {onAction}
/>
```

Check both Alfred AND András column render blocks.

---

## Migration: Otto Nightly Generator

Otto's Core Analysis (`memory/protocols/otto-nightly.md`) must be updated to use the new `→ [A: label|B: label]` syntax for items that have explicit decision options.

**Current format** (manual):
```
- [ ] [07-02] [P1] decide_albert_future — Albert 35d inactive. Decision: (A) Task + reactivate, (B) Decommission, (C) Hibernate.
```

**New format**:
```
- [ ] [07-02] [P1] decide_albert_future — Albert 35d 🔴 inactive → [A: Reactivate|B: Decommission|C: Hibernate]
```

---

## Backward Compatibility

- Old action-queue.md lines without `→ [...]` syntax → render with new default button labels
- Old `DashboardActionType` values still in the type union → `ResearchProposal` and other consumers keep working
- `relay.cjs` unchanged — already accepts arbitrary action strings
- `action-processor.service` may need new handlers for `option_a`/`option_b`/`option_c` over time, but not blocking

---

## Files Changed

| # | File | Scope |
|---|------|-------|
| 1 | `src/lib/types/index.ts` | `ActionOption` interface, new `DashboardActionType` values, `ActionQueueItem.options` |
| 2 | `src/lib/core/action-parse.ts` | Extended `parseActionSyntax` with option parsing, fallback logic |
| 3 | `src/lib/core/noema.ts` | Updated `DEFAULT_ACTIONS`, `buildActionItem` passes options |
| 4 | `src/lib/components/shared/ActionButtonGroup.svelte` | New labels, option button rendering, CSS |
| 5 | `src/lib/components/tabs/Orchestrator.svelte` | Pass `options` prop to ActionButtonGroup (verify) |
