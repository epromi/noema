# PKG-083: ARIA Tabs Pattern + Keyboard Navigation

**Status:** 🤖 auto-ready | **Source:** Nova QA 2026-08-16 gap scan
**Priority:** High (a11y #1 severity) | **Est. effort:** 2h

## Problem

The primary and secondary navigation in `src/routes/+layout.svelte` (lines 104-134) are plain `<button>`s with `aria-current="page"`. There is:

- No `role="tablist"`, `role="tab"`, `aria-selected`, or `aria-controls`
- No arrow-key (Left/Right/Home/End) navigation — keyboard users must Tab through all 13 buttons
- `aria-current="page"` is semantically wrong (these swap in-panel content, not paginate)
- Screen readers get no indication these are mutually-exclusive tabs

This is the #1 severity a11y finding in the 2026-08-16 scan (WCAG 4.1.2 / 2.1.1).

## Solution

Adopt the ARIA tabs pattern with roving `tabindex`:

```html
<div role="tablist" aria-label="Main navigation">
  <button role="tab" id={`tab-${tab.id}`} aria-selected={activeTab===tab.id}
          aria-controls={`panel-${tab.id}`} tabindex={activeTab===tab.id ? 0 : -1}>…</button>
</div>
<div role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`}>…</div>
```

Add a `keydown` handler for `ArrowLeft`/`ArrowRight`/`Home`/`End`. Apply the same to the secondary `Tools` group as a separate `tablist`.

Also (same file, lines 15-33): wrap tab emoji in `<span aria-hidden="true">` so decorative icons stop polluting accessible names, and differentiate the duplicated icons (📋 used for both Bills and Logs).

## Files

| File | Action | Scope |
|------|--------|-------|
| `src/routes/+layout.svelte` | MODIFY — tabs pattern + keydown + emoji aria-hidden | ❌ routes (spec-only) |

## Scope Gate

| Check | Result |
|-------|--------|
| Touches `src/routes/`? | ⚠️ YES — `+layout.svelte` |
| All files in ✅ scope? | ❌ No |

**Verdict:** ❌ core — routes structure is auto-implement ❌. Spec-only, requires András to run via Cursor.

## Traceability

- Source: Nova QA 2026-08-16, gap-a11y.md §4.1 + §4.2
- Dedup: No existing PKG for the ARIA tabs pattern (PKG-046 = general keyboard shortcuts, PKG-053 = focus trap, PKG-075 = command palette — all distinct).
