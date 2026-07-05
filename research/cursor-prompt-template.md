# Cursor Agent Prompt Template

> How Alfred generates prompts for the Cursor CLI when implementing Noema packages.
> See: `research/dev-loop-architecture.md`, `scripts/dev-loop.sh`
> **Actual prompt file**: `prompts/cursor-implement.txt` (the bare prompt, no docs)

## How It Works

`dev-loop.sh` reads `prompts/cursor-implement.txt`, replaces the `PKG_PLACEHOLDER` token with the actual package ID, and appends the expected file list from the spec. The prompt template itself is a clean, documentation-free text file.

## Prompt File

**Location**: `prompts/cursor-implement.txt`

Key elements:
1. **CRITICAL RULES** (6 mandatory constraints — core/UI separation, max 5 files/phase, tests required)
2. **PROJECT STRUCTURE** (tree view for Cursor context)
3. **PACKAGE SPEC** pointer (dev/packages/<PKG>/spec.md)
4. **INSTRUCTIONS** (phase-by-phase: F1 core → verify → F2 UI → verify → F3-F5)

## Size-Specific Variants

### All packages (S/M/L) — Single Cursor run, max 5 files/phase

Use `prompts/cursor-implement.txt` as-is. Cursor handles all sizes in one pass as long as per-phase file limits are respected.

**S (1-2 files)**: One phase, fast
**M (3-5 files)**: 2-3 phases, moderate
**L (6-10 files)**: Split into TWO Cursor runs:

**Run 1: Core only (F1)**
```
<same as cursor-implement.txt but add:>
## INSTRUCTIONS
Implement ONLY F1 (core) phase. Create all lib/core/*.ts modules and tests.
Do NOT create any Svelte components. Stop after F1.
Run pnpm check when done.
```

**Run 2: UI + Integration (F2-F5)**
```
<same as cursor-implement.txt but add:>
## INSTRUCTIONS
Core modules (F1) are already done at lib/core/<names>.ts.
Implement F2 (UI) + F3 (integration) + F4 (tests) + F5 (merge).
Import from existing core modules — do NOT recreate them.
Run pnpm check when done.
```

**Mandatory context for EVERY Cursor run**: `projects/noema/CONTRIBUTING.md` is read FIRST (prompt Rule 0).

### Debugging failed runs

Minimal fix prompt:
```
Read the file <filepath>.
Bug: <one-line description>.
Fix ONLY this bug. Do NOT change anything else.
Run pnpm check to verify.
```

## Model Selection

| Size | Model | Why |
|------|-------|-----|
| S | sonnet-4 | Simple — fast turnaround |
| M | sonnet-4 | Default — good balance |
| L (core) | sonnet-4 | Core logic benefits from planning |
| L (UI) | sonnet-4 | Component generation is straightforward |

All packages use Cursor. Add `--model <name>` to the cursor command in dev-loop.sh if switching.

## Verification Checklist

After Cursor finishes, **dev-loop.sh (Phase 5) automatically checks**:

| Check | What | Severity |
|-------|------|----------|
| Files exist | All expected files from spec created? | CRITICAL |
| pnpm check | TypeScript compiles without errors? | CRITICAL |
| ZERO Svelte imports in `lib/core/` | grep for `from 'svelte'` | CRITICAL |
| NO system calls in `lib/components/` | grep for `exec(`, `sessions_`, `read(`, `write(` | CRITICAL |
| Git status | Only expected files changed? | WARNING |

## Adding to dev-loop.sh

The prompt template is read by `dev-loop.sh` Phase 3. To modify the prompt:

1. Edit `prompts/cursor-implement.txt` (for all packages)
2. Or add package-specific overrides in the spec's `## Cursor Overrides` section (future)
