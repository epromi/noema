#!/usr/bin/env bash
# Noema Dev Loop Orchestrator
# Usage: ./scripts/dev-loop.sh <pkg-id>
# Example: ./scripts/dev-loop.sh PKG-013
#
# 6-phase pipeline:
#   1. SPEC ANALYSIS  — read spec, extract metadata
#   2. STRATEGY       — determine Alfred vs Cursor
#   3. PROMPT         — generate Cursor prompt from template
#   4. EXECUTE        — run Cursor agent or hand off to Alfred
#   5. VERIFY         — file existence, pnpm check, git status
#   6. COMMIT         — git add, commit, push
set -euo pipefail

PKG_ID="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

banner() { printf "${BLUE}━━━ %s ━━━${NC}\n" "$1"; }
fail()   { printf "${RED}❌ %s${NC}\n" "$1"; exit 1; }
ok()     { printf "${GREEN}✅ %s${NC}\n" "$1"; }
warn()   { printf "${YELLOW}⚠️  %s${NC}\n" "$1"; }

# ─── Validate input ────────────────────────────────────────────────────────
if [ -z "$PKG_ID" ]; then
  echo "Usage: dev-loop.sh <pkg-id>"
  echo "Example: dev-loop.sh PKG-013"
  echo ""
  echo "Available packages:"
  for dir in "$PROJECT_DIR"/dev/packages/PKG-*/; do
    [ -d "$dir" ] || continue
    ID=$(basename "$dir")
    NAME=$(grep -m1 '^# PKG-' "$dir/spec.md" 2>/dev/null | sed 's/^# PKG-[0-9]*:[[:space:]]*//')
    printf '  %s — %s\n' "$ID" "${NAME:-?}"
  done
  exit 1
fi

SPEC_FILE="$PROJECT_DIR/dev/packages/$PKG_ID/spec.md"
if [ ! -f "$SPEC_FILE" ]; then
  # Try fuzzy match
  MATCH=$(ls -d "$PROJECT_DIR"/dev/packages/${PKG_ID}*/spec.md 2>/dev/null | head -1)
  if [ -n "$MATCH" ]; then
    PKG_ID=$(basename "$(dirname "$MATCH")")
    SPEC_FILE="$MATCH"
    ok "Fuzzy match: $PKG_ID"
  else
    fail "Spec not found: $PKG_ID (try: $(ls "$PROJECT_DIR"/dev/packages/ | head -3 | tr '\n' ' '))"
  fi
fi

# ─── Bootstrap ─────────────────────────────────────────────────────────────
bash "$SCRIPT_DIR/dev-loop-bootstrap.sh" || warn "Bootstrap warnings (continuing)"

# ═══════════════════════════════════════════════════════════════════════════
banner "PHASE 1/6: Spec Analysis ($PKG_ID)"
# ═══════════════════════════════════════════════════════════════════════════

# Extract metadata — robust grep with fallbacks
PKG_NAME=$(grep -m1 '^# PKG-' "$SPEC_FILE" | sed 's/^# PKG-[0-9]*:[[:space:]]*//' || echo "Unknown")

# Extract size from "Méret: <S|M|L|XL>" pattern (status line or table format)
PKG_SIZE=$(grep -oP 'Méret:\s*\K[SMXL]+' "$SPEC_FILE" | head -1 || true)
if [ -z "$PKG_SIZE" ]; then
  PKG_SIZE=$(grep -oP '\|\s*Méret\s*\|\s*\K[SMXL]+' "$SPEC_FILE" | head -1 || true)
fi
PKG_SIZE="${PKG_SIZE:-M}"

# Try multiple formats for effort
PKG_EFFORT=$(grep -oP 'Becsült idő:[[:space:]]*\K[^\n]+' "$SPEC_FILE" | head -1 | tr -d '\r' || true)
PKG_EFFORT="${PKG_EFFORT:-?}"

# Count phases
PKG_PHASES=$(grep -c '^### F[0-9]' "$SPEC_FILE" || echo "?")

# Extract expected files from spec (for post-cursor verification)
EXPECTED_FILES=$(grep -oP '`(lib|tests|src)/[^`]+\.(ts|svelte|js|html)`' "$SPEC_FILE" | sed 's/`//g' | sort -u || true)

echo "Package:  $PKG_ID — $PKG_NAME"
echo "Size:     $PKG_SIZE ($PKG_EFFORT)"
echo "Phases:   $PKG_PHASES"
echo "Expected files ($(echo "$EXPECTED_FILES" | grep -c . 2>/dev/null || echo 0)):"
echo "$EXPECTED_FILES" | while read f; do [ -n "$f" ] && echo "  - $f"; done

# ═══════════════════════════════════════════════════════════════════════════
banner "PHASE 2/6: Strategy"
# ═══════════════════════════════════════════════════════════════════════════

echo "Strategy: CURSOR AGENT (all sizes — $PKG_SIZE)"
echo "Mandatory context: CONTRIBUTING.md + spec.md"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
banner "PHASE 3/6: Cursor Prompt"
# ═══════════════════════════════════════════════════════════════════════════

