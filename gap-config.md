# 🔍 Noema Configuration Gap Scan — 2026-07-18 07:50 CEST
**QA Agent**: Nova 🔧 | **Phase**: 1 (Config) | **Scope**: package.json, configs, CI, env, deps

## Summary

| Metric | Count |
|--------|-------|
| Outdated dependencies | 10 |
| Security vulnerabilities | 1 (low) |
| Major version gaps | 6 |
| CI workflows | 1 (healthy) |
| Missing env vars | 0 ✅ |
| .gitignore coverage | Good ✅ |

---

## Findings

### 🔴 Critical
(none)

### 🟡 Warning

#### 1. CFG-001: Cookie package vulnerability (low)
- **File**: `package.json` → `cookie <0.7.0`
- **Severity**: 🟡 warning
- **Category**: dep-security
- **Auto-fixable**: ❌ no (comes from @sveltejs/kit, need upstream fix)
- **Description**: CVE: cookie accepts out-of-bounds characters. Affects @sveltejs/kit → cookie. GHSA-pxg6-pf52-xh8x.
- **Fix**: `pnpm update @sveltejs/kit` to latest (2.69.3 may fix; otherwise wait for upstream).

#### 2. CFG-002: @sveltejs/kit — 2.69.1 → 2.69.3 (patch)
- **Package**: `@sveltejs/kit`
- **Severity**: 🟡 warning
- **Category**: dep-outdated
- **Auto-fixable**: ✅ yes (patch update, low risk)
- **Description**: 2 patch versions behind. May include the cookie fix.
- **Fix**: `pnpm update @sveltejs/kit`

#### 3. CFG-003: svelte — 5.56.4 → 5.56.6 (patch)
- **Package**: `svelte`
- **Severity**: 🟡 warning
- **Category**: dep-outdated
- **Auto-fixable**: ✅ yes (patch update)
- **Fix**: `pnpm update svelte`

#### 4. CFG-004: svelte-check — 4.7.1 → 4.7.3 (patch)
- **Package**: `svelte-check`
- **Severity**: 🟡 warning
- **Category**: dep-outdated
- **Auto-fixable**: ✅ yes
- **Fix**: `pnpm update svelte-check`

#### 5. CFG-005: @sveltejs/adapter-auto — 6.1.1 → 7.0.1 (MAJOR)
- **Package**: `@sveltejs/adapter-auto`
- **Severity**: 🟡 warning
- **Category**: dep-outdated
- **Auto-fixable**: ❌ no (major version — needs testing)
- **Description**: Major version bump. Breaking changes likely. Requires testing before update.

#### 6. CFG-006: @sveltejs/vite-plugin-svelte — 5.1.1 → 7.2.0 (MAJOR)
- **Package**: `@sveltejs/vite-plugin-svelte`
- **Severity**: 🟡 warning
- **Category**: dep-outdated
- **Auto-fixable**: ❌ no (major version)
- **Description**: 2 major versions behind. Likely breaking changes.
- **Proposal**: Test during a dedicated maintenance window.

#### 7. CFG-007: @types/node — 22.20.0 → 26.1.1 (MAJOR)
- **Package**: `@types/node`
- **Severity**: 🟡 warning
- **Category**: dep-outdated
- **Auto-fixable**: ❌ no (types only, but major bump may introduce stricter checks)
- **Proposal**: Safe to update (types only), but test typechecking after.

#### 8. CFG-008: @vitest/coverage-v8 — 3.2.6 → 4.1.10 (MAJOR)
- **Package**: `@vitest/coverage-v8`
- **Severity**: 🟡 warning
- **Category**: dep-outdated
- **Auto-fixable**: ❌ no
- **Description**: Major version bump. vitest 4.x may require vitest 4.x main package too.

#### 9. CFG-009: typescript — 5.9.3 → 7.0.2 (MAJOR)
- **Package**: `typescript`
- **Severity**: 🟡 warning
- **Category**: dep-outdated
- **Auto-fixable**: ❌ no
- **Description**: TypeScript 7.0 is a major new version. Likely new strictness checks, could break existing type assertions.
- **Proposal**: Plan migration for a maintenance sprint.

#### 10. CFG-010: vite — 6.4.3 → 8.1.5 (MAJOR)
- **Package**: `vite`
- **Severity**: 🟡 warning
- **Category**: dep-outdated
- **Auto-fixable**: ❌ no
- **Description**: Vite 8.x is 2 major versions ahead. SvelteKit compatibility needs verification first.

#### 11. CFG-011: vitest — 3.2.6 → 4.1.10 (MAJOR)
- **Package**: `vitest`
- **Severity**: 🟡 warning
- **Category**: dep-outdated
- **Auto-fixable**: ❌ no
- **Description**: Vitest 4.x major bump.

### 🟢 Info

#### 12. CFG-012: Zero runtime dependencies ✅
- **Category**: positive
- **Description**: `dependencies` is empty. All deps are `devDependencies`. Clean bundling, no runtime bloat.

#### 13. CFG-013: CI pipeline is comprehensive ✅
- **Workflow**: `.github/workflows/ci.yml`
- **Category**: positive
- **Description**: CI runs: secret scanning (comprehensive patterns), source change detection, typecheck, build, test. Smart skip for docs-only changes.

#### 14. CFG-014: .gitignore covers all sensitive files ✅
- **Category**: positive
- **Description**: .env, .openclaw/, data/, memory/state/, logs/, tmp/, coverage/ all excluded. Good data-security posture.

#### 15. CFG-015: dev-loop.conf.ts — cursor backend limitation
- **File**: `dev-loop.conf.ts` :23
- **Severity**: 🟢 info
- **Category**: config-note
- **Auto-fixable**: ❌ no
- **Description**: `executionBackend: "cursor"` means auto-implementation (Phase 3.6) requires Cursor IDE availability. On this machine without Cursor, dev_loop with subagent backend would fail (known issue — PKG-069 failed for this reason on Jul 17).
- **Proposal**: Consider supporting `subagent` backend via claude or alternative models for environments without Cursor.

---

## Auto-Fix Candidates (Phase 2)

| Priority | Count | Type |
|----------|-------|------|
| ✅ Auto-fix now | 3 | Patch updates (kit, svelte, svelte-check) |
| ✅ Auto-fix now | 1 | cookie vuln fix (via kit update) |
| ❌ Needs testing | 7 | Major version bumps |
| ❌ Proposal only | 1 | dev-loop backend config |

**Total auto-fixable now**: 3 patch updates (low risk)

---

## Comparison with Previous Run (Jul 17)

The same dependency set was current. No regressions from Jul 17 build.

---

*Generated: Nova 🔧 QA Run #3, 2026-07-18 07:50 CEST*
