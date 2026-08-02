# Noema Feature Benchmark — 2026-08-02

> **Scope**: Noema dashboard vs Grafana (v13.1), Vercel Observability, Linear (2026), Datadog APM
> **Sources**: Grafana docs (v13.1, v13.0, v12.4, v12.3), Vercel observability docs + changelog, Linear changelog, Datadog APM product page
> **Method**: web_fetch from competitor documentation, changelogs, and product pages
> **Output**: bench-features.md — findings + gap analysis + Noema adaptation priority

---

## 1. Recent Feature Launches (H1 2026)

### Grafana v13.1 (June 2026)
| Feature | How It Works | Why It Matters |
|---------|-------------|----------------|
| **Git Sync with Verified Commits** | Dashboard-as-code: edit in Grafana UI → commit to Git repo. Supports GPG/SSH/S/MIME signed commits, branch protection. Import dashboards from JSON directly into synced folders. README.md rendering in folder view. | Auditable dashboard changes, GitOps for ops teams. Noema already uses Git for version control — could auto-commit generated dashboard snapshots. |
| **Quick Filters & Grouping (GA)** | Single "Filter and Group by" control replaces template variables. Default filters, recent history, unified overview, panel-level drilldowns. | Reduces dashboard configuration complexity. For Noema: quick filter agents by status, time range, project. |
| **Copy/Paste Panel Styles (GA)** | Copy display options + field styling from one panel, paste to another of same type. No panel duplication needed. | Reduces repetitive manual panel configuration. Noema equivalent: consistent card/panel styling across all sections. |
| **Section-Level Variables (GA)** | Scoped template variables per row/tab. Changing `$instance` only affects panels in that section, not the whole dashboard. | Critical for unified dashboards that show multiple domains. Noema sections (System, Agents, H1, KG) could have independent filter states. |
| **Time Series to Table Transformation (GA)** | Convert time series results → table rows with sparkline trend field. Compact at-a-glance overviews across many series. | Would shine in Noema's Cron Health Timeline (F-07) — sparklines per cron job over 24h. |
| **Annotations Clustering (GA)** | Auto-group adjacent annotations, aggregate into scrollable tooltip. Indicator controls for visibility. | Noema's timeline could cluster Nightly Staff Reviews by week, show summary on hover. |
| **Grafana Assistant Queries (Snowflake, Jira, Dynatrace +5)** | Natural language queries across databases + observability data. Ask questions, get dashboards. | AI-powered query is table stakes now. Noema could add natural language search across agents/decisions/cron runs. |

### Grafana v13.0 (April 2026)
| Feature | How It Works | Why It Matters |
|---------|-------------|----------------|
| **Dynamic Dashboards (GA)** | New layout engine: panels auto-arrange based on data shape. Old dashboards auto-migrated. Templates + AI Assistant customization. | The "blinking cursor" problem solved — no empty dashboard. Noema currently has a fixed HTML template. |
| **Grafana Assistant On-Prem (GA)** | AI assistant available for self-managed Grafana. Connects to Grafana Cloud via one-click. Analyzes telemetry, builds dashboards, answers questions. | Proves on-prem AI assistant is viable. Noema could integrate OpenClaw as its "assistant" natively. |
| **Dashboard Templates + AI Customization** | Pre-built templates for common patterns. Assistant customizes to your metric names, data sources. | Noema: template for common agent fleet layouts, customizable per host. |
| **Saved Queries with Variable Substitution** | Reusable queries with inline variable mapping. Cross-dashboard query library with RBAC. | Noema equivalent: reusable data pipeline configs (which metrics to collect from which agents). |
| **Panel Styles (GA)** | Curated visual presets (colors, thresholds, display) for time series, gauge, stat, bar charts. One-click apply. | Noema: consistent color schemes for alert severity, agent status, cron health. |
| **Restore Deleted Dashboards** | "Recently deleted" view, self-service restore. | Low priority for single-user Noema, but good UX pattern. |

