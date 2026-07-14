# Noema Vision

> **North Star**: Build the best operations dashboard that has ever existed.
> First milestone: reach feature parity with the top 4 competitor dashboards.
> **But**: don't copy — adapt, customize, and if possible, do it BETTER.

## Design Principles for Competitive Research

1. **Fit first**: Ha egy feature nem illik a Noema koncepcióba → kihagyjuk, akkor is ha minden versenytárs csinálja
2. **Adapt, don't copy**: Ami hasznos, azt a MI kontextusunkra szabjuk (agent monitoring, cron viz, H1 tracking, memory health)
3. **Do it better**: Ha tudunk jobbat → ne érjük be a paritással, csináljuk jobban
4. **Noema DNA preserved**: Az unfair advantage-ek (6 Noema-only feature) maradnak és fejlődnek

## Research Method

**Active web research — not just text scraping.** For each competitor, use:

| Tool | Purpose |
|------|---------|
| `web_search` | Find latest features, reviews, changelogs, comparisons |
| `browser` | Screenshot actual dashboards, observe UX patterns live |
| `web_fetch` | Read docs, blog posts, feature pages for details |

Run quarterly at minimum. Store findings in `research/competitive/`.

## Competitor Feature Matrix

| Feature | Hermes (Meta) | Grafana | Vercel | Linear | Noema |
|---------|:---:|:---:|:---:|:---:|:---:|
| Build pipeline viz | ✅ | ⚠️ | ✅ | ❌ | ❌ |
| Real-time job status | ✅ | ❌ | ✅ | ❌ | ⚠️ |
| Customizable widgets | ❌ | ✅ | ❌ | ❌ | ❌ |
| Alert rules | ❌ | ✅ | ❌ | ❌ | ❌ |
| Dark/light theme | ❌ | ✅ | ✅ | ✅ | ✅ |
| Command palette | ❌ | ❌ | ❌ | ✅ | ❌ |
| Keyboard shortcuts | ❌ | ❌ | ❌ | ✅ | ❌ |
| Quick filters | ❌ | ⚠️ | ⚠️ | ✅ | ❌ |
| Deployment preview | ❌ | ❌ | ✅ | ❌ | ❌ |
| Dependency graph | ✅ | ❌ | ❌ | ❌ | ❌ |
| Time-series data | ❌ | ✅ | ❌ | ❌ | ⚠️ |
| Rollback flow | ❌ | ❌ | ✅ | ❌ | ❌ |
| Agent/process timeline | ❌ | ❌ | ❌ | ❌ | ✅ |
| H1 program tracking | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cron job monitoring | ❌ | ❌ | ❌ | ❌ | ✅ |
| Memory health audit | ❌ | ❌ | ❌ | ❌ | ✅ |
| Action queue (Kanban) | ❌ | ❌ | ❌ | ⚠️ | ✅ |

### Gap → PKG Pipeline

**Nem másolunk — adaptálunk.** Minden versenytárs feature-nél:

1. **Fit check**: Illik a Noema koncepcióba? (agent monitoring, cron viz, memory health, H1 tracking, decision trace)
   - Ha nem → ❌ kihagyjuk, akkor is ha mindenki más csinálja
2. **Better check**: Tudjuk jobban csinálni mint ők?
   - Ha igen → 🚀 saját verzió, nem copy-paste
3. **Adapt**: Ha hasznos de a mi kontextusunk más → testre szabjuk
   - Pl. Grafana alert rule-ok helyett: "Agent health anomaly detection" (CPU spike, session leak, memory bloat)
   - Pl. Linear command palette: Noema-specifikus parancsokkal ("kill agent X", "spawn Viktor Y-ra", "jump to H1 program Z")

Minden "Noema = ❌ but competitor = ✅" cell egy **potenciális** PKG — de csak a fit check után.

1. Multiple competitors have it (industry standard)
2. Direct user value (András workflow improvement)
3. Implementation complexity (XS < M < L < XL)

## Strategic PKG Backlog (from competitive gaps — adapted)

| # | Feature | Competitor Inspo | Noema Adaptation | Priority |
|---|---------|-------------------|------------------|----------|
| 1 | Command palette | Linear | Noema-specifikus parancsok: "kill agent X", "spawn Viktor Y-ra", "jump to H1 Z" — nem generikus menü | 🔴 F0 |
| 2 | Keyboard shortcuts | Linear | Agent-műveletekre optimalizálva (K=kill, S=spawn, R=restart), nem code-editor minták | 🟡 F2 |
| 3 | Customizable layout | Grafana | Widget-ek helyett: tab sorrend átrendezése + mely panelek látszanak a dashboard-on | 🟠 F1 |
| 4 | Health alerts | Grafana | Agent anomaly detection: CPU spike, session leak, memory bloat, KG node orphan — nem generikus threshold rule-ok | 🟠 F1 |
| 5 | Quick filters | Linear | Projekt/agent/időszak szerinti szűrés timeline-on és kanban-on — nem issue-tracker filterek | 🟡 F2 |
| 6 | Build pipeline viz | Hermes, Vercel | Noema CI pipeline viz (secrets scan → syntax → typecheck → build → test → deploy) — nem generikus CI viz | 🟢 F3 |
| 7 | Deployment preview | Vercel | Dev branch dashboard deploy preview, PKG-ok változásának vizuális diff-je | 🟢 F4 |

### Ami NEM kell (fit check ❌)

| Feature | Miért nem |
|---------|----------|
| Grafana dashboard variánsok (templating) | Noema egy felhasználós dashboard, nem multi-tenant |
| Vercel rollback flow | Noema nem hosting platform, deploy nem CD-n megy |
| Hermes dependency graph | Noema nem monorepo CI rendszer |
| Linear issue tracking / sprint planning | Jira-ban van, nem duplikáljuk |

## Research Cadence

- **Quarterly deep-dive**: browser screenshots + full feature matrix update
- **Monthly quick scan**: web_search for new features, changelogs, blog posts
- **Nova nightly**: references this matrix when prioritizing PKGs

## Noema's Unfair Advantages

What Noema has that NO competitor offers — don't lose these:

1. **Agent lifecycle monitoring** — real-time CPU, session, status per agent
2. **H1 bug bounty dashboard** — integrated program/report tracking
3. **Memory health audit trail** — Otto nightly reviews, KG integrity
4. **Decision trace visualization** — audit trail of agent decisions
5. **Cron job timeline** — grouped by period, live countdowns
6. **Action queue Kanban** — Otto-generated tasks with workflow states
