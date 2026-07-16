# PKG-066: Accessibility Foundation v2 — Focus + Dark Mode + Skip Link

**Created**: 2026-07-16 | **Source**: QA Nightly v2.2 A11y Gap Scan  
**Priority**: 🔴 Critical | **Size**: S | **Estimate**: 45m

## Problem

3 WCAG 2.1 AA violations found in fresh scan:
1. **No skip-to-content link** (WCAG 2.4.1) — users must tab through 10+ sidebar items to reach main content
2. **No visible focus indicators** (WCAG 2.4.7) — browser default barely visible on dark background
3. **No dark mode support** (WCAG 1.4.3) — CSS variables exist but no `prefers-color-scheme` detection

## Solution

Add a skip-to-content link, visible focus indicators, and dark mode media query support.

### Changes

1. **`src/app.html` or `src/routes/+layout.svelte`**: Add `<a href="#main-content" class="skip-link">Skip to content</a>` as first focusable element
2. **`src/app.css`**: Add `:focus-visible` styles with `outline: 2px solid var(--accent)`. Add `prefers-color-scheme: dark` media query with light theme variables.
3. **`src/routes/+layout.svelte`**: Add `id="main-content"` to main content wrapper

### Scope Check (per noema-dev-gate.md §Kivétel 2)
- ✅ CSS additions — additive, SAFE
- ✅ `src/app.html` — template (additive)
- ✅ `src/routes/+layout.svelte` — layout (additive attribute)
- ❌ No component logic changes (no risk)

### Success Criteria
- [ ] Skip link visible on first Tab press
- [ ] All interactive elements show visible focus outline
- [ ] Dark mode activates when OS preference is dark
- [ ] Light text readable on dark background (contrast ≥ 4.5:1)
- [ ] `pnpm check` passes (0 errors, 0 warnings)
