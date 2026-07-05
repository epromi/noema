#!/usr/bin/env bash
set -euo pipefail

echo '🧠 Noema Dev Loop Bootstrap'
echo

ready=true

if command -v cursor >/dev/null 2>&1; then
  echo "cursor: $(command -v cursor)"
else
  echo 'cursor: not found'
  ready=false
fi

if command -v node >/dev/null 2>&1; then
  echo "node: $(command -v node) ($(node --version))"
else
  echo 'node: not found'
  ready=false
fi

if command -v npm >/dev/null 2>&1; then
  echo "npm: $(command -v npm) ($(npm --version))"
else
  echo 'npm: not found'
  ready=false
fi

echo
echo "branch: $(git rev-parse --abbrev-ref HEAD)"
echo "commit: $(git rev-parse --short HEAD)"
echo

if [[ "$ready" == true ]]; then
  echo '✅ Ready'
else
  echo '❌ Not ready — install missing tools above'
  exit 1
fi