### Vercel (H1 2026)
| Feature | How It Works | Why It Matters |
|---------|-------------|----------------|
| **AI Gateway Logs (Jul 2026)** | Dedicated page: every AI request's cost, token counts, duration, fallback path. Filterable, shareable by URL. | Directly maps to Noema's F-10 Cost Tracking. Vercel shows per-request cost + fallback — Noema should track per-agent token spend. |
| **Expanded Workflow Run Search (Jul 2026)** | Filter runs by workflow, env, deployment, region, custom attributes. Typeahead suggestions, shareable queries. | Maps to Noema's P1 Cron Health Timeline. Searchable agent/cron run history with filters. |
| **Observability Plus** | Paid tier: longer retention, finer granularity, more metrics. Route-level latency, error rate breakdowns, drill-down to logs. | Noema is self-hosted/free — but the data granularity pattern (route-level → session-level drilldown) is worth copying. |
| **Notebooks** | Save and organize observability queries. Persistent, shareable query collections. | Noema equivalent: saved dashboard views / preset filter combinations. |
| **Monitoring → Observability migration** | Vercel deprecated Monitoring, replaced with Observability Plus + Notebooks. Legacy queries sunset. | Pattern: query consoles evolve into notebook-based exploration. Noema's F-06 Audit Trail could be notebook-style. |

### Linear (H1 2026)
| Feature | How It Works | Why It Matters |
|---------|-------------|----------------|
| **Loops (Jul 2026)** | AI agent for recurring work — scheduled or event-driven. Reviews incoming issues, dispatches to agents, keeps docs up-to-date. | This IS what Noema's cron jobs + Otto do. Linear just productized it. Validates Noema's agent orchestration approach. |
| **Guided Reviews (GA, Jul 2026)** | AI breaks diffs into focused sections with explainers. Bigger context window, better latency. Runs on Business/Enterprise. | Maps to Noema's F-20 Agent Decision Trace — AI explains agent decisions, not just shows tool calls. |
| **Agent-Assisted Editing (Jul 2026)** | AI edits documents and project descriptions. Version history with checkpoints, author attribution (human vs loop). | Noema could use OpenClaw to auto-generate status reports, memory summaries. |
| **Initiative Properties (Jul 2026)** | Priority, labels, status for high-level goals. Custom initiative views on Enterprise. | Noema equivalent: project-level grouping of agents, cron jobs, metrics by initiative. |
| **Desktop Navigation History (Jun 2026)** | Per-tab history stack. Pinned tabs persist across restarts. | Pattern for Noema: tab state persistence, "pinned" sections. Currently Noema has no tabs — F-05/06/07 would need tab navigation. |
| **Filtered View Sharing (Jun 2026)** | Copy URL of any filtered view. Share a subset of a view with someone else. | Noema: shareable dashboard state via URL hash. Currently static — would enable linking to specific agent/cron views. |
| **Coding Sessions on Mobile (Jul 2026)** | Review diffs, comment on lines, iterate with AI from mobile app. | Validates mobile PWA need (Noema F-19). |
| **Command Palette (existing)** | ⌘K opens command palette. Navigate issues, projects, docs, actions without mouse. | Noema's highest priority gap (VISION.md F0). Linear's is the gold standard. |

### Datadog APM (2026)
| Feature | How It Works | Why It Matters |
|---------|-------------|----------------|
| **Watchdog AI** | Automated root cause analysis. ML-based anomaly detection. Error/latency outlier surfacing at query time. | Maps to Noema F-04 health alerts (agent anomaly detection: CPU spike, session leak, memory bloat, KG orphan). |
| **Deployment Tracking** | Correlate performance with deployments, feature flags, config changes. Version comparison before/during/after. | Noema equivalent: track performance changes pre/post gateway upgrade, config changes, model switches. |
| **Error Tracking with Intelligent Grouping** | Auto-group errors into issues across services. Reduces noise. | Noema: auto-group agent errors, cron failures into issues with root cause grouping. |
| **Trace Explorer** | Real-time search and analysis of traces. Query with relational operators. | Noema: search across agent sessions, tool calls, cron runs. Currently no search at all. |
| **Correlated Telemetry** | Traces ↔ logs ↔ RUM ↔ synthetics ↔ profiles in one view. | Noema: correlate agent activity ↔ system metrics ↔ cron runs ↔ KG changes. Currently siloed sections. |
| **SLOs, Monitors, Synthetic Tests** | Proactive reliability via UI, Terraform, APIs. | Noema: SLO for agent uptime, cron success rate, memory health score. |
| **Single-Step Instrumentation** | Auto-instrument without code changes or restarts. | Noema is self-instrumented (generate.cjs → relay.cjs → OpenClaw API). Already good. |
| **Fine-Grained Sampling** | Per host/service/endpoint sampling control from UI. | Noema doesn't need sampling (single host). But the principle of adjustable data collection is worth noting. |

