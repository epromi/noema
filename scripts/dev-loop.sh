#!/usr/bin/env bash
# Noema Dev Loop Orchestrator
# Usage: ./scripts/dev-loop.sh <pkg-id>
# Example: ./scripts/dev-loop.sh PKG-013
#
# Reads the PKG spec, determines implementation strategy (Alfred or Cursor),
# generates Cursor prompt if needed, verifies, commits, and pushes.
set -euo pipefail

PKG_ID="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

banner() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  🧠 Noema Dev Loop — $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo
}

fail() {
  echo -e "${RED}❌ FAILED: $1${NC}"
  exit 1
}

ok() {
  echo -e "${GREEN}✅ $1${NC}"
}

warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# ─── Validate input ───
if [ -z "$PKG_ID" ]; then
  echo "Usage: dev-loop.sh <pkg-id>"
  echo "Example: dev-loop.sh PKG-013"
  exit 1
fi

SPEC_FILE="$PROJECT_DIR/dev/packages/$PKG_ID/spec.md"
if [ ! -f "$SPEC_FILE" ]; then
  fail "Spec file not found: $SPEC_FILE"
fi

# ─── Bootstrap check ───
bash "$SCRIPT_DIR/dev-loop-bootstrap.sh"

# ─── Phase 1: READ spec ───
banner "Phase 1/6: Spec Analysis ($PKG_ID)"

# Extract metadata from spec
PKG_NAME=$(grep -m1 '^# PKG-' "$SPEC_FILE" | sed 's/^# PKG-[0-9]*: //' || echo "Unknown")
PKG_SIZE=$(grep -oP 'Méret: \K[SMXL]+' "$SPEC_FILE" || echo "M")
PKG_EFFORT=$(grep -oP 'Becsült idő: \K[^ ]+' "$SPEC_FILE" || echo "?")
PKG_PHASES=$(grep -c '^### F[0-9]' "$SPEC_FILE" || echo "?")

echo "Package:  $PKG_ID — $PKG_NAME"
echo "Size:     $PKG_SIZE ($PKG_EFFORT)"
echo "Phases:   $PKG_PHASES"
echo

# ─── Phase 2: DETERMINE strategy ───
banner "Phase 2/6: Strategy"

if [ "$PKG_SIZE" = "S" ]; then
  echo "Strategy: ALFRED (S size = implement directly)"
  echo "Action:   Pass to Alfred for manual implementation"
  echo
  echo "──────────────────────────────────────────────────"
  echo "📋 Copy this task to Alfred:"
  echo
  echo "  Implement $PKG_ID ($PKG_NAME)"
  echo "  Spec: projects/noema/dev/packages/$PKG_ID/spec.md"
  echo "  Size: S — direct implementation, no Cursor needed"
  echo
  exit 0
fi

echo "Strategy: CURSOR AGENT (M/L size = 3+ files)"
echo "Tool:    cursor agent --print --force --trust"
echo

# ─── Phase 3: BUILD Cursor prompt ───
banner "Phase 3/6: Cursor Prompt"

PROMPT_FILE="/tmp/noema-cursor-prompt-${PKG_ID}.txt"

cat > "$PROMPT_FILE" << 'PROMPT_HEADER'
You are implementing a package for the Noema monitoring dashboard (SvelteKit v2).

## CRITICAL RULES (read FIRST)

1. `lib/core/` = plain TypeScript/JavaScript — ZERO Svelte imports, ZERO browser APIs
2. `lib/components/` = Svelte UI only — receives data via props from parent
3. Max 5 files per phase — if a package has 10 files, do NOT implement all at once
4. Every `lib/core/*.ts` module MUST have a corresponding `tests/core/*.test.ts`
5. Run `pnpm check` after each phase — do NOT proceed if it fails
6. Output ONLY the implementation — no explanations unless something fails

## PROJECT STRUCTURE

```
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
```

PROMPT_HEADER

