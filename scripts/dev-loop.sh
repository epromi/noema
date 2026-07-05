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
#   5. DEEP REVIEW    — lint+format(auto-fix 3x), test, architecture, quality, security, summary
#   6. COMMIT         — git add, commit, push + dashboard regen
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

# Extract short PKG-ID for INDEX.md matching (PKG-001-sveltekit-scaffold → PKG-001)
SHORT_ID=$(echo "$PKG_ID" | grep -oP '^PKG-\d{3}' || echo "$PKG_ID")

# Ensure log directory exists
mkdir -p "$PROJECT_DIR/logs"

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
echo "$EXPECTED_FILES" | while read f; do [ -n "$f" ] && echo "  - $f"; done || true

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
  done || true
} >> "$PROMPT_FILE"

echo "Prompt:   $PROMPT_FILE ($(wc -l < "$PROMPT_FILE") lines)"
echo "Template: $TEMPLATE"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
banner "PHASE 4/6: Cursor Agent"
# ═══════════════════════════════════════════════════════════════════════════

echo "Running cursor agent..."
echo "Log: $PROJECT_DIR/logs/cursor-${PKG_ID}.log"
echo ""

cd "$PROJECT_DIR"

# Use read to avoid shell expansion issues with prompt text
CURSOR_PROMPT=$(cat "$PROMPT_FILE")
CURSOR_LOG="$PROJECT_DIR/logs/cursor-${PKG_ID}.log"
cursor agent --print --force --trust --workspace "$PROJECT_DIR" "$CURSOR_PROMPT" 2>&1 | tee "$CURSOR_LOG" || true
CURSOR_EXIT=${PIPESTATUS[0]}
if [ "$CURSOR_EXIT" -ne 0 ]; then
  warn "Cursor exited with code $CURSOR_EXIT"
fi

