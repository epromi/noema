# Noema — Configuration & Build Gap Scan

**Date:** 2026-07-17 03:34 CEST  
**Project:** `noema` v2.0.0  
**Runtime:** pnpm, SvelteKit 2.69.1, Svelte 5.56.4

---

## Severity Key

| Label | Meaning |
|-------|---------|
| 🔴 Critical | Builds fail, tooling silently broken, security hole |
| 🟠 High | DX degradation, technical debt, likely future breakage |
| 🟡 Medium | Best-practice gap, missing guardrails |
| 🟢 Low | Nice-to-have, cosmetic |

---

## 🔴 Critical

### C1. `prettier` not listed as direct devDependency — peer dep of `prettier-plugin-svelte`

- **File:** `package.json` (devDependencies)
- **What's wrong:** `prettier-plugin-svelte` declares `prettier: ^3.0.0` as a peerDependency. Prettier resolves today (v3.9.4 via hoisting from the plugin's own dep tree) but this is **accidental** — pnpm's strict mode or future plugin updates could break the resolution. No `format` script exists in `package.json`, so there's no CI gate to catch this.
- **Fix:** Add `"prettier": "^3.9.4"` to `devDependencies`. Add a `format` script: `"format": "prettier --write ."` and `"format:check": "prettier --check ."`.

### C2. No ESLint — zero static analysis

- **File:** Project root (missing `eslint.config.*` / `.eslintrc.*`)
- **What's wrong:** No linting configured at all. No a11y checks, no import ordering, no Svelte-specific rules. With `svelte@5` runes (`$state`, `$derived`, `$effect`), ESLint is critical to catch reactive-rule violations.
- **Fix:** Install `eslint`, `eslint-plugin-svelte`, `@eslint/js`, `typescript-eslint` (flat config). Svelte 5 recommended starter:
  ```bash
  pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-svelte
  ```
  Minimal `eslint.config.js`:
  ```js
  import js from '@eslint/js';
  import ts from 'typescript-eslint';
  import svelte from 'eslint-plugin-svelte';
  import * as svelteParser from 'svelte-eslint-parser';

  export default [
    js.configs.recommended,
    ...ts.configs.recommended,
    ...svelte.configs['flat/recommended'],
    {
      files: ['**/*.svelte'],
      languageOptions: { parser: svelteParser },
    },
  ];
  ```
  Add `"lint": "eslint ."` and `"lint:fix": "eslint --fix ."` scripts.

---

## 🟠 High

### H1. 10 outdated dependencies — 5 with major version gaps

- **File:** `package.json` / `pnpm outdated`
- **What's wrong:** See table below. Major-jump packages (adapter-auto, vite-plugin-svelte, vitest, vite, typescript) carry breaking changes — the longer the gap, the harder the upgrade.

| Package | Current | Latest | Gap |
|---------|---------|--------|-----|
| `@sveltejs/adapter-auto` | 6.1.1 | **7.0.1** | Major |
| `@sveltejs/vite-plugin-svelte` | 5.1.1 | **7.2.0** | 2 Majors |
| `@types/node` | 22.20.0 | **26.1.1** | 2 Majors |
| `@vitest/coverage-v8` | 3.2.6 | **4.1.10** | Major |
| `vite` | 6.4.3 | **8.1.4** | 2 Majors |
| `vitest` | 3.2.6 | **4.1.10** | Major |
| `@sveltejs/kit` | 2.69.1 | 2.69.3 | Patch |
| `svelte` | 5.56.4 | 5.56.5 | Patch |
| `svelte-check` | 4.7.1 | 4.7.3 | Patch |
| `typescript` | 5.9.3 | 7.0.2 | 2 Majors |

