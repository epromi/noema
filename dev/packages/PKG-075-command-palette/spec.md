# PKG-075: Keyboard Command Palette ⌨️

> **Source**: QA Nightly 2026-07-21 — Phase 3
> **Benchmark**: Linear command palette, Grafana Quick Actions
> **Priority**: 🟡 Medium | **Size**: S | **Estimate**: 45 min
> **Scope**: ✅ Non-core (UI component only)

## Problem

Noema has 20+ tabs spread across the sidebar. Navigating between them requires clicking, which slows power users. Competitors (Linear, Grafana, Datadog) all offer keyboard-first navigation via Cmd/Ctrl+K command palettes. Noema has no keyboard navigation shortcuts.

## Solution

Add a `<CommandPalette>` component — triggered by Cmd/Ctrl+K — that:
1. Shows a searchable overlay listing all available tabs
2. Filters in real-time as the user types
3. Supports ↑↓ arrow key navigation + Enter to select + Escape to close
4. Handles dark mode correctly
5. Includes aria attributes for screen readers (role="dialog", aria-label, focus trap)

## Files to Create/Modify

### New Files (all in ✅ scope)
- `src/lib/components/layout/CommandPalette.svelte` — Main component

### Files NOT to Touch (❌ scope)
- NO `src/routes/` changes
- NO `src/lib/stores/` changes
- NO `src/lib/server/` changes  
- NO config file changes
- NO provider interface changes

## Technical Design

```
Props:
  - tabs: {label: string, emoji: string, id: string}[]  — list of tabs
  - show: boolean — whether palette is visible

Events:
  - on:close — close palette
  - on:navigate — {tabId: string} — navigate to selected tab

Behavior:
  - Cmd/Ctrl+K toggles visibility
  - Escape closes
  - ↑↓ navigates filtered results
  - Enter selects highlighted item
  - Click outside closes
  - Search filters by label (case-insensitive)
  - Auto-focus search input on open
  - Focus trap (Tab cycles within palette)
```

## Accessibility Requirements
- `role="dialog"` + `aria-label="Command palette"`
- `aria-modal="true"`
- Focus trap within palette
- `aria-activedescendant` on search input for current selection
- `role="listbox"` + `role="option"` + `aria-selected` on results
- `prefers-reduced-motion` for open/close animation

## Verification
- `pnpm check` passes
- Component renders without errors
- Cmd/Ctrl+K toggles palette
- Escape closes it
- Arrow keys navigate, Enter selects
