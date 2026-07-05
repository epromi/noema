#!/usr/bin/env bash
# dev-log.sh — Structured dev-log helper for dev-loop.sh
# SOURCE this file: source scripts/dev-log.sh

# Initialize the dev log for a package run
dev_log_init() {
  local PKG_ID="$1"
  DEV_LOG="logs/dev-${PKG_ID}.log"
  mkdir -p logs
  : > "$DEV_LOG"
  echo "[$(date +%H:%M:%S)] 🚀 Pipeline indult: $PKG_ID" >> "$DEV_LOG"
}

# Log a development event
log_dev() {
  local msg="$1"
  if [ -z "$DEV_LOG" ]; then
    DEV_LOG=$(ls -t logs/dev-*.log 2>/dev/null | head -1)
    [ -z "$DEV_LOG" ] && return
  fi
  echo "[$(date +%H:%M:%S)] $msg" >> "$DEV_LOG"
}

# Close the dev log
dev_log_close() {
  local status="${1:-done}"
  [ -n "$DEV_LOG" ] && echo "[$(date +%H:%M:%S)] ✅ Pipeline vége: $status" >> "$DEV_LOG"
}
