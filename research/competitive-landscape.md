# Noema Competitive Landscape Research
# Generated: 2026-07-05 10:02 CEST
# Source: web_search + web_fetch of 8 competitor products

## 🧠 Hermes Ecosystem (closest relatives)

Four independent dashboard projects built around NousResearch Hermes Agent — all solving the same problem Noema solves.

---

### 1. Hermes Studio (JPeetz / GitHub)
**URL:** https://github.com/JPeetz/Hermes-Studio
**Stack:** React 19, TypeScript, TanStack, MIT license
**Status:** Active, 199 tests across 17 files, Playwright e2e

**Key Features (30+):**
| Feature | Details |
|---------|---------|
| Multi-Agent Crews | Named crews, live activity feeds, per-crew token cost tracking |
| Interactive Knowledge Graph | Force-directed D3 graph, zoom/pan/node drag/hover highlights |
| Visual Workflow Builder | DAG-structured task pipelines, topological order, live per-node status |
| Cron Job Manager | Create/edit/pause/trigger/monitor from UI; live SSE streaming into job cards |
| Audit Trail | Chronological timeline of every tool call, message, approval; filter by session/event type/date |
| Logs Viewer | Last 500 lines from ~/.hermes/logs/, color-coded, All/Errors filter, live search, auto-scroll |
| Cost Tracking | Per-crew token usage (input/output), estimated API cost, model-aware price table |
| Execution Approvals | Approve/deny/always-allow shell commands from UI; resolved receipts inline |
| Agent Library | Create custom agents with system prompts, emoji, roles, model overrides |
| Clone Crew | One-click crew duplication, mints fresh sessions |
| Session Persistence | Auth tokens + sessions survive server restarts via Redis |
| Backup & Import | One-click data backup and restore |
| 8-Theme System | Official, Classic, Slate, Mono — each with light/dark variants |
| Profile-Scoped Workspaces | Per-crew member isolated file system views |
| Security Hardened | Auth middleware, CSP headers, path traversal guards, exec approval prompts |
| PWA | Full feature parity on mobile via Tailscale |
| Skills Management | Install/uninstall/toggle skills from browser; 2000+ skills |
| MCP Server Management | Add/edit/remove MCP servers from Settings UI; live reload |
| Crew Templates | 7 built-in + 4 conductor (Research, Build, Review, Deploy) |

**Noema Gap Analysis:**
- ❌ No Knowledge Graph visualization
- ❌ No Audit Trail / Activity Feed
- ❌ No Logs Viewer
- ❌ No Visual Workflow Builder
- ❌ No Cost Tracking
- ❌ No Agent Library Editor (system prompts via UI)
- ❌ No Theme System (single dark theme)
- ✅ Has Cron Manager (via openclaw cron CLI)
- ✅ Has Per-Tab Workspaces (8 tabs)
- ✅ Has Agent Status Panel

---

### 2. Hermes Dashboard (Kori-x / GitHub)
**URL:** https://github.com/Kori-x/hermes-dashboard
**Stack:** React 19, TypeScript, Vite, Node.js bridge, Python plugin
**Status:** Active, MIT license

**Key Features:**
| Feature | Details |
|---------|---------|
| Real-time Session Monitoring | Phase tracking: processing → idle → awaiting input → needs approval |
| Context Window Visualization | Per-session token usage visual |
| Subagent Tracking | Per-session subagent spawn tree |
| Auto-Generated Wiki | Reads skills, plugins, config, memory, soul from ~/.hermes/ → searchable wiki |
| Tool Usage Breakdown | Per-session tool call statistics |

**Architecture Pattern:**
```
Hermes Agent → hermes_dashboard plugin → Unix socket → Bridge server (Node.js)
  ├── WebSocket :3001 → React dashboard (live updates)
  └── HTTP :3002 → Wiki API (reads ~/.hermes/)
```

**Noema Gap Analysis:**
- ❌ No Session Phase Tracking (only "Online/Error/Unknown")
- ❌ No Context Window Visualization
- ❌ No Auto-Generated Documentation from filesystem
- ✅ Has Subagent Tracking (via generate.js subagent list)
- ✅ Has Tool Reference (via static agents-roster.md)

---

### 3. Hermes Agent Official Web Dashboard
**URL:** https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard
**Stack:** FastAPI + Uvicorn, Python PTY helper

**Key Features:**
| Feature | Details |
|---------|---------|
| Profile Switcher | Machine-level management: one server, multiple profiles |
| URL-based Profile Selection | `?profile=<name>` deep links, survives refresh |
| Per-Profile Scoping | Config, API Keys, Skills, MCP, Models all follow profile switcher |
| Chat Tab | Embedded PTY terminal for direct agent interaction |
| Cron Aggregation | Cross-profile cron view with filter |

**Noema Gap Analysis:**
- This is more of an admin panel than monitoring dashboard
- Profile switching = not applicable (Noema is single-machine)
- Chat tab = not applicable (Alfred runs in Telegram)
- Cron aggregation = ✅ already done

---

### 4. Hermes Atlas — Mission Control
**URL:** https://hermesatlas.com/projects/builderz-labs/mission-control
**Stack:** SPA shell, SQLite, zero external deps, pnpm
**Status:** Alpha, active development