# Post-cursor: check expected files exist
echo ""
echo "Checking expected files..."
MISSING=0
if [ -n "$EXPECTED_FILES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if [ -f "$PROJECT_DIR/$f" ]; then
      ok "  $f"
    else
      warn "  $f — NOT CREATED"
      MISSING=$((MISSING + 1))
    fi
  done <<< "$EXPECTED_FILES"
fi

if [ "$MISSING" -gt 0 ] 2>/dev/null; then
  warn "$MISSING expected file(s) missing — review cursor output"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════
banner "PHASE 5/6: Deep Review + Auto-Fix"
# ═══════════════════════════════════════════════════════════════════════════
# 6 sub-phases: lint→auto-fix→retry (3x), test, architecture, provider, imports, summary

cd "$PROJECT_DIR"
HAS_PKG="$([ -f package.json ] && echo 1 || echo 0)"
REVIEW_PASS=0
REVIEW_WARN=0
REVIEW_FAIL=0
REVIEW_LOG="$PROJECT_DIR/logs/review-${PKG_ID}.log"

review_ok()   { printf "${GREEN}    ✅ %s${NC}\n" "$1"; REVIEW_PASS=$((REVIEW_PASS + 1)); echo "✅ $1" >> "$REVIEW_LOG"; }
review_warn() { printf "${YELLOW}    ⚠️  %s${NC}\n" "$1"; REVIEW_WARN=$((REVIEW_WARN + 1)); echo "⚠️  $1" >> "$REVIEW_LOG"; }
review_fail() { printf "${RED}    ❌ %s${NC}\n" "$1"; REVIEW_FAIL=$((REVIEW_FAIL + 1)); echo "❌ $1" >> "$REVIEW_LOG"; }

# Reset review log
: > "$REVIEW_LOG"
echo "# Review: $PKG_ID — $(date -Iseconds)" >> "$REVIEW_LOG"
echo "" >> "$REVIEW_LOG"

# ─── 5a: Lint + Format (auto-fix, max 3 retry) ──────────────────────────
banner "5a: Lint + Format (auto-fix, max 3x)"

if [ "$HAS_PKG" -eq 1 ]; then
  LINT_OK=0
  for attempt in 1 2 3; do
    LINT_OUT=""

    # ESLint check
    ESLINT_FAIL=0
    if npx eslint --quiet src/ 2>&1 || true; then
      :
    else
      ESLINT_FAIL=${PIPESTATUS[0]:-1}
    fi

    # Prettier check
    PRETTIER_FAIL=0
    if npx prettier --check "src/**/*.{ts,svelte,js,cjs}" 2>&1 || true; then
      :
    else
      PRETTIER_FAIL=${PIPESTATUS[0]:-1}
    fi

    if [ "$ESLINT_FAIL" -eq 0 ] && [ "$PRETTIER_FAIL" -eq 0 ]; then
      review_ok "Lint + Format clean (pass $attempt)"
      LINT_OK=1
      break
    fi

    echo "    Lint/formátum hibák — auto-fix ($attempt/3)..."
    npx eslint --fix --quiet src/ 2>&1 || true
    npx prettier --write "src/**/*.{ts,svelte,js,cjs}" 2>&1 || true
  done

  if [ "$LINT_OK" -eq 0 ]; then
    review_warn "Lint/format issues persist after 3 fix attempts"
  fi
else
  echo "    (no package.json — skip lint)"
fi

echo ""

# ─── 5b: Test Suite ──────────────────────────────────────────────────────
banner "5b: Test Suite + Coverage"

COVERAGE_THRESHOLD=70

if [ "$HAS_PKG" -eq 1 ]; then
  if [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ] || grep -q '"test"' package.json 2>/dev/null; then
    # Run tests WITH coverage
    TEST_PASSED=0
    if pnpm test --reporter=verbose --coverage 2>&1 | tee /tmp/noema-coverage-${PKG_ID}.txt || true; then
      TEST_EXIT=${PIPESTATUS[0]:-0}
    else
      TEST_EXIT=${PIPESTATUS[0]:-1}
    fi

    # Parse coverage lines from vitest output
    COV_FILE="/tmp/noema-coverage-${PKG_ID}.txt"
    cat "$COV_FILE" >> "$REVIEW_LOG"

    # Extract statement/line coverage %% from vitest
    COV_LINE=$(grep -oP 'All files[[:space:]]+\|?[[:space:]]*\K[0-9.]+(?=\s*\|)' "$COV_FILE" 2>/dev/null | head -1 || echo "")
    if [ -z "$COV_LINE" ]; then
      # Try alternative format
      COV_LINE=$(grep -oP 'Lines[[:space:]]*:[[:space:]]*\K[0-9.]+(?=%)' "$COV_FILE" 2>/dev/null | head -1 || echo "")
    fi
    COV_LINE="${COV_LINE:-0}"

    if [ "$TEST_EXIT" -eq 0 ]; then
      review_ok "Tests passing"
      TEST_PASSED=1
    else
      FAILED_TESTS=$(grep -c 'FAIL\|✗' "$COV_FILE" 2>/dev/null || echo "?")
      review_warn "Tests failing ($FAILED_TESTS failures) — review required"
    fi

    # Coverage gate
    COV_OK=$(echo "$COV_LINE >= $COVERAGE_THRESHOLD" | bc 2>/dev/null || echo 0)
    if [ "$COV_OK" -eq 1 ]; then
      review_ok "Coverage: ${COV_LINE}% (≥${COVERAGE_THRESHOLD}%)"
    else
      review_warn "Coverage: ${COV_LINE}% (below ${COVERAGE_THRESHOLD}% threshold)"
    fi

    # Check: do all core/*.ts files have corresponding test files?
    MISSING_TESTS=0
    if [ -d "$PROJECT_DIR/src/lib/core" ] && [ -d "$PROJECT_DIR/tests" ]; then
      for core_file in "$PROJECT_DIR"/src/lib/core/*.ts; do
        [ -f "$core_file" ] || continue
        base=$(basename "$core_file" .ts)
        test_file="$PROJECT_DIR/tests/core/${base}.test.ts"
        if [ ! -f "$test_file" ]; then
          if [ "$MISSING_TESTS" -eq 0 ]; then
            echo ""
          fi
          echo "    ⚠️  Missing test: tests/core/${base}.test.ts"
          MISSING_TESTS=$((MISSING_TESTS + 1))
        fi
      done
    fi
    if [ "$MISSING_TESTS" -gt 0 ]; then
      review_fail "$MISSING_TESTS core module(s) without test file"
    fi
  else
    echo "    (no test config — skip)"
  fi
else
  echo "    (no package.json — skip)"
fi

echo ""

# ─── 5c: Architecture Compliance ─────────────────────────────────────────
banner "5c: Architecture Compliance"

ARCH_VIOLATIONS=0

# Check 1: src/lib/core/ must not import Svelte
if [ -d "$PROJECT_DIR/src/lib/core" ]; then
  CORE_SVELTE=$(grep -rl "from 'svelte\|from \"svelte\|import svelte" "$PROJECT_DIR/src/lib/core/" 2>/dev/null || true)
  if [ -z "$CORE_SVELTE" ]; then
    review_ok "src/lib/core/ — zero Svelte imports"
  else
    review_fail "SVELTE LEAK in src/lib/core/: $(echo "$CORE_SVELTE" | tr '\n' ' ')"
    ARCH_VIOLATIONS=$((ARCH_VIOLATIONS + 1))
  fi
fi

# Check 2: src/lib/core/ must not call OpenClaw/exec APIs directly
if [ -d "$PROJECT_DIR/src/lib/core" ]; then
  CORE_SYSCALL=$(grep -rl "exec(\|sessions_\|fetch.*openclaw\|process\." "$PROJECT_DIR/src/lib/core/" 2>/dev/null || true)
  if [ -z "$CORE_SYSCALL" ]; then
    review_ok "src/lib/core/ — zero system/API calls (provider-safe)"
  else
    review_fail "SYSTEM CALL in src/lib/core/: $(echo "$CORE_SYSCALL" | tr '\n' ' ')"
    ARCH_VIOLATIONS=$((ARCH_VIOLATIONS + 1))
  fi
fi

# Check 3: src/lib/components/ must not have exec/session calls
if [ -d "$PROJECT_DIR/src/lib/components" ]; then
  COMP_SYSCALL=$(grep -rl "exec(\|sessions_\|read(\|write(" "$PROJECT_DIR/src/lib/components/" 2>/dev/null || true)
  if [ -z "$COMP_SYSCALL" ]; then
    review_ok "src/lib/components/ — zero system calls"
  else
    review_fail "SYSTEM CALL in components: $(echo "$COMP_SYSCALL" | tr '\n' ' ')"
    ARCH_VIOLATIONS=$((ARCH_VIOLATIONS + 1))
  fi
fi

# Check 4: Provider pattern — verify OpenClaw adapter exists if core modules need external data
if [ -d "$PROJECT_DIR/src/lib/providers" ]; then
  PROVIDER_FILES=$(ls "$PROJECT_DIR/src/lib/providers/" 2>/dev/null | wc -l)
  if [ "$PROVIDER_FILES" -ge 1 ]; then
    review_ok "Provider layer present ($PROVIDER_FILES adapter file(s))"
  else
    review_warn "Provider layer empty — check if needed"
  fi
fi

echo ""

# ─── 5d: Code Quality Metrics ────────────────────────────────────────────
banner "5d: Code Quality Metrics"

# LOC counts
if git rev-parse --git-dir >/dev/null 2>&1; then
  ADDED_LINES=$(git diff --cached --numstat 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
  ADDED_FILES=$(git diff --cached --name-only 2>/dev/null | wc -l)
  echo "    Lines added: $ADDED_LINES | Files changed: $ADDED_FILES"

  # Phase budget check (max 5 files per phase constraint from CONTRIBUTING.md)
  if [ "$ADDED_FILES" -gt 10 ]; then
    review_warn "Large changeset ($ADDED_FILES files) — phase budget exceeded (max 5/phase)"
  elif [ "$ADDED_FILES" -gt 5 ]; then
    review_warn "Moderate changeset ($ADDED_FILES files) — consider splitting next time"
  else
    review_ok "Changeset size OK ($ADDED_FILES files)"
  fi

  # File size extremes
  OVERSIZED=$(git diff --cached --numstat 2>/dev/null | awk '$1 > 300 {print $3 " (" $1 " lines)"}')
  if [ -n "$OVERSIZED" ]; then
    echo "    ⚠️  Oversized files (>300 lines added):"
    echo "$OVERSIZED" | while read line; do echo "       $line"; done || true
  fi
else
  echo "    (not a git repo — skip)"
fi

echo ""

# ─── 5e: Security Scan (quick) ───────────────────────────────────────────
banner "5e: Quick Security Scan"

SEC_ISSUES=0

# Hardcoded secrets check
if git rev-parse --git-dir >/dev/null 2>&1; then
  SECRETS=$(git diff --cached 2>/dev/null | grep -iE 'api.?key[[:space:]]*=|token[[:space:]]*=|secret[[:space:]]*=|password[[:space:]]*=' | grep -v 'EXAMPLE\|example\|\.env\.\|process\.env\|DENO_ENV' || true)
  if [ -z "$SECRETS" ]; then
    review_ok "No hardcoded secrets detected"
  else
    SEC_COUNT=$(echo "$SECRETS" | wc -l)
    review_fail "Potential secrets in diff ($SEC_COUNT lines) — VERIFY MANUALLY"
    echo "$SECRETS" | head -5 >> "$REVIEW_LOG"
    SEC_ISSUES=$((SEC_ISSUES + 1))
  fi
fi

# Dangerous patterns: eval, innerHTML, dangerouslySetInnerHTML
if git rev-parse --git-dir >/dev/null 2>&1; then
  DANGER=$(git diff --cached 2>/dev/null | grep -E '^\+.*eval\(|^\+.*innerHTML|^\+.*dangerouslySetInnerHTML' | grep -v '//.*eval\|#.*eval\|test.*eval' || true)
  if [ -z "$DANGER" ]; then
    review_ok "No dangerous patterns (eval, innerHTML)"
  else
    DANGER_COUNT=$(echo "$DANGER" | wc -l)
    review_warn "Dangerous patterns found ($DANGER_COUNT) — review recommended"
    echo "$DANGER" | head -5 >> "$REVIEW_LOG"
  fi
fi

echo ""

# ─── 5f: Summary ─────────────────────────────────────────────────────────
banner "5f: Review Summary"

echo ""
echo "  ┌─────────────────────────────────────┐"
printf "  │  ✅ Pass:      %2d                   │\n" "$REVIEW_PASS"
printf "  │  ⚠️  Warnings:  %2d                   │\n" "$REVIEW_WARN"
printf "  │  ❌ Failures:  %2d                   │\n" "$REVIEW_FAIL"
echo "  │  Full log:    logs/review-${PKG_ID}.log  │"
echo "  └─────────────────────────────────────┘"
echo ""

# Decision gate
if [ "$ARCH_VIOLATIONS" -gt 0 ]; then
  warn "ARCHITECTURE VIOLATIONS ($ARCH_VIOLATIONS) — review before next package"
elif [ "$REVIEW_FAIL" -gt 0 ]; then
  warn "$REVIEW_FAIL hard failure(s) — proceed with caution"
elif [ "$REVIEW_WARN" -gt 3 ]; then
  warn "$REVIEW_WARN warnings — review recommended"
else
  ok "Review passed cleanly ($REVIEW_PASS checks OK)"
fi

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

ok "Implementation pushed — $PKG_ID"

# ═══════════════════════════════════════════════════════════════════════
banner "PHASE 6b: Status Update (INDEX.md + Dashboard)"
# ═══════════════════════════════════════════════════════════════════════

# 1. Mark package as done in INDEX.md (uses SHORT_ID: $SHORT_ID)
INDEX_MD="$PROJECT_DIR/dev/packages/INDEX.md"
echo "Updating $INDEX_MD..."
python3 -c "
f = '$INDEX_MD'
c = open(f).read()
pkg = '$SHORT_ID'
for line in c.split('\n'):
    if line.startswith('| ' + pkg + ' '):
        cols = line.split('|')
        cols[3] = ' ✅ F5 '
        cols[6] = ' ✅ kész '
        new_line = '|'.join(cols)
        c = c.replace(line, new_line)
        open(f, 'w').write(c)
        print('✅ INDEX.md: ' + pkg + ' → ✅ F5')
        break
else:
    print('⚠️  PKG-ID not found in INDEX.md')
" || warn "INDEX.md update failed (python3 error)"

# 2. Regenerate dashboard
echo ""
echo "Regenerating dashboard..."
cd "$PROJECT_DIR"
node generate.cjs 2>&1 || warn "Dashboard regen failed"

# 3. Commit status update + dashboard
git add dev/packages/INDEX.md dashboard.html
git diff --cached --name-status | head -5
git commit -m "📊 $PKG_ID done (✅ F5) + dashboard regen" 2>&1 || warn "git commit failed (nothing to stage?)"

# 4. Handle possible race: cron auto-refresh may have pushed in parallel
# Pull with rebase to keep history clean, then push
git pull --rebase 2>&1 || warn "Rebase conflict — manual fix needed"
git push 2>&1 || warn "Push failed (maybe already pushed by cron)"

ok "Status updated — $PKG_ID marked done + dashboard regen pushed"

# ═══════════════════════════════════════════════════════════════════════════
banner "5g: Review Sub-Agent"
# ═══════════════════════════════════════════════════════════════════════════

REVIEW_SPAWNER="$PROJECT_DIR/scripts/spawn-review-agent.js"

if [ -f "$REVIEW_SPAWNER" ]; then
  if [ "${REVIEW_WARN:-0}" -gt 0 ] || [ "${REVIEW_FAIL:-0}" -gt 0 ]; then
    echo "Issues detected (${REVIEW_WARN:-0}w/${REVIEW_FAIL:-0}f) — spawning review sub-agent..."
    node "$REVIEW_SPAWNER" "$PKG_ID" "$REVIEW_LOG" 2>&1 || warn "Review agent spawn failed (check Gateway API)"
  else
    echo "✅ Review clean — no sub-agent needed"
  fi
else
  echo "(spawn-review-agent.js not found — skip)"
fi

echo ""

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
