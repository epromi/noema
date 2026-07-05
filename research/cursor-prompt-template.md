# Cursor Agent Prompt Template

> How Alfred generates prompts for the Cursor CLI when implementing Noema packages.
> See: `research/dev-loop-architecture.md`, `scripts/dev-loop.sh`

## Template

```
You are implementing a package for the Noema monitoring dashboard (SvelteKit v2).

## CRITICAL RULES (read FIRST)

1. `lib/core/` = plain TypeScript/JavaScript — ZERO Svelte imports, ZERO browser APIs
2. `lib/components/` = Svelte UI only — receives data via props from parent
3. Max 5 files per phase — if a package has 10 files, do NOT implement all at once
4. Every `lib/core/*.ts` module MUST have a corresponding `tests/core/*.test.ts`
5. Run `pnpm check` after each phase — do NOT proceed if it fails
6. Output ONLY the implementation — no explanations unless something fails

## PROJECT STRUCTURE

projects/noema/
├── lib/
│   ├── core/          ← framework-agnostic data layer (NO Svelte imports)
│   │   ├── types/     ← shared TypeScript types
│   │   ├── crons.ts
│   │   ├── agents.ts
│   │   ├── health.ts
│   │   └── ...
│   └── components/    ← Svelte UI components (ONLY rendering)
│       ├── tabs/      ← dashboard tab components
│       └── shared/    ← reusable UI pieces
├── tests/
│   └── core/          ← unit tests for lib/core/
├── dev/
│   └── packages/      ← package specs
└── src/
    └── routes/
        └── +page.svelte  ← main dashboard page

## PACKAGE SPEC

Read the full spec from: dev/packages/<PKG_ID>/spec.md

## INSTRUCTIONS

1. Read the spec at dev/packages/<PKG_ID>/spec.md
2. Implement F1 (core) phase FIRST, verify, THEN F2 (UI), THEN F3-F5
3. After ALL phases: run 'pnpm check' to verify
4. If any phase fails, STOP and explain what went wrong
```

## Size-Specific Variants

### M packages (3-5 files)

Use the base template above. Cursor handles this well in one pass.

### L packages (6-10 files)

**Split into two Cursor runs:**

Run 1 — Core modules only (F1):
```
<base template>
...
## INSTRUCTIONS
Implement ONLY F1 (core) phase. Create all lib/core/*.ts modules and tests.
Do NOT create any Svelte components.
Run pnpm check when done.
```

Run 2 — UI only (F2+):
```
<base template>
...
## INSTRUCTIONS  
Implement F2 (UI) + F3 (integration) + F4 (tests).
Core modules are already done (F1). Create Svelte components only.
The core modules are at lib/core/<names>.ts — import from them.
Run pnpm check when done.
```

### Debugging failed runs

If Cursor produces broken output:
```
Read the file <filepath>.
There's a bug: <describe the bug>.
Fix ONLY this bug, do NOT change anything else.
Run pnpm check to verify.
```

## Model Selection

| Size | Model | Why |
|------|-------|-----|
| S | Alfred (DD V4 Pro) | Not worth Cursor overhead |
| M | sonnet-4 (default) | Good balance of speed/quality |
| L | sonnet-4 | First choice, fallback to opus-4 if fails |

Add `--model sonnet-4` or `--model opus-4` to the cursor command if needed.

## Verification Checklist (Alfred's job after Cursor)

After Cursor finishes, Alfred checks:

- [ ] `pnpm check` passes (no TypeScript errors)
- [ ] `pnpm build` succeeds (can bundle)
- [ ] All files listed in spec exist
- [ ] `lib/core/*.ts` has ZERO Svelte imports (grep check)
- [ ] `lib/components/*.svelte` has NO `exec()`, `sessions_*`, `read()`, `write()` calls
- [ ] Tests exist for every core module
- [ ] Git status is clean or has only expected changes
- [ ] No leftover debug files, temp files, or commented-out code