# Append the spec
echo "" >> "$PROMPT_FILE"
echo "## PACKAGE SPEC" >> "$PROMPT_FILE"
echo "Read the full spec from: dev/packages/$PKG_ID/spec.md" >> "$PROMPT_FILE"
echo "" >> "$PROMPT_FILE"
echo "## INSTRUCTIONS" >> "$PROMPT_FILE"
echo "1. Read the spec at dev/packages/$PKG_ID/spec.md" >> "$PROMPT_FILE"
echo "2. Implement F1 (core) phase FIRST, verify, THEN F2 (UI), THEN F3-F5" >> "$PROMPT_FILE"
echo "3. After ALL phases: run 'pnpm check' to verify" >> "$PROMPT_FILE"
echo "4. If any phase fails, STOP and explain what went wrong" >> "$PROMPT_FILE"

echo "Prompt written to: $PROMPT_FILE"
echo "Lines: $(wc -l < "$PROMPT_FILE")"
echo

# ─── Phase 4: EXECUTE Cursor ───
banner "Phase 4/6: Cursor Agent"

echo "Running cursor agent..."
echo

cd "$PROJECT_DIR"
cursor agent --print --force --trust --workspace "$PROJECT_DIR" "$(cat "$PROMPT_FILE")" 2>&1 | tee /tmp/noema-cursor-output-${PKG_ID}.log

CURSOR_EXIT="${PIPESTATUS[0]}"
if [ "$CURSOR_EXIT" -ne 0 ]; then
  warn "Cursor agent exited with code $CURSOR_EXIT"
  echo "Check log: /tmp/noema-cursor-output-${PKG_ID}.log"
  exit 1
fi

ok "Cursor agent completed"
echo

# ─── Phase 5: VERIFY ───
banner "Phase 5/6: Verification"

echo "1/4 Checking pnpm..."
if [ -f "$PROJECT_DIR/package.json" ]; then
  cd "$PROJECT_DIR"
  pnpm check 2>&1 || warn "pnpm check had issues (check output)"
else
  warn "No package.json yet — V2 scaffold not built (skip pnpm)"
fi

echo "2/4 Checking git status..."
cd "$PROJECT_DIR"
git status --short

echo
echo "3/4 Checking for leftover files..."
UNTRACKED=$(git ls-files --others --exclude-standard | wc -l)
echo "Untracked files: $UNTRACKED"

echo
echo "4/4 Quick sanity: spec vs reality..."
SPEC_FILES=$(grep -oP '`[a-z]+/[^`]+\.(ts|svelte|js)`' "$SPEC_FILE" | sed 's/`//g' | sort -u)
for f in $SPEC_FILES; do
  if [ -f "$PROJECT_DIR/$f" ]; then
    ok "  $f exists"
  else
    warn "  $f MISSING"
  fi
done

echo

# ─── Phase 6: COMMIT ───
banner "Phase 6/6: Commit & Push"

echo "Staging all changes..."
cd "$PROJECT_DIR"
git add -A

echo
echo "Files to commit:"
git diff --cached --name-status
echo

read -rp "Commit message [Enter=auto]: " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="🧠 feat: $PKG_NAME ($PKG_ID)"
fi

git commit -m "$COMMIT_MSG"
git push

ok "Done — $PKG_ID implemented and pushed"

# ─── Mark done in action queue (if exists) ───
ACTION_QUEUE="$PROJECT_DIR/../memory/state/dashboard-actions.jsonl"
if [ -f "$ACTION_QUEUE" ]; then
  echo
  echo "📋 Action queue entry to mark done:"
  grep "$PKG_ID" "$ACTION_QUEUE" 2>/dev/null || echo "  (no matching action found)"
fi

echo
echo "──────────────────────────────────────────────────"
echo "🧠 Loop complete: $PKG_ID — $PKG_NAME"
echo "──────────────────────────────────────────────────"
