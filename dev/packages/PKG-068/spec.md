# PKG-068: ESLint + Prettier Setup — Code Quality Foundation

**Priority**: 🟠 High | **Size**: M (2h) | **Status**: spec-only (❌ config files out of QA scope)
**Created**: 2026-07-17 Nova QA Nightly | **Scope**: ❌ not auto-implementable

## Problem

The Noema project has zero static analysis or code formatting tooling:

1. **No ESLint**: No a11y checks, no import ordering, no Svelte 5 runes rule enforcement (`$state`, `$derived`, `$effect`)
2. **Prettier not in devDependencies**: `prettier-plugin-svelte` declares `prettier` as a peer dep — resolution is accidental via pnpm hoisting
3. **No CI quality gates**: No `lint` or `format:check` scripts to enforce standards
4. **10 outdated dependencies**: 5 with major version gaps

## Why This Matters

- 29 Svelte components with no automated rule checking
- Svelte 5 runes have specific ESLint rules that catch reactive violations
- pnpm strict mode or future plugin updates could break the accidental prettier resolution
- No guardrail against common accessibility regressions in components

## Proposed Fix

### 1. Install Dependencies
```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-svelte svelte-eslint-parser prettier
```

### 2. Create `eslint.config.js` (flat config, ESM)
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

### 3. Add scripts to `package.json`
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint --fix .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### 4. Add `.prettierrc`
```json
{
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }],
  "singleQuote": true,
  "trailingComma": "all"
}
```

### 5. Update outdated dependencies (5 major bumps)
- `@sveltejs/adapter-static` 3.0.8 → 4.x
- `@sveltejs/vite-plugin-svelte` 4.x → 5.x
- `chart.js` → latest
- etc.

## Files Changed
| File | Change | Scope |
|------|--------|-------|
| `package.json` | Add devDependencies + scripts | ❌ Config |
| `eslint.config.js` | **NEW** — flat ESLint config | ❌ Config |
| `.prettierrc` | **NEW** — Prettier config | ❌ Config |
| `.prettierignore` | **NEW** — ignore patterns | ❌ Config |

## Why Spec-Only
All changed files are in ❌ QA auto-implementation scope (config files, package.json). Must be implemented manually or via Cursor.

## Verification
- `pnpm lint` runs without crashing on the existing codebase
- `pnpm format:check` reports formatting status
- `pnpm check` still passes after dependency updates
