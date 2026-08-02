# Noema — Configuration & Build Gap Scan
**Date:** 2026-08-02 | **Scan type:** Dependency freshness, type safety, build integrity, security headers, env validation

---

## 1. Outdated Dependencies

| Package | Pinned (`package.json`) | Installed | Latest | Gap |
|---|---|---|---|---|
| `@sveltejs/adapter-auto` | `^6.0.1` | 6.1.1 | **7.0.1** | ⚠️ MAJOR |
| `@sveltejs/adapter-node` | `^5.5.7` | 5.5.7 | 5.5.7 | ✅ current |
| `@sveltejs/kit` | `^2.69.3` | 2.69.3 | **2.70.2** | ⚠️ MINOR |
| `@sveltejs/vite-plugin-svelte` | `^5.0.3` | N/A (transitive) | **7.2.0** | 🔴 UNUSED/STALE |
| `@types/node` | `^22.15.21` | 22.20.0 | **26.1.2** | ⚠️ MAJOR |
| `@vitest/coverage-v8` | `^3.2.6` | 3.2.6 | **4.1.10** | ⚠️ MAJOR |
| `prettier-plugin-svelte` | `^4.1.1` | 4.1.1 | 4.1.1 | ✅ current |
| `svelte` | `^5.56.6` | 5.56.6 | **5.56.8** | 2 patches behind |
| `svelte-check` | `^4.7.3` | 4.7.3 | **4.7.4** | 1 patch behind |
| `typescript` | `^5.8.3` | 5.9.3 | **7.0.2** | ⚠️ MAJOR (2 major!) |
| `vite` | `^6.3.5` | 6.4.3 | **8.2.0** | ⚠️ MAJOR (2 major!) |
| `vitest` | `^3.1.4` | 3.2.6 | **4.1.10** | ⚠️ MAJOR |

### Pinned-vs-Installed Drift
5 packages have newer `node_modules` versions than `package.json` declares:
- `@sveltejs/adapter-auto` (6.1.1 vs pinned 6.0.1)
- `@types/node` (22.20.0 vs pinned 22.15.21)
- `typescript` (5.9.3 vs pinned 5.8.3)
- `vite` (6.4.3 vs pinned 6.3.5)
- `vitest` (3.2.6 vs pinned 3.1.4)

**Action:** Run `pnpm update` to sync `pnpm-lock.yaml` → `package.json`, or bump the pinned versions.

### Critical: `@sveltejs/vite-plugin-svelte` is stale dead weight
- Listed in `devDependencies` as `^5.0.3` but `require()` returns N/A — it's bundled by `@sveltejs/kit` transitively.
- **Remove** from `devDependencies` — it's never directly imported and the listed version is 2 majors behind reality.

### Severity Assessment
- **LOW:** Patch-level gaps (svelte, svelte-check) — safe to bump
- **MEDIUM:** Minor gaps (@sveltejs/kit 2.70) — read changelog before bump
- **HIGH (defer):** Major gaps (vite 8, vitest 4, typescript 7, adapter-auto 7, @types/node 26) — these are ecosystem-level leaps (Vite 8 likely needs SvelteKit compat, Vitest 4 changed config shape, TS 7 has breaking changes). **Do NOT bump these without a dedicated spike/migration session.** SvelteKit 2.x may not support Vite 8 yet.

---

## 2. Missing Dev Tools

### 🔴 ESLint — Completely absent
- No `.eslintrc.*`, `eslint.config.*`, or `eslint` in devDependencies
- No type-aware linting (`@typescript-eslint`)
- 80 TS/Svelte files with zero automated lint enforcement