---

## 2. UX Patterns Becoming Standard (2026)

### 2.1 AI-First Dashboards
**Every major dashboard tool now has AI**: Grafana Assistant, Datadog Watchdog, Linear Agent/Loops, Vercel AI Gateway.
- Natural language queries instead of config
- AI-suggested dashboards based on connected data
- AI explains anomalies instead of just showing them
- **Noema gap**: Zero AI integration in the dashboard UX. OpenClaw IS the AI — but the dashboard doesn't let you ask "why is Viktor failing?" or "show me all H1 reports from this week" directly from the UI.

### 2.2 Command Palette (⌘K)
**Linear made it mandatory. Now everyone expects it.**
- Keyboard-first navigation → click on nothing
- Context-aware actions ("kill agent X", "jump to H1 Z")
- Fuzzy search across all entities
- **Noema gap**: None. This is already identified as F0 priority. Blocked on SvelteKit migration.

### 2.3 Git-Synced Configuration (GitOps)
**Grafana's Git Sync is GA. Vercel's Integrations link to Git.**
- Dashboard-as-code: edit in UI, commit to repo
- PR-based review workflow for dashboard changes
- Verified/signed commits for audit trails
- **Noema gap**: Noema IS in Git already (279 commits), but dashboard changes are generated, not committed. Git Sync pattern would mean auto-committing generated dashboards + snapshot diffs.

### 2.4 Real-Time Push Updates
**SSE/WebSocket replaces polling.**
- Grafana: Live streaming for time series
- Vercel: Real-time build/deploy status
- Datadog: Live tail, real-time trace streaming
- Linear: Real-time issue updates across clients
- **Noema gap**: Noema is static HTML regenerated periodically. F-17 (WebSocket Real-Time) is P3. This should be higher priority.

### 2.5 Drill-Down / Zoom-to-Detail
**Every competitor: click a data point → see the details.**
- Grafana: Panel → Log context, time range zoom
- Vercel: Chart → Route → Function → Logs
- Datadog: Trace → Span → Code line
- Linear: Issue → Diff → Code line comment
- **Noema gap**: Noema's dashboard is flat. Click on "Viktor: critically stale" → nothing happens. Each alert/status should be a drillable link.

### 2.6 Notebook-Style Exploration
**Saved queries, custom views, shareable state.**
- Vercel: Notebooks for saved observability queries
- Datadog: Notebooks for collaborative investigation
- Linear: Filtered view sharing via URL
- **Noema gap**: Noema has one static view. No way to save a filtered state, share a specific agent's timeline, or bookmark a cron job view.

### 2.7 Anomaly Detection / Proactive Alerting
**ML-based, not threshold-based.**
- Datadog Watchdog: Automatic anomaly detection
- Grafana: Alert rules with ML forecasting (via ML plugin)
- **Noema gap**: Noema shows alerts, but they're statically generated. No anomaly detection like "Viktor's session duration suddenly 3x normal" or "KG growth rate dropped 80%".

### 2.8 Mobile-First / PWA
**Linear has mobile coding sessions. Grafana has mobile app.**
- Both allow triage on-the-go
- **Noema gap**: F-19 (Mobile PWA) is P3. Given András checks status from phone, this should be higher.

---

## 3. Features Noema Is Missing — Prioritized Gap Analysis

### 🔴 CRITICAL GAPS (Noema has nothing)

