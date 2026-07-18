# PKG-070: Decorative Element Screen Reader Cleanup

> **Generated**: 2026-07-18 by Nova 🔧 QA Phase 3
> **Source**: Phase 1 gap-a11y finding F5
> **Priority**: 🟡 Medium | **Effort**: XS (20m) | **Status**: 🤖 auto-ready

## Problem

Multiple components contain decorative Unicode characters and emoji that are read aloud by screen readers, creating auditory clutter. WCAG 1.1.1 (Level A) requires decorative non-text content to be hidden from assistive technology.

**Affected files** (all in scope ✅):
- `src/lib/components/tabs/Noema.svelte` — chevrons ▸/▾ on expandable rows
- `src/lib/components/tabs/DevPackageRow.svelte` — status emoji (✅, ⚠️, ❌) without aria-hidden
- `src/lib/components/shared/LogPanel.svelte` — arrow indicators in log entries
- `src/lib/components/tabs/Brainstorm.svelte` — decorative emoji icons in list items
- `src/lib/components/tabs/Research.svelte` — badge/status emoji

## Solution

Add `aria-hidden="true"` to decorative `<span>` elements containing only Unicode/emoji that serve no functional purpose. Ensure any meaningful information is also conveyed via text or aria-label.

## Implementation

For each affected file:
1. Identify `<span>` elements containing only emoji/Unicode
2. If decorative (chevrons, status icons that already have text labels nearby): add `aria-hidden="true"`
3. If functional (close buttons, interactive elements): leave as-is (those already have aria-labels)
4. Run `pnpm check` after each change

**Example fix (Noema.svelte):**
```diff
- <span class="chevron">{open ? "▾" : "▸"}</span>
+ <span class="chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
```

## Scope Gate

| Check | Result |
|-------|--------|
| ❌ routes/ | Not touched |
| ❌ stores/ | Not touched |
| ❌ server/ | Not touched |
| ❌ config | Not touched |
| ❌ BLOCKLIST | Not touched |
| ✅ tabs/ + shared/ components | Only aria-hidden attributes added |