**Key Features:**
| Feature | Details |
|---------|---------|
| 32 Panels | Tasks, agents, skills, logs, tokens, memory, security, cron, alerts, webhooks, pipelines |
| Real-time Everything | WebSocket + SSE push updates, smart polling (pauses when away) |
| Zero External Deps | SQLite, single `pnpm start`. No Redis, Postgres, Docker |
| Role-Based Access | Viewer, Operator, Admin; Google Sign-In with admin approval |
| Quality Gates | Aegis review system blocks task completion without sign-off |
| Skills Hub | Browse, install, security-scan agent skills from ClawdHub |
| Multi-Gateway | OpenClaw, CrewAI, LangGraph, AutoGen, Claude SDK adapters |
| Recurring Tasks | Natural language scheduling ("every morning at 9am") → cron template spawning |
| Agent Eval & Security | 4-layer eval, trust scoring, secret detection, MCP call auditing |

**Noema Gap Analysis:**
- ❌ No Quality Gate / Approval system
- ❌ No Role-Based Access
- ❌ No Multi-Gateway support
- ❌ No WebSocket real-time push
- ❌ No Skills Hub integration
- ✅ Has Cron Management (via openclaw CLI)
- ✅ Has Agent Status (via generate.js data pipeline)

---

## 📊 Industry-Standard Observability Platforms

### LangSmith (LangChain)
- **Category:** LLM observability / tracing
- **Strength:** Full trace trees (prompts → tool calls → retrievals), token cost per run, eval harness for regression testing
- **Relevance:** Trace visualization is something Noema doesn't have
- **Pricing:** Free tier; Plus $39/user/month

### Langfuse
- **Category:** Open-source observability
- **Strength:** MIT license, self-hostable, framework-agnostic Python/TS SDKs, prompt versioning, dataset workflows
- **Relevance:** Session trace + prompt management patterns
- **Overhead:** ~15% in benchmark

### AgentOps
- **Category:** Agent lifecycle monitoring
- **Strength:** Session replay, lifecycle-level monitoring, agent-specific metrics
- **Overhead:** ~12% in benchmark

### Arize
- **Category:** ML model monitoring
- **Strength:** Drift detection, model performance monitoring
- **Relevance:** Overkill for Noema's use case

### Grafana
- **Category:** General observability dashboard
- **Key Principle:** "One dashboard should serve one use case" — Noema already follows this with tabs
- **Pattern:** Audience-driven design, hierarchy of information (overview → detail)

---

## 🎯 Actionable Ideas for Noema (prioritized)

### Tier 1: Quick Wins (implementable in hours)
| # | Idea | Source | Effort |
|---|------|--------|--------|
| 1 | **Logs Viewer Tab** — last 500 lines from `~/.openclaw/logs/`, color-coded by level, filter All/Errors | Hermes Studio | Low |
| 2 | **Audit Trail / Activity Feed** — chronological timeline: session starts, agent spawns, cron triggers, errors | Hermes Studio | Low |
| 3 | **Cron Health Timeline** — last 24h Gantt-style execution bars per cron | Grafana best practices | Low |
| 4 | **Session Phase Tracking** — upgrade status from "Online/Error" to "processing/idle/awaiting/stuck" | Hermes Dashboard | Low |

### Tier 2: Medium Effort (requires infra)
| # | Idea | Source | Effort |
|---|------|--------|--------|
| 5 | **Knowledge Graph Visual** — D3.js force-directed graph from nodes.json + edges.json | Hermes Studio | Medium |
| 6 | **Cost Tracking** — API token usage / $ per agent from model metadata | Hermes Studio | Medium |
| 7 | **Auto-Generated Wiki** — parse agent files, config, skills → searchable docs | Hermes Dashboard | Medium |
| 8 | **Subagent Status Panel** — per-session: spawn time, status, tool call count, completion time | Hermes Dashboard | Medium |

### Tier 3: Ambitious (product differentiator)
| # | Idea | Source | Effort |
|---|------|--------|--------|
| 9 | **Quality Gate / Approval System** — certain operations require sign-off before execution | Mission Control | High |
| 10 | **Session Trace Tree** — full tool call tree per session, like LangSmith trace view | LangSmith | High |
| 11 | **Skills Hub Integration** — browse ClawdHub from dashboard, install/toggle skills | Mission Control | High |
| 12 | **WebSocket Real-Time** — push updates instead of page refresh | Mission Control | High |

---

## 🔑 Noema's Unique Position

**No competitor is OpenClaw-native.** All Hermes dashboards target the Hermes Agent ecosystem. Mission Control has multi-gateway adapters but treats OpenClaw as one of many.

Noema is the **only** monitoring dashboard purpose-built for:
- OpenClaw's cron architecture (49 jobs)
- Multi-agent ecosystem (Alfred, Viktor, Albert, Scout, Hugo, Porter, Otto, Edwin, Helm, Cortex)
- Telegram-native delivery pattern
- HackerOne bug bounty workflow integration
- Hungarian + English bilingual agent personality system

**This is an empty market niche.** No existing product understands OpenClaw's internal architecture the way Noema does.