- **Fix:** Prioritize patch updates immediately (`pnpm update @sveltejs/kit svelte svelte-check`). Plan a major-upgrade window for the vitest/vite/vite-plugin-svelte triad (they're coupled). TypeScript 7.0 is a separate undertaking — check for breaking changes in `noUncheckedIndexedAccess` semantics.

### H2. `@sveltejs/adapter-auto` installed but unused

- **File:** `package.json:16` (`devDependencies`)
- **What's wrong:** `svelte.config.js` hardcodes `@sveltejs/adapter-node`. `adapter-auto` is only useful as a fallback that auto-detects the platform. Having both installed is wasted install time + dependency surface.
- **Fix:** Remove `@sveltejs/adapter-auto` from `devDependencies` unless there's a multi-platform deployment scenario where the auto-detection matters. If so, add a comment explaining the intent.

### H3. SvelteKit adapter called without production options

- **File:** `svelte.config.js:7`
- **What's wrong:** `adapter()` called with no arguments. Key options missing:
  - `precompress`: No gzip/brotli precompression — every request compresses on-the-fly, wasting CPU.
  - `envPrefix`: No prefix filtering — ALL env vars leak to client unless manually filtered.
  - `fallback`: No custom fallback page for SPA-like 404 handling.
- **Fix:**
  ```js
  adapter: adapter({
    out: 'build',
    precompress: true,
    envPrefix: 'PUBLIC_',
    // fallback: '200.html' // only if SPA mode needed
  }),
  ```

### H4. Vite `allowedHosts` duplicated across two configs

- **Files:** `svelte.config.js:11-13` (vite.server.allowedHosts) + `vite.config.ts:7-9` (server.allowedHosts)
- **What's wrong:** `svelte.config.js` forwards `vite.server.allowedHosts` to Vite, but `vite.config.ts` also defines `server.allowedHosts`. They're slightly out of sync:
  - `svelte.config.js`: `['alfred.local', '.local', '192.168.0.231', 'promisnotebook.tail117b73.ts.net', '.ts.net']`
  - `vite.config.ts`: `['alfred.local', 'noema.local', '.local', 'promisnotebook.tail117b73.ts.net', '.ts.net']`
  - Vite merges them, but `100.91.60.103` is in CSRF only, and `noema.local` is only in vite.config.ts. Confusing to maintain.
- **Fix:** Consolidate into one place (preferably `vite.config.ts` for the Vite server, keep CSRF in `svelte.config.js`). Keep a single `ALLOWED_HOSTS` constant and share it.

### H5. No `engines` field — no Node.js version enforcement

- **File:** `package.json`
- **What's wrong:** No `engines` field. No `.npmrc` with `engine-strict=true`. Builds could run on incompatible Node versions and produce subtly broken output.
- **Fix:**
  ```json
  "engines": {
    "node": ">=18.0.0"
  }
  ```
  Create `.npmrc`:
  ```
  engine-strict=true
  ```

---

## 🟡 Medium

### M1. No CSP meta tag — zero Content Security Policy

- **File:** `src/app.html:6-10` (`<head>`)
- **What's wrong:** No `<meta http-equiv="Content-Security-Policy">`. A production web app serving dynamic content has zero defense against XSS, inline script injection, or malicious third-party resources. Even a report-only CSP would surface violations.
- **Fix (report-only first, then enforce):**
  ```html
  <meta http-equiv="Content-Security-Policy-Report-Only"
    content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';">
  ```
  After monitoring violation reports, remove `-Report-Only` to enforce.

### M2. Missing `app.html` meta tags — SEO & mobile gaps

- **File:** `src/app.html:6-10` (`<head>`)
- **What's wrong:**
  - No `<meta name="description">` — empty search-engine snippets.
  - No `<meta name="theme-color">` with `--bg` value — no browser chrome theming.
  - No Open Graph / Twitter Card tags — poor link previews in Slack, Telegram, Discord.
  - `lang="en"` on `<html>` is hardcoded — not dynamic.
- **Fix:**
  ```html
  <meta name="description" content="Noema — AI-powered knowledge management" />
  <meta name="theme-color" content="#0d1117" />
  <meta property="og:title" content="Noema" />
  <meta property="og:description" content="AI-powered knowledge management" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  ```
  For dynamic `lang`, consider `%sveltekit.lang%` or a hook that sets `document.documentElement.lang`.

### M3. No `$lib` alias in `svelte.config.js` — only in `vitest.config.ts`

- **Files:** `vitest.config.ts:6-8` (aliases) + `svelte.config.js` (missing)
- **What's wrong:** The `$lib` alias is defined by SvelteKit automatically (from `.svelte-kit/tsconfig.json`), so this _works_. But `vitest.config.ts` redundantly adds it as a raw Vite alias. If the SvelteKit alias mechanism ever changes, the vitest config will silently diverge. Better to use `vitest-svelte-kit` or share the alias.
- **Fix:** Replace the manual alias in `vitest.config.ts`:
  ```ts
  // Remove manual alias, use svelte-kit integration
  import { sveltekit } from 'vitest-svelte-kit';
  ```
  Or at minimum, extract to a shared `aliases.ts`.

### M4. No `lint`/`format`/`format:check` scripts

- **File:** `package.json:7-12` (scripts)
- **What's wrong:** The `check` script runs `svelte-check` (TypeScript), but there's no ESLint or Prettier CI gate. A PR could merge unformatted code.
- **Fix:** Add after C1/C2 are resolved:
  ```json
  "lint": "eslint .",
  "lint:fix": "eslint --fix .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "ci": "pnpm format:check && pnpm lint && pnpm check && pnpm test && pnpm build"
  ```

### M5. No `.editorconfig`

- **File:** Project root (missing)
- **What's wrong:** No universal editor settings. Different editors/contributors may use different indentation, line endings, or charset.
- **Fix:**
  ```ini
  root = true

  [*]
  indent_style = tab
  indent_size = 2
  end_of_line = lf
  charset = utf-8
  trim_trailing_whitespace = true
  insert_final_newline = true

  [*.{yml,yaml,json}]
  indent_style = space
  indent_size = 2
  ```

### M6. `tsconfig.json` missing `noUnusedLocals` and `noUnusedParameters`

- **File:** `tsconfig.json:12` (compilerOptions)
- **What's wrong:** Dead imports and unused variables can accumulate silently. `svelte-check` catches some but not all.
- **Fix:** Add:
  ```json
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  ```
  Note: `noUnusedParameters` may require `_` prefix convention for unused Svelte event handlers.

### M7. `app.css` uses global `*` box-sizing reset — possible Svelte component leakage

- **File:** `src/app.css:12-17`
- **What's wrong:** The universal `*, *::before, *::after { box-sizing: border-box; }` is standard practice but sits in a global CSS file. If Noema ever embeds third-party widgets or iframes, this reset could break their layout.
- **Fix:** This is fine for a standalone SvelteKit app. For embeddability, scope to `body, body *`. No action needed unless embedding is planned.

---

## 🟢 Low

### L1. `app.html` uses `data-sveltekit-preload-data="hover"` — works but consider config-level

- **File:** `src/app.html:11`
- **What's wrong:** Preload behavior is set via HTML attribute, not SvelteKit config. Both work, but config-level is easier to toggle per-environment.
- **Fix (optional):** Move to `svelte.config.js`:
  ```js
  kit: {
    output: { preloadStrategy: 'hover' }
  }
  ```
  Then remove the attribute from `<body>`.

### L2. No `.browserslistrc` — builds target all browsers

- **File:** Project root (missing)
- **What's wrong:** Vite uses `esbuild` defaults without browser targets, potentially producing unnecessarily transpiled code for modern targets or unsupported code for legacy targets.
- **Fix:**
  ```
  [production]
  last 2 versions
  not dead
  > 0.5%

  [development]
  last 1 chrome version
  last 1 firefox version
  ```

### L3. `csr` not explicitly set — relies on SvelteKit default

- **File:** `svelte.config.js:7`
- **What's wrong:** No explicit `csr: true` in `kit` config. This is the default, so it works, but explicit is better for an app that's clearly a SPA-like dashboard (no SEO requirement, auth-protected).
- **Fix:** Only important if SSR is undesirable. For a dashboard, SSR is usually unnecessary overhead — worth evaluating if `csr: false` makes sense.

### L4. No `resolve.alias` for `$lib` in `svelte.config.js` SvelteKit config

- **File:** `svelte.config.js`
- **What's wrong:** SvelteKit auto-generates `$lib` aliases from `.svelte-kit/tsconfig.json`. Fully automatic — nothing to fix. Documented for awareness.
- **Fix:** None needed.

### L5. CSS custom properties not typed — no `app.d.ts` augmentation

- **File:** Missing `src/app.d.ts` CSS property declarations
- **What's wrong:** CSS variables like `--bg`, `--accent` are not typed for IntelliSense in `<style>` blocks.
- **Fix:** Add to `src/app.d.ts`:
  ```ts
  declare namespace svelteHTML {
    interface CSSProperties {
      '--bg'?: string;
      '--card'?: string;
      '--border'?: string;
      '--text'?: string;
      '--muted'?: string;
      '--accent'?: string;
      '--green'?: string;
      '--yellow'?: string;
      '--red'?: string;
      '--purple'?: string;
      '--orange'?: string;
    }
  }
  ```

---

## ✅ What's Good (no changes needed)

- **`tsconfig.json`** — `strict: true` + `noUncheckedIndexedAccess: true` is excellent. Module resolution is correct (`bundler`).
- **`svelte.config.js`** — CSRF protection with trusted origins is configured. Correct adapter-node choice for a server-rendered app.
- **`vitest.config.ts`** — v8 coverage provider pinned. Proper `$lib` alias resolution. Test includes are scoped.
- **`scripts/verify-build.cjs`** — Thorough post-build integrity checker: source freshness detection, chunk cross-referencing, manifest validation, client entry verification. This is a strong CI gate.
- **`app.css`** — Clean design system with CSS custom properties. Dark theme with proper color scheme. `prefers-reduced-motion` support.
- **`app.html`** — `color-scheme: dark` meta tag, SVG favicon inline, viewport configured.
- **No tailwind CSS** — Minimal CSS footprint, no unused utility class bloat.
- **pnpm** — Strict dependency resolution (no phantom deps, unlike npm hoisting).

---

## Action Items Summary

| # | Priority | Action | Estimated Effort |
|---|----------|--------|------------------|
| C1 | 🔴 | Add `prettier` to devDeps + `format` scripts | 5 min |
| C2 | 🔴 | Install ESLint + flat config + `lint` scripts | 15 min |
| H1 | 🟠 | Update patch deps (`svelte`, `svelte-kit`, `svelte-check`) | 10 min |
| H1 | 🟠 | Plan major-upgrade window (vitest, vite, ts) | 1-2 h |
| H2 | 🟠 | Remove unused `adapter-auto` | 2 min |
| H3 | 🟠 | Add adapter-node options (precompress, envPrefix) | 5 min |
| H4 | 🟠 | Consolidate `allowedHosts` into one config | 10 min |
| H5 | 🟠 | Add `engines` + `.npmrc` | 2 min |
| M1 | 🟡 | Add CSP report-only meta tag | 10 min |
| M2 | 🟡 | Add meta description, theme-color, OG tags | 10 min |
| M4 | 🟡 | Add `ci` script combining lint+format+check+test+build | 5 min |
| M5 | 🟡 | Add `.editorconfig` | 1 min |
| M6 | 🟡 | Enable `noUnusedLocals`/`noUnusedParameters` in tsconfig | 2 min |
| L2 | 🟢 | Add `.browserslistrc` | 1 min |
| L5 | 🟢 | Type CSS custom properties in `app.d.ts` | 5 min |