#### GAP-01: Command Palette (⌘K)
| Attribute | Detail |
|-----------|--------|
| **Competitor** | Linear |
| **How it works** | ⌘K opens fuzzy-search palette. Type to find issues, projects, docs, or trigger actions. Keyboard-driven: never touch mouse. |
| **Noema current** | HTML page, no keyboard shortcuts, no search |
| **Why it matters** | Linear proved this is the single most loved UX feature in any tool. András explicitly prioritized it as F0. Noema has 6+ sections, 8+ agents, 26 cron jobs — navigating without search is painful at scale. |
| **Adaptation** | Noema-specific commands: "kill agent X", "spawn Viktor Y-ra", "jump to H1 program Z", "show cron history for system-health". Not a generic menu — purpose-built for agent/cron workflow. |
| **Priority** | 🔴 F0 — already on roadmap |

#### GAP-02: Real-Time Updates (SSE/WebSocket)
| Attribute | Detail |
|-----------|--------|
| **Competitor** | All four (Grafana Live, Vercel real-time, Datadog live tail, Linear real-time) |
| **How it works** | Server pushes data changes to client. No page refresh needed. Agent status changes, cron completions, new alerts appear immediately. |
| **Noema current** | Static HTML regenerated by generate.cjs. Must refresh browser to see updates. |
| **Why it matters** | When you're watching a Viktor audit or an Otto nightly review, refreshing every 30 seconds is terrible UX. Real-time is standard in 2026. |
| **Adaptation** | SSE via relay.cjs (already planned). Push: agent status changes, cron completions, new alerts. Keep static HTML as fallback. |
| **Priority** | 🟡 P1 (upgrade from current P3) |

#### GAP-03: Drill-Down / Interactive Navigation
| Attribute | Detail |
|-----------|--------|
| **Competitor** | All four |
| **How it works** | Every data point is clickable. Click agent → session history. Click cron run → logs. Click alert → root cause. Click timeline event → full details. |
| **Noema current** | Flat HTML. Clicking does nothing. All data is passive display. |
| **Why it matters** | The single biggest UX gap. Noema shows WHAT but not WHY. "Viktor: critically stale" — why? When was last session? What's the error? User must SSH to find out. |
| **Adaptation** | Each section becomes a drillable entry point. Agent card → session timeline → tool call trace. Cron run → logs → error context. Alert → linked evidence. |
| **Priority** | 🔴 F0 — prerequisite for making the dashboard actually useful |

#### GAP-04: AI Assistant / Natural Language Query
| Attribute | Detail |
|-----------|--------|
| **Competitor** | Grafana Assistant, Datadog Watchdog, Linear Agent |
| **How it works** | Ask in natural language: "Why did Viktor fail last night?" → AI queries data, shows relevant traces/logs, explains root cause. |
| **Noema current** | Zero AI in dashboard. Must switch to chat surface (Alfred) to ask questions. |
| **Why it matters** | Noema's core purpose IS AI agent monitoring. Not having an AI query interface for an AI monitoring dashboard is ironic. OpenClaw IS the AI — wire it in. |
| **Adaptation** | In-dashboard chat widget → sends queries to Alfred/OpenClaw → Alfred returns structured response rendered in dashboard. NOT a generic chatbot — context-aware about agent fleet, cron history, H1 pipeline. |
| **Priority** | 🟡 P1 |

#### GAP-05: Search Across All Entities
| Attribute | Detail |
|-----------|--------|
| **Competitor** | Linear (⌘K), Datadog Trace Explorer, Grafana search |
| **How it works** | Type any term → fuzzy match across agents, cron jobs, alerts, H1 programs, timeline events, KG nodes. |
| **Noema current** | Ctrl+F on HTML page. Only searches visible text. |
| **Why it matters** | 8 agents, 26 cron jobs, 320+ KG nodes, timeline events — finding "Viktor's phpBB audit from July" requires manual scrolling. |
| **Adaptation** | Part of command palette. Search index: agent names, cron names, alert IDs, H1 program names, KG entity labels, timeline event titles. Pre-built on data load. |
| **Priority** | 🟡 P1 (bundled with GAP-01) |

### 🟠 MAJOR GAPS (Noema has partial/wrong approach)