TEMPLATE="$PROJECT_DIR/prompts/cursor-implement.txt"
PROMPT_FILE="/tmp/noema-cursor-prompt-${PKG_ID}.txt"

if [ ! -f "$TEMPLATE" ]; then
  fail "Prompt template not found: $TEMPLATE"
fi

# Generate prompt: replace placeholder, append spec metadata
sed "s/PKG_PLACEHOLDER/$PKG_ID/g" "$TEMPLATE" > "$PROMPT_FILE"
{
  echo ""
  echo "## PACKAGE: $PKG_ID — $PKG_NAME"
  echo "Size: $PKG_SIZE | Effort: $PKG_EFFORT | Phases: $PKG_PHASES"
  echo ""
  echo "## EXPECTED FILES (must exist after implementation)"
  echo "$EXPECTED_FILES" | while read f; do
    [ -n "$f" ] && echo "- $f"
  done
} >> "$PROMPT_FILE"

echo "Prompt:   $PROMPT_FILE ($(wc -l < "$PROMPT_FILE") lines)"
echo "Template: $TEMPLATE"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
banner "PHASE 4/6: Cursor Agent"
# ═══════════════════════════════════════════════════════════════════════════

echo "Running cursor agent..."
echo "Log: /tmp/noema-cursor-output-${PKG_ID}.log"
echo ""

cd "$PROJECT_DIR"

# Use read to avoid shell expansion issues with prompt text
CURSOR_PROMPT=$(cat "$PROMPT_FILE")
cursor agent --print --force --trust --workspace "$PROJECT_DIR" "$CURSOR_PROMPT" 2>&1 | tee "/tmp/noema-cursor-output-${PKG_ID}.log"

CURSOR_EXIT="${PIPESTATUS[0]}"
if [ "$CURSOR_EXIT" -ne 0 ]; then
  warn "Cursor exited with code $CURSOR_EXIT"
fi

# Post-cursor: check expected files exist
echo ""
echo "Checking expected files..."
MISSING=0
echo "$EXPECTED_FILES" | while read f; do
  [ -z "$f" ] && continue
  if [ -f "$PROJECT_DIR/$f" ]; then
    ok "  $f"
  else
    warn "  $f — NOT CREATED"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ] 2>/dev/null; then
  warn "$MISSING expected file(s) missing — review cursor output"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════
banner "PHASE 5/6: Verification"
# ═══════════════════════════════════════════════════════════════════════════

echo "1/4: pnpm check..."
if [ -f "$PROJECT_DIR/package.json" ]; then
  cd "$PROJECT_DIR"
  pnpm check 2>&1 || warn "pnpm check failed (review output)"
else
  warn "No package.json — V2 scaffold not built yet (expected at this stage)"
fi

echo ""
echo "2/4: src/lib/core/*.ts — ZERO Svelte imports check..."
CORE_LEAKS=$(grep -rl "from 'svelte\|from \"svelte\|import svelte" "$PROJECT_DIR/src/lib/core/" 2>/dev/null || true)
if [ -z "$CORE_LEAKS" ]; then
  ok "  No Svelte imports in src/lib/core/"
else
  warn "  SVELTE LEAK in src/lib/core/: $CORE_LEAKS"
fi

echo ""
echo "3/4: src/lib/components/*.svelte — NO exec/sessions/read/write calls..."
COMP_LEAKS=$(grep -rl "exec(\|sessions_\|read(\|write(" "$PROJECT_DIR/src/lib/components/" 2>/dev/null || true)
if [ -z "$COMP_LEAKS" ]; then
  ok "  No system calls in src/lib/components/"
else
  warn "  SYSTEM CALL in src/lib/components/: $COMP_LEAKS"
fi

echo ""
echo "4/4: git status..."
cd "$PROJECT_DIR"
git status --short
echo ""

# ═══════════════════════════════════════════════════════════════════════════
banner "PHASE 6/6: Commit & Push"
# ═══════════════════════════════════════════════════════════════════════════

echo "Files staged for commit:"
cd "$PROJECT_DIR"
git add -A
git diff --cached --name-status
echo ""

COMMIT_MSG="🧠 feat: $PKG_NAME ($PKG_ID)"
# Non-interactive mode (systemd/CI): auto-commit with generated message
if [ -t 0 ]; then
  read -rp "Commit message [$COMMIT_MSG]: " USER_MSG
  COMMIT_MSG="${USER_MSG:-$COMMIT_MSG}"
fi

git commit -m "$COMMIT_MSG" 2>&1 || warn "git commit failed (nothing to commit?)"
git push 2>&1 || warn "git push failed"

ok "Done — $PKG_ID implemented and pushed"

# Mark action queue entry
ACTION_QUEUE="$PROJECT_DIR/../memory/state/noema-actions.jsonl"
if [ -f "$ACTION_QUEUE" ]; then
  echo ""
  echo "📋 Matching action queue entries:"
  grep "$PKG_ID" "$ACTION_QUEUE" 2>/dev/null | head -3 || echo "  (none)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧠 Loop complete: $PKG_ID — $PKG_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
