# PKG-078: Color Scheme Toggle (Light Mode)

**Status**: 📋 F0 | **Size**: S | **Estimate**: 1h  
**Generated**: 2026-07-24 (Nova QA Phase 3) | **Source**: gap-a11y F-30

## Problem

Noema forces dark mode via `<meta name="color-scheme" content="dark">` in `app.html`. There is no light theme toggle, no `prefers-color-scheme` detection, and no way for users to switch. Users with astigmatism or in bright environments are locked into dark mode. WCAG 1.4.8 Visual Presentation (AAA) recommends user-selectable color schemes.

## Solution

1. Add light-theme CSS custom properties in a `@media (prefers-color-scheme: light)` block in `app.css`
2. Change `app.html` meta to `content="dark light"` for auto-detection
3. Add a manual toggle button (sun/moon icon) in the layout header
4. Persist user preference to `localStorage` (overrides OS preference)
5. Apply `data-theme` attribute on `<html>` for explicit theme control

## Files

| File | Action | Scope |
|------|--------|-------|
| `src/app.css` | Add light theme CSS variables block | ✅ |
| `src/app.html` | Change `color-scheme` meta to `dark light` | ✅ |
| `src/lib/components/layout/ThemeToggle.svelte` | NEW — toggle button component | ✅ |
| `src/routes/+layout.svelte` | Import/wire ThemeToggle + localStorage theme logic | ❌ (spec-only) |
| `src/lib/components/tabs/*.svelte` | No changes — CSS variables make them auto-adapt | — |

## Light Theme CSS Variables

```css
:root[data-theme="light"] {
  --bg: #ffffff;
  --card: #f6f8fa;
  --border: #d0d7de;
  --text: #1f2328;
  --muted: #656d76;
  --accent: #0969da;
  --green: #1a7f37;
  --yellow: #9a6700;
  --red: #cf222e;
  --purple: #8250df;
  --orange: #bc4c00;
  --g-bg: #dafbe1;
  --y-bg: #fff8c5;
  --r-bg: #ffebe9;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    /* Auto-detect OS preference, respect explicit overrides */
    --bg: #ffffff;
    --card: #f6f8fa;
    /* ... same as above ... */
  }
}
```

## Theme Toggle Component

- Sun `☀️` / Moon `🌙` icon button
- `aria-label="Switch to light mode"` / `"Switch to dark mode"`
- Click toggles `data-theme` on `<html>`, saves to `localStorage`
- Respects `prefers-color-scheme` on first visit (no localStorage set)

## Acceptance Criteria

- [ ] Dark mode is default (current behavior preserved)
- [ ] Users can switch to light mode via toggle button
- [ ] Preference persists across page reloads (localStorage)
- [ ] All existing components render correctly in light mode
- [ ] `pnpm check` passes with 0 new errors
- [ ] Toggle button has proper aria-label reflecting current/next state

## Related Gaps

- F-30 (gap-a11y): No light mode — `color-scheme: dark` only
- F-15 (gap-a11y): Muted text contrast on dark bg (fixed by light theme)
- F-31 (gap-a11y): Log viewer uses hardcoded dark bg