#### GAP-06: Time Series Visualization
| Attribute | Detail |
|-----------|--------|
| **Competitor** | Grafana (native), Datadog (native), Vercel (charts) |
| **How it works** | Line charts, bar charts, sparklines over time. Zoom, pan, hover tooltips. Compare time periods. |
| **Noema current** | F-07 (Cron Health Timeline) is planned as Gantt bars. System metrics (CPU, RAM, disk) are single-point gauges. |
| **Why it matters** | "CPU is 7% now" is useless. "CPU was 95% at 3 AM and crashed Otto" is actionable. Time-series makes patterns visible. |
| **Adaptation** | Collect time-series snapshots every N minutes (system metrics, agent status, cron run times). Render as line charts with Grafana-style zoom. Cron Health Timeline as sparkline + Gantt hybrid. |
| **Priority** | 🟡 P1 — prerequisite for F-07 to be useful |

#### GAP-07: Anomaly Detection / Smart Alerts
| Attribute | Detail |
|-----------|--------|
| **Competitor** | Datadog Watchdog, Grafana ML alerts |
| **How it works** | ML models detect: "this metric is 3σ from baseline". Not threshold-based — pattern-based. Surface correlation: "Viktor's CPU spike coincided with KG node count jump." |
| **Noema current** | Static alerts generated by generate.cjs from raw data. Fixed thresholds (e.g., "3 agents critically stale"). No correlation. |
| **Why it matters** | The most useful alerts are the ones you didn't know to look for. "Viktor has been slow for 3 days" reads different from "Viktor's session duration is 3x normal, started after gateway upgrade — likely timeout config issue." |
| **Adaptation** | Lightweight: rolling baseline (7-day window), flag anything outside 2σ. No ML needed — simple statistical outlier detection. |
| **Priority** | 🟠 F2 (upgrade from current F-04 approach) |

#### GAP-08: URL-Sharable State
| Attribute | Detail |
|-----------|--------|
| **Competitor** | Linear (filtered view URL), Vercel (Observability filter URL), Grafana (dashboard URL with time range) |
| **How it works** | Dashboard state (filters, time range, selected tab/section) encoded in URL hash/fragment. Share link → recipient sees same view. |
| **Noema current** | Single URL, no state encoding. |
| **Why it matters** | "Check Viktor's last 3 sessions" requires instructions, not a link. Shareable state = faster handoff, bookmarkable views. |
| **Adaptation** | Hash-based routing: `#agent=viktor&range=7d&tab=sessions`. Simple, no backend needed. |
| **Priority** | 🟢 P2 |

### 🟢 MODERATE GAPS

#### GAP-09: Notebook / Saved Views
| Attribute | Detail |
|-----------|--------|
| **Competitor** | Vercel Notebooks, Datadog Notebooks |
| **How it works** | Save a set of queries/filters/charts as a named "notebook". Revisit later. Share with others. |
| **Noema current** | Nothing. |
| **Adaptation** | Saved dashboard presets: "H1 Wednesday Review", "Weekend Health Check", "KG Growth Report". Each loads specific filters + time range. |
| **Priority** | 🟢 P2 |

#### GAP-10: Mobile PWA
| Attribute | Detail |
|-----------|--------|
| **Competitor** | Linear mobile app (full coding sessions), Grafana mobile app |
| **How it works** | Dedicated mobile interface or responsive PWA. View status, triage alerts, approve actions from phone. |
| **Noema current** | Desktop-only HTML. Not responsive. |
| **Why it matters** | András checks agent status from phone (Tailscale). Mobile PWA = quick health check without laptop. |
| **Priority** | 🟡 P1 (upgrade from current P3) — aligns with Tailscale phone use case |

---

## 4. Noema's Advantages (Don't Lose These)

These are features Noema has that NO competitor offers for the same use case:

