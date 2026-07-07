#!/usr/bin/env bash
# Pre-commit hook: scan staged files for secrets
# Install: ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Patterns that indicate secrets (extended regex)
PATTERNS=(
  # Telegram Bot Token
  '[0-9]{8,10}:[A-Za-z0-9_-]{35}'
  # OpenAI / generic API keys
  'sk-[a-zA-Z0-9_-]{20,}'
  'sk-or-v1-[a-zA-Z0-9-]+'
  # GitHub tokens
  'ghp_[a-zA-Z0-9]{36}'
  'github_pat_[a-zA-Z0-9_]{20,}'
  # Slack tokens
  'xox[baprs]-[a-zA-Z0-9-]{10,}'
  # Google API keys
  'AIza[0-9A-Za-z_-]{35}'
  # AWS keys
  'AKIA[0-9A-Z]{16}'
  # Generic private key headers
  '-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----'
)

# Files to always skip
SKIP_DIRS=":node_modules:.svelte-kit:build:dist:.git:coverage:tmp:"
SKIP_FILES="pnpm-lock.yaml:package-lock.json:.env.example:"

FOUND=0
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  echo -e "${GREEN}✅ No staged files to scan${NC}"
  exit 0
fi

for file in $STAGED_FILES; do
  # Skip binary files
  if file "$file" 2>/dev/null | grep -q "binary"; then
    continue
  fi

  # Skip directories and specific patterns
  skip=false
  IFS=':' read -ra DIRS <<< "$SKIP_DIRS"
  for d in "${DIRS[@]}"; do
    [[ "$file" == $d/* || "$file" == $d ]] && skip=true && break
  done
  
  IFS=':' read -ra FILES <<< "$SKIP_FILES"
  for f in "${FILES[@]}"; do
    [[ "$file" == $f ]] && skip=true && break
  done
  
  [ "$skip" = true ] && continue

  # Test each pattern
  for pattern in "${PATTERNS[@]}"; do
    if git show ":$file" 2>/dev/null | grep -Eq -- "$pattern"; then
      echo -e "${RED}🔴 SECRET DETECTED${NC} in ${YELLOW}$file${NC}"
      echo "   Pattern matched: $pattern"
      echo "   $(git show ":$file" 2>/dev/null | grep -nE -- "$pattern" | head -3)"
      FOUND=1
    fi
  done
done

# Additional check: .env files (never commit)
ENV_FILES=$(echo "$STAGED_FILES" | grep -E '\.env$|\.env\.' | grep -v '.env.example' || true)
if [ -n "$ENV_FILES" ]; then
  echo -e "${RED}🔴 ENV FILE STAGED${NC}"
  echo "   $ENV_FILES"
  echo "   .env files must never be committed. Unstage with: git reset -- $ENV_FILES"
  FOUND=1
fi

# Check .openclaw/ files
OPENCLAW_FILES=$(echo "$STAGED_FILES" | grep -E '^\.openclaw/' || true)
if [ -n "$OPENCLAW_FILES" ]; then
  echo -e "${RED}🔴 .openclaw/ FILES STAGED${NC}"
  echo "   .openclaw/ contains secrets and session data — never commit!"
  echo "   Unstage with: git reset -- .openclaw/"
  FOUND=1
fi

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  COMMIT BLOCKED — Secrets detected in staged files${NC}"
  echo -e "${RED}  Unstage with: git reset HEAD <file>${NC}"
  echo -e "${RED}  Or if false positive: git commit --no-verify${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Secret scan passed ($(echo "$STAGED_FILES" | wc -l) files)${NC}"
exit 0
