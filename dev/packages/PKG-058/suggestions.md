# PKG-058 — Implementation Notes & Suggestions

## Scope deviation (documented, not silent)

The task prompt handed to Cursor listed `src/lib/core/dev-packages.ts` as the
file to create/modify, with `health.ts` as the reference pattern. That file
list did not match `spec.md`'s own "Érintett fájlok" table, which lists only:

- `scripts/dev-loop.sh`
- `scripts/spec-review-agent.cjs`
- `prompts/cursor-implement.txt`

Root cause of the mismatch (confirmed empirically, not guessed): the Cursor
prompt's `PKG_FILES_PLACEHOLDER` is filled by
`extractExpectedFiles()` in `src/lib/core/dev-freedom.ts`, which used the
same too-narrow regex this very package (PKG-058) exists to fix. Because
`spec.md`'s prose example mentions `` `src/lib/core/dev-packages.ts` `` (from
the PKG-054 illustration), the old regex — which only required a `.ts`/`.js`/
etc. extension and any `lib|tests|src` prefix, matched anywhere in the whole
document — picked up that one example file, ignored the real "Érintett
fájlok" scope, and hallucinated it as "the" file to implement. This is the
exact bug class PKG-058 describes, caught live.

Given this, I implemented what `spec.md` actually specifies, plus the root
cause found in `src/lib/core/dev-freedom.ts` (not listed in `spec.md`'s
table, but the direct cause of the extraction bug for the Cursor-prompt path
— `dev-loop.sh`'s own bash regex is a separate, parallel extraction used only
for post-Cursor file-existence checks).

## 💡 SUGGESTION: scope illustrative filenames to the "Érintett fájlok" table

Even the widened regex, if run over the *entire* spec document (as the
original `spec.md` pseudocode does), will over-match illustrative filenames
mentioned in prose/examples (e.g. this very spec mentions `generate.cjs`,
`dev-loop.conf.ts`, `.env.example` as illustrations of missing cases, none of
which this package touches). `scripts/spec-review-agent.cjs`'s
`--check-diff` mode addresses this by scoping extraction to the
`## Érintett fájlok` / `### Mit érint` / `## 📐 Scope` section only, with a
fallback to the whole document if no such section exists. Recommend applying
the same section-scoping to `dev-loop.sh`'s bash `EXPECTED_FILES` extraction
in a follow-up package, since it still greps the whole spec file.

## 💡 SUGGESTION: `EXTRA` (files changed but not in spec) reporting

`spec.md`'s pseudocode also computes an `EXTRA` set (files changed that
aren't in the spec) via `comm -13`. This PKG only implements the `MISSING`
check (the actual failure condition — spec says only `MISSING` blocks with
`exit 1`). Surfacing `EXTRA` as an informational (non-blocking) log line in
`spec-review-agent.cjs --check-diff` would help catch undeclared scope creep
in a future package.

## What was NOT touched

- `src/lib/core/dev-packages.ts` — despite being named in the task prompt,
  the actual PKG-054 changes it references are already implemented and
  unrelated to PKG-058's actual scope. Left untouched, per spec.
- `prompts/cursor-implement-v3.txt` … `v6.txt` — legacy prompt template
  snapshots, not referenced by `spec.md`'s scope table.
