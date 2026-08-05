# Noema — Configuration & Build Gap Scan
**Date:** 2026-08-05 | **Scope:** `svelte.config.js`, `vite.config.ts`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/app.html`, `src/hooks.server.ts`, build output  
**Node:** v24.15.0 | **PM:** pnpm (lockfile present) | **Build size:** 2.9MB

---

## 1. 🔴 Outdated Dependencies

### 1.1 Patch-level (safe to bump)
| Package | Installed | Latest | Notes |
|---------|-----------|--------|-------|
| `@sveltejs/kit` | 2.69.3 | 2.70.2 | Bug fixes, no breaking changes |
| `svelte` | 5.56.6 | 5.56.8 | Patch release |
| `svelte-check` | 4.7.3 | 4.7.4 | Patch release |
| `@types/node` | 22.20.0 | 22.20.1 | Within 22.x range |
| `@vitest/coverage-v8` | 3.2.6 | 3.2.7 | Patch release |
| `vitest` | 3.2.6 | 3.2.7 | Patch release |

### 1.2 Major-level (breaking — evaluate before bumping)
| Package | Installed | Latest | Risk |
|---------|-----------|--------|------|
| `@sveltejs/adapter-auto` | 6.1.1 | **7.0.1** | ⚠️ Major — SvelteKit 2.70+ required, API changes |
| `@sveltejs/vite-plugin-svelte` | 5.1.1 | **7.2.0** | ⚠️ Major — requires Svelte 5.20+, Vite 7+, inspect changes |
| `@types/node` | 22.20.0 | **26.1.2** | ⚠️ Major — runtime type changes (low risk for types-only) |
| `@vitest/coverage-v8` | 3.2.6 | **4.1.10** | ⚠️ Major — vitest 4.x breaking changes |
| `vitest` | 3.2.6 | **4.1.10** | ⚠️ Major — config API changes, reporter changes |
| `vite` | 6.4.3 | **8.2.0** | ⚠️ Double-major — rollup 4→4.x, API changes, plugin compat |
| `typescript` | 5.9.3 | **7.0.2** | ⚠️ Major — stricter type checking, new errors likely |

**Recommendation:** Patch bumps are safe now. Major bumps need individual PKG packages — the vite/vitest/plugin-svelte triad should be bumped together.

---

## 2. 🔴 Dead/Unused Dependencies

### 2.1 `@sveltejs/adapter-auto` (unused)
- **`package.json:14`** — Declared but never imported or configured.
- `svelte.config.js` uses `@sveltejs/adapter-node` exclusively.
- **Severity:** Low (wastes install time + lockfile size)
- **Fix:** Remove from `devDependencies`, run `pnpm install`.

### 2.2 `prettier-plugin-svelte` (orphaned)
- **`package.json:17`** — Plugin installed but no `.prettierrc` or `prettier.config.*` exists.
- Without a Prettier config file, the plugin is never activated.
- **Severity:** Low (dead code in dependency tree)
- **Fix:** Either add `.prettierrc` with `"plugins": ["prettier-plugin-svelte"]` or remove the dependency.

---

## 3. 🟡 Config Drift / Duplication

### 3.1 `allowedHosts` defined in TWO places with DIFFERENT values
- **`svelte.config.js:10-12`** (`vite.server.allowedHosts`):
  ```
  ['alfred.local', '.local', '192.168.0.231', 
   'promisnotebook.tail117b73.ts.net', '.ts.net']
  ```
- **`vite.config.ts:7-9`** (`server.allowedHosts`):
  ```
  ['alfred.local', 'noema.local', '.local', 
   'promisnotebook.tail117b73.ts.net', '.ts.net']
  ```

**Differences:**
| Host | svelte.config.js | vite.config.ts |
|------|:--:|:--:|
| `alfred.local` | ✅ | ✅ |
| `noema.local` | ❌ | ✅ |
| `.local` | ✅ | ✅ |
| `192.168.0.231` | ✅ | ❌ |
| `100.91.60.103` | ✅ | ❌ |
| `.ts.net` | ✅ | ✅ |

- **Severity:** Medium — the `vite.config.ts` wins at runtime (it's the actual Vite config), meaning `192.168.0.231` and `100.91.60.103` are NOT actually allowed in dev mode.
- **Fix:** Consolidate into ONE location (`vite.config.ts`), remove the redundant block from `svelte.config.js`.

### 3.2 `csrf.trustedOrigins` also has the missing hosts
- **`svelte.config.js:7-9`** — `csrf.trustedOrigins` includes `'192.168.0.231'` and `'100.91.60.103'`
- These IPs will be rejected by Vite's HMR/WebSocket but accepted for CSRF — inconsistent behavior.
- **Severity:** Low-Medium

---

## 4. 🟡 Type Safety Gaps

### 4.1 Missing strict TypeScript flags
**`tsconfig.json`** is strong (`strict: true`, `noUncheckedIndexedAccess: true`) but missing:

| Flag | Benefit |
|------|---------|
| `noUnusedLocals: true` | Catches dead imports/variables at compile time |
| `noUnusedParameters: true` | Catches unused function params |
| `exactOptionalPropertyTypes: true` | Prevents `undefined` from being assignable to optional props |
| `noFallthroughCasesInSwitch: true` | Prevents accidental switch fallthrough |
| `noUncheckedSideEffectImports: true` | TS 5.6+ — catches side-effect-only imports |

- **Severity:** Medium — existing code might break with these flags, needs evaluation.
- **Fix:** Add flags one at a time, run `pnpm check`, fix any new errors.

### 4.2 No `engines` field
- **`package.json`** — No `"engines"` block to declare supported Node version.
- Node v24 is used but not enforced. If someone runs `node v20`, they get cryptic errors.
- **Severity:** Low
- **Fix:** Add:
  ```json
  "engines": { "node": ">=22.0.0" }
  ```

### 4.3 All deps in `devDependencies` — no `dependencies` at all
- **`package.json`** — Zero runtime `dependencies`. Everything is `devDependencies`.
- For adapter-node, SvelteKit docs recommend `@sveltejs/kit` and `svelte` in `dependencies` (the built output may still reference them for certain runtime features).
- **Severity:** Low — works because pnpm doesn't strip devDeps on `pnpm install --prod` the same way npm does, but fails on `npm ci --production`.
- **Fix:** Move `@sveltejs/kit` and `svelte` to `dependencies` for correctness.

---

## 5. 🔴 Security Header Gaps

### 5.1 No Content-Security-Policy (CSP)
- **`src/app.html`** — No `<meta http-equiv="Content-Security-Policy">` tag.
- **`src/hooks.server.ts`** — No `response.headers.set('Content-Security-Policy', ...)`.
- **Severity:** High for any internet-facing deployment. Current deployment is local/Tailscale only, which reduces urgency.
- **Fix:** Add CSP via `hooks.server.ts`:
  ```ts
  // In handle hook:
  const response = await resolve(event);
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ...");
  ```

### 5.2 Missing security headers (all)
- **`src/hooks.server.ts:8-16`** — The hook only starts services and calls `resolve(event)`. Zero security headers set.
- Missing baseline:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security` (if HTTPS ever enabled)
- **Severity:** Medium (low exposure on local network)
- **Fix:** Add a security headers helper to `hooks.server.ts`.

