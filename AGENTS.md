# Agent: Noema 🧠

System Intelligence Dashboard for the Alfred agent ecosystem.

| Concern | Path |
|---------|------|
| **Source code** | `/home/promi/.openclaw/workspace/projects/noema/` |
| **Runtime output** | `dashboard.html` (generated, gitignored) |
| **Live state** | `memory/state/` (runtime data, gitignored) |
| **Cron definitions** | `~/.openclaw/cron/jobs.json` |

## Key files

| File | Role |
|------|------|
| `generate.js` | Data pipeline: 22+ sources → single HTML |
| `archive/v4.html` | HTML template (~920 lines) |
| `relay.js` | Browser action receiver (HTTP :18998) |
| `action-processor.js` | JSONL → Gateway API → Alfred (10min timer) |
| `qa-prompt.md` | Nightly QA cron prompt (03:00) |
| `research-prompt.md` | Product research cron prompt (01:00) |

## Before you finish (required)

**Do not skip build verification.** Run `node generate.js` and verify `curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:8080/dashboard.html` returns 200.

Read `CONTRIBUTING.md` before making changes.