### 🔴 Prettier config — Missing
- `prettier-plugin-svelte` is installed but **`prettier` itself is NOT in devDependencies** (it's pulled transitively — fragile)
- No `.prettierrc` or `prettier.config.*` — formatting is undefined
- No `format` script in `package.json`

### 🟡 Bundle analyzer — Missing
- No `rollup-plugin-visualizer` or `vite-plugin-bundle-analyzer`
- Build output: 123 files, 2.5 MB — unknown composition
- Largest chunks: `_page.svelte.js` (128 KB), `index.js` (141 KB), `internal.js` (91 KB)

### 🟡 Node.js version pinning — Missing
- No `.node-version` or `.nvmrc` file
- No `engines` field in `package.json`
- Running Node v24.15.0 but nothing declares the requirement

### 🟡 Missing npm scripts
- No `lint` script
- No `format` script
- No `prepare` or `postinstall` lifecycle hooks

---

## 3. Type Safety Gaps

### 🔴 Active Type Error — `src/routes/+error.svelte:4`
```
Property 'status' does not exist on type '$$ComponentProps'. (ts)
```
**Root cause:** Svelte 5 `$props()` destructure doesn't match SvelteKit's error page interface. SvelteKit error pages should use `import type { SvelteKitError }` or `PageProps` from `./$types`.

**Fix:**
```svelte
<script lang="ts">
  import { page } from '$app/stores';
  // OR use the typed approach:
  let { data }: { data: { status: number; error: App.Error } } = $props();
</script>
```

### 🟢 Good: Strict mode enabled
- `strict: true` ✅
- `noUncheckedIndexedAccess: true` ✅
- `forceConsistentCasingInFileNames: true` ✅

### 🟡 Missing typed environment variables
- Raw `process.env.WORKSPACE` used in `pkg-watcher.ts` instead of SvelteKit's `$env/static/private` or `$env/dynamic/private`
- No `src/lib/types/env.d.ts` or `src/app.d.ts` augmentation for typed env
- `process.env.NOEMA_PROVIDER` also untyped

### 🟡 `app.d.ts` interfaces are all commented out
```typescript
// interface Error {}
// interface Locals {}
// interface PageData {}
// interface PageState {}
// interface Platform {}
```
All empty — no compile-time safety for server-side locals, page data shapes, or error types.

---

## 4. Build Health

### ✅ Build passes cleanly
```
✓ built in 4.55s
✅ Build integrity check passed
```
- `scripts/verify-build.cjs` verifies: manifest integrity, chunk references, client asset presence, source freshness

### ✅ svelte-check
- 1 error (the `+error.svelte` type issue above), 0 warnings — **99.99% clean**

### ℹ️ Build size
- 123 files, 2.5 MB (server + client)
- No obvious bloat — reasonable for a SvelteKit data dashboard
- Cannot analyze composition without bundler analyzer

---

## 5. Security Headers (CSP / Meta)

### 🔴 No server security headers in `hooks.server.ts`
The `handle` hook only starts background collectors — it adds **zero** security headers:

| Header | Status |
|---|---|
| `Content-Security-Policy` | 🔴 Missing |
| `X-Content-Type-Options: nosniff` | 🔴 Missing |
| `X-Frame-Options: DENY` | 🔴 Missing |
| `Strict-Transport-Security` | 🔴 Missing |
| `Referrer-Policy` | 🔴 Missing |
| `Permissions-Policy` | 🔴 Missing |

### 🟡 `app.html` meta tags — mostly good, minor gaps
| Meta | Status |
|---|---|
| `charset="utf-8"` | ✅ |
| `viewport` | ✅ |
| `color-scheme: dark` | ✅ |
| `robots: noindex, nofollow` | ✅ |
| `theme-color` | 🔴 Missing |
| `description` | 🔴 Missing |
| `format-detection` (phone) | 🟡 Missing |
| Open Graph / Twitter Card | 🟡 Missing (dashboard is internal, low priority) |

### 🟡 `svelte.config.js` CSRF — wide net
```js
csrf: {
  trustedOrigins: ['alfred.local', '192.168.0.231', '100.91.60.103',
                   'promisnotebook.tail117b73.ts.net', '.ts.net']
}
```
- `.ts.net` wildcard is **broad** — trusts any Tailscale node. Intentional for Tailscale access, but worth noting.
- No HTTPS origin — all HTTP. Acceptable for localhost/Tailscale internal use.

---

## 6. Environment Validation — Missing

### 🔴 No startup env validation
- `.env.example` documents `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`, `WORKSPACE_ROOT`
- **`OPENCLAW_GATEWAY_TOKEN` is never validated** — the server starts silently with a missing token
- **`WORKSPACE_ROOT` path existence is never checked** — `pkg-watcher.ts` falls back to `~/.openclaw/workspace` without verifying it exists

### 🔴 No Zod/valibot/env-schema
No runtime validation library. All `process.env` access is ad-hoc with individual fallbacks.

### 🟡 `.env` in `.gitignore` — correctly handled
```
.env
.env.*
!.env.example
```
✅ Patterns are correct. Live secrets excluded, example template allowed.

---

## 7. Dependency Audit (Runtime vs Dev)

### No runtime `dependencies`
- `"dependencies"` field is undefined — everything is `devDependencies`
- For a SvelteKit app using `@sveltejs/adapter-node`, this works because `adapter-node` bundles everything into the build
- ✅ Correct pattern for SvelteKit

### Unused devDependency
- `@sveltejs/adapter-auto` — installed but `svelte.config.js` uses `@sveltejs/adapter-node`. The auto adapter is for environments where the platform auto-detects the adapter (Vercel, Netlify, Cloudflare). On a bare Node server it serves no purpose.

---

## 8. Config Files — Quality Audit

| File | Status | Notes |
|---|---|---|
| `svelte.config.js` | ✅ | Clean, correct adapter, CSRF set |
| `vite.config.ts` | 🟡 | `test` block is dead code (overridden by vitest.config.ts). Remove to avoid confusion. |
| `vitest.config.ts` | ✅ | Clean, correct alias, coverage scoped to `core/` |
| `tsconfig.json` | ✅ | Strict, extends SvelteKit base, good options |
| `pnpm-workspace.yaml` | 🟡 | `packages: []` — effectively a single-package monorepo. The workspace definition is noise. Either add packages or remove the file. |
| `.gitignore` | ✅ | Comprehensive, covers env, build, IDE, OS files |
| `.npmrc` | 🔴 | File exists but is **empty** — no `shamefully-hoist`, `strict-peer-dependencies`, or other pnpm config |
| `.prettierrc` | 🔴 | Doesn't exist at all |

---

## 9. CJS/ESM Inconsistency

- `package.json`: `"type": "module"` — ESM
- `relay.cjs` — CommonJS (intentional, used standalone outside SvelteKit)
- `generate.cjs` — CommonJS (intentional, called by cron/CLI)
- `scripts/verify-build.cjs` — CommonJS (loaded via `require()` paths)
- `scripts/dashboard-data-fetcher.cjs` — CommonJS

**Assessment:** ✅ Intentional. Script files are `.cjs` explicitly, SvelteKit source is ESM. No action needed.

---

## 10. CHANGELOG & LICENSE

- `LICENSE` ✅ — MIT, properly authored
- `CHANGELOG.md` ✅ — 66 lines, maintained

---

## Summary: Action Priority

### 🔴 High (fix now)
1. **Fix `+error.svelte` type error** — 1-line fix, blocks clean `svelte-check`
2. **Remove `@sveltejs/vite-plugin-svelte` from devDependencies** — dead dependency
3. **Add startup env validation** — `OPENCLAW_GATEWAY_TOKEN` and `WORKSPACE_ROOT` must be checked before server listen

### 🟡 Medium (this week)
4. **Add security headers to `hooks.server.ts`** — CSP, X-Content-Type-Options, X-Frame-Options at minimum
5. **Add `.node-version`** and `engines` field to `package.json`
6. **Bump patch-level deps**: `svelte` (5.56.8), `svelte-check` (4.7.4)
7. **Sync package.json pins to installed versions** (`pnpm update --latest` for safe bumps)
8. **Add `prettier` to devDependencies** + `.prettierrc` config
9. **Wire up `app.d.ts` interfaces** — `Locals`, `PageData`, `Error` types

### 🟢 Low (backlog)
10. **Add ESLint config** (eslint 9 flat config + `@typescript-eslint`)
11. **Add bundle analyzer** (`rollup-plugin-visualizer`) for build size insight
12. **Remove `adapter-auto`** from devDependencies (unused)
13. **Bump major deps via spike** (Vite 8, Vitest 4, TypeScript 7) — verify SvelteKit compat first
14. **Add typed env module** using `$env/static/private` pattern
15. **Consider removing `pnpm-workspace.yaml`** or populating `packages: []` with real workspaces