### 5.3 Missing meta tags
- **`src/app.html:1-13`** — Good: `robots: noindex, nofollow` ✅, `color-scheme: dark` ✅
- Missing:
  - `<meta name="theme-color" content="#...">` — for PWA/browser chrome
  - `<meta name="application-name" content="Noema">`
  - `<meta name="description" content="...">` — SEO not needed (dashboard), but helps accessibility
- **Severity:** Low

---

## 6. 🟡 Build & Bundle Concerns

### 6.1 No bundle analyzer
- No `rollup-plugin-visualizer`, `vite-bundle-visualizer`, or `vite-plugin-inspect` installed.
- Bundle analysis is blind — can't identify what's contributing to chunk sizes.
- **Severity:** Low-Medium (makes optimization guesswork)
- **Fix:** Add `rollup-plugin-visualizer` to devDependencies, wire into `vite.config.ts` build plugins.

### 6.2 Largest chunks warrant investigation
```
141KB  server/chunks/index.js-DUc0K-KM.js     (SvelteKit internals — acceptable)
130KB  server/chunks/_page.svelte.js-yRrzY8LV.js  (page component — large, check imports)
108KB  client/_app/immutable/nodes/2.DbNhPW_N.js  (client route node — largest client chunk)
 35KB  client/_app/immutable/entry/start.C0gklG72.js  (SvelteKit runtime — expected)
```
- The 108KB client node (route `2`) and 130KB server page are worth investigating.
- No CSS bundling concerns visible (app.css is separate).
- **Severity:** Low — not a problem now, but no monitoring in place.
- **Fix:** After adding bundle analyzer, review the `nodes/2` chunk to identify if heavy libs are being pulled into client-side routes unnecessarily.