| # | Feature | Competitor Equivalent | Why Noema Wins |
|---|---------|----------------------|----------------|
| 1 | **Agent Lifecycle Monitoring** | Datadog APM (service monitoring) | Noema monitors AI agents specifically — CPU, session state, spawn/exit lifecycle. Datadog monitors microservices. Different domain. |
| 2 | **H1 Bug Bounty Dashboard** | None | No competitor has integrated bug bounty tracking. This is pure Noema DNA. |
| 3 | **Memory Health Audit Trail** | Datadog Logs | Noema's KG integrity, daily memory, Otto nightly reviews are AI-memory-specific. Datadog is generic logs. |
| 4 | **Decision Trace Visualization** | Datadog Trace Explorer | Datadog traces code execution. Noema traces AI agent decisions — tool calls, reasoning chains (planned), cascade effects across sub-agents. |
| 5 | **Cron Job Timeline** | None (cron-specific) | Grafana can monitor cron via metrics, but Noema's grouped-by-period, live countdown, per-job health coloring is purpose-built for OpenClaw cron fleet. |
| 6 | **Action Queue Kanban** | Linear (issue tracking) | Linear tracks software issues. Noema tracks agent-generated tasks (Otto action items, Nova QA findings) in a Kanban flow. Different domain. |

---

## 5. Priority Matrix (Consolidated)

| Priority | GAP | Feature | Effort | Competitor | Roadmap ID |
|----------|-----|---------|--------|------------|------------|
| 🔴 F0 | GAP-01 | Command Palette (⌘K) | 3-5h | Linear | F-00 (VISION) |
| 🔴 F0 | GAP-03 | Drill-Down Navigation | 5-8h | All four | NEW |
| 🟡 P1 | GAP-02 | Real-Time SSE/WS | 8-12h | All four | F-17 (upgrade from P3) |
| 🟡 P1 | GAP-04 | AI Query Interface | 4-6h | Grafana, Datadog, Linear | NEW |
| 🟡 P1 | GAP-05 | Entity Search | 2-3h | Linear, Datadog | NEW (bundled w/ GAP-01) |
| 🟡 P1 | GAP-06 | Time Series Charts | 4-6h | Grafana, Datadog, Vercel | F-07 prerequisite |
| 🟡 P1 | GAP-10 | Mobile PWA | 4-6h | Linear, Grafana | F-19 (upgrade from P3) |
| 🟠 F2 | GAP-07 | Anomaly Detection | 3-4h | Datadog Watchdog | F-04 upgrade |
| 🟢 P2 | GAP-08 | URL-Sharable State | 1-2h | Linear, Vercel | NEW |
| 🟢 P2 | GAP-09 | Saved Views/Notebooks | 2-3h | Vercel, Datadog | NEW |

---

## 6. Strategic Recommendations

### 6.1 The "Drill-Down First" Strategy
Noema's #1 problem is NOT missing features — it's that the features it HAS are passive. Every metric, every alert, every status badge should be a gateway to more detail. **Drill-down (GAP-03) is the prerequisite that makes all other features useful.**

### 6.2 Command Palette + Search = Navigation Foundation
Before adding more sections (F-05/06/07/09/10), Noema needs a way to navigate existing ones. **Command palette (GAP-01 + GAP-05) should ship before any new data panels.**

### 6.3 AI Integration Is a Differentiator, Not a Copy
No competitor has an AI assistant that was purpose-built to monitor an AI agent fleet. Grafana Assistant queries databases; Linear Agent writes code. **Noema's AI query should let you talk to your agents through the dashboard.** This is NOT a copy of Grafana Assistant — it's a completely different value proposition.

### 6.4 Linear Loops Validates Noema's Architecture
Linear's July 2026 "Loops" launch proves the market is moving toward exactly what Noema does: scheduled/event-driven AI agents doing recurring work. Noema's cron fleet + agent orchestration is ahead of this curve. The dashboard needs to catch up to the backend.

### 6.5 Time Series Is Table Stakes
System metrics (CPU, RAM, disk) as single-point gauges is a 2010 pattern. Even hobby dashboards (Grafana free tier, Beszel) have time-series charts. F-07 (Cron Health Timeline) should be redesigned to include sparklines + charts, and system metrics should get the same treatment.

---

*Generated: 2026-08-02 06:30 CEST | Agent: Alfred | Research: web_fetch from competitor docs*