### 6.3 Build script is strong ✅
- **`package.json:6`** — `"build": "svelte-kit sync && vite build && node scripts/verify-build.cjs"`
- `verify-build.cjs` does:
  - Source freshness check (catches stale builds)
  - Manifest/chunk integrity verification
  - Client entry presence check
- **Verdict:** Excellent build pipeline. No issues.

### 6.4 No dev/build caching or Turborepo
- No build cache configured (Vite's default cache is in `node_modules/.vite`).
- **Severity:** Low — acceptable for a single-package project.

---

## 7. 🟡 Runtime Configuration

### 7.1 TLS verification disabled for local gateway
- **`src/lib/providers/openclaw.ts:74-75`** and `:504-505`:
  ```ts
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  ```
- Temporarily disables TLS verification for local gateway connections.
- Restored after the request (line 100-102, 519-521) ✅ — good hygiene.
- **Severity:** Info — acceptable for `localhost:18789`, but ensure it's never set globally.
- **Note:** Consider using a proper CA-signed cert or `NODE_EXTRA_CA_CERTS` instead of disabling verification.

### 7.2 `.env.example` present ✅
- Documents `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`, `WORKSPACE_ROOT`.
- **Good.**

---

## 8. 🟢 What's Already Good

| Item | Status |
|------|--------|
| `strict: true` in tsconfig | ✅ |
| `noUncheckedIndexedAccess: true` | ✅ |
| `forceConsistentCasingInFileNames: true` | ✅ |
| `verbatimModuleSyntax: true` (via .svelte-kit/tsconfig.json) | ✅ |
| Svelte 5 (latest major) | ✅ |
| Vitest with v8 coverage | ✅ |
| Post-build integrity gate (`verify-build.cjs`) | ✅ |
| `robots: noindex, nofollow` | ✅ |
| `color-scheme: dark` | ✅ |
| `csrf.trustedOrigins` configured | ✅ |
| `.env.example` with documented vars | ✅ |
| Vite `allowedHosts` configured (even if duplicated) | ✅ |

---

## Summary — Priority Ranking

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 1 | **CSP + security headers missing** (`hooks.server.ts`) | 🔴 High | 30 min |
| 2 | **`allowedHosts` config drift** — svelte.config.js vs vite.config.ts differ | 🟡 Medium | 5 min |
| 3 | **Dead dependency** `@sveltejs/adapter-auto` (unused) | 🟡 Medium | 2 min |
| 4 | **Orphaned** `prettier-plugin-svelte` (no config) | 🟡 Low | 5 min |
| 5 | **Missing strict TS flags** (`noUnusedLocals`, etc.) | 🟡 Medium | 30-60 min |
| 6 | **No bundle analyzer** | 🟡 Low-Medium | 15 min |
| 7 | **No `engines` field** in package.json | 🟢 Low | 2 min |
| 8 | **Everything in devDependencies** (should have `dependencies`) | 🟢 Low | 5 min |
| 9 | **TLS verification disabled** for local gateway | 🟢 Info | Research |
| 10 | **7 patch-level updates available** (safe to bump) | 🟢 Low | 10 min |

---

*Generated by Alfred — Noema GAP SCAN (Config & Build)*
*Next scan due: after any dependency bump or build pipeline change.*
