# Noema vs Industry — 2026 Best Practice Review

> Dátum: 2026-07-05
> Források: Braintrust, Zylos, DigitalApplied, dev.to, VirtualOutcomes, doolpa.com
> Státusz: ✅ Complete

## Összehasonlító Tábla

| Dimenzió | Iparági standard 2026 | Noema státusz | Illeszkedés |
|----------|----------------------|---------------|-------------|
| **Framework** | SvelteKit 300% YoY növekedés, 42KB vs Next.js 120KB | SvelteKit választva | 🟢 TÖKÉLETES |
| **Architektúra** | Vendor-neutral instrumentation (OTel minta) | Framework-agnostic core: `lib/core/` = plain JS | 🟢 TÖKÉLETES |
| **Data pipeline** | Step-level tracing, nem binary pass/fail | Cron pipeline + 22 adatforrás + agent status tracking | 🟢 JÓ |
| **Live updates** | Real-time monitoring, SSE standard | SSE betervezve (F4 fázis) | 🟢 JÓ |
| **Self-hosted** | "Single container, no external DB" — 2026 trend | Zero external deps, python3 http, 18998 relay | 🟢 TÖKÉLETES |
| **Multi-agent** | "Cascade failure detection" — a legnehezebb | Agent roster + status.md + orchestrator tracking | 🟢 JÓ |
| **⚠️ Reasoning trace** | "4 pillars: tool calls, reasoning, state, memory" | Csak AZT látjuk MIT csinált, nem MIÉRT | 🟡 GAP |
| **⚠️ Evaluation layer** | "Score production traces, feed failures back" | Nincs trace scoring, nincs eval feedback loop | 🟡 GAP |
| **⚠️ OpenTelemetry** | "OTel GenAI v1.41 — iparági konvergencia" | Nincs OTel integráció betervezve | 🟡 GAP |

---

## Erősségek — iparági best practice felett

### 1. SvelteKit választás

**Forrás**: dev.to "SvelteKit vs Next.js in 2026: Why the Underdog is Winning"
- 3 hónapos összehasonlítás: ugyanaz a SaaS mindkét framework-ben
- Bundle: 42KB (gzipped) vs 120KB
- RPS: 1,200 vs 850
- SvelteKit job growth: 300% YoY vs Next.js 12%
- "SvelteKit is the secret weapon of indie hackers and high-paying remote gigs"

**2026-2027 roadmap**: Native Web Components, AI-Powered Compilation, Edge-First Deployments
**Predikció**: "By 2027, SvelteKit will power 30% of new projects (up from 5% today)"

### 2. Framework-agnostic core architektúra

Ez a mi saját innovációnk, az iparág pontosan ezt az irányt követi:
- OpenTelemetry alapelv: "vendor-neutral instrumentation"
- Braintrust: "the same instrumentation should work across platforms"
- A mi `lib/core/` → `lib/components/` szétválasztásunk ezt a mintát követi framework szinten
- Egyetlen versenytárs sem implementálta így — ez Noema differentiator

### 3. Self-hosted, zero external dependencies

**Forrás**: doolpa.com Beszel review (2026)
- "Single Docker container, no external database"
- "Leanest self-hosted option for homelabs and small fleets in 2026"

**Noema**: `python3 -m http.server` + böngésző = kész. Zero Docker, zero DB, zero API key.

### 4. Multi-agent cascade visibility

**Forrás**: Zylos.ai "AI Agent Observability: Tracing, Debugging, and the OpenTelemetry Standard"
- "Single-agent systems have linear failure modes. Multi-agent orchestration introduces cascade failures"
- "An orchestrator misinterprets a sub-agent's output, delegates to the wrong specialist"

**Noema**: Agent roster + status.md per agent + orchestrator cron tracking = cascade visibility

---

## GAP-ek — amit az iparág elvár de hiányzik

### 1. Reasoning Trace (CoT visibility)

**Iparági követelmény**: A Braintrust guide 4 pillére:
1. ✅ Tool calls (Noema: cron pipeline)
2. ❌ **Reasoning steps** — "intermediate chain-of-thought, plan-act-observe transitions, branches"
3. ✅ State transitions (Noema: agent status.md)
4. ⚠️ Memory operations (Noema: napi memory, de nincs trace)

> "Observing an agent's actions is straightforward. Observing its REASONING — why it chose one action over another — remains fundamentally difficult." — Zylos.ai

> "CoT explanations are not always faithful: models sometimes reach correct conclusions through reasoning pathways that differ from what the stated chain-of-thought describes." — Zylos.ai

**Javasolt**: F-05 Reasoning Trace Viewer (P1)
- Capture `<thinking>` blocks from agent sessions
- Display as expandable trace timelines
- Ez a legnagyobb differentiator a Hermes dashboard-októl

### 2. Evaluation Layer

**Iparági követelmény**: Braintrust
- "An evaluation layer that scores production traces and feeds failures back into the eval suite"
- "The free tier includes 1 GB of processed data and 10k evaluation scores per month"

**DigitalApplied**:
- "eval gates, replay" mint alapkövetelmény
- "What to log, trace, and alert on when running AI agents in production"

**Noema jelenleg**: QA cron (`eed1df55`) = statikus ellenőrzés (template integrity, adatfrissesség)
**Hiányzik**: eval feedback loop (trace → score → fail → vissza az agent-hez)

**Javasolt**: F-15 Eval Scoring Engine (P2) — automatikus minőségbírálat agent session-ökön

### 3. OpenTelemetry GenAI Standard

**Iparági konvergencia**: Minden forrás egyetért
- "OTel GenAI v1.41 — az iparág konvergál" (DigitalApplied)
- "OpenTelemetry (OTel) has become the de facto standard for distributed tracing, metrics, and logs" (dev.to)
- Langfuse, Arize Phoenix, LangSmith, AgentOps, Maxim AI, Braintrust — mind OTel-re épül

**Noema jelenleg**: Nincs OTel integráció
**Előny ha lenne**: trace export bármilyen vizualizációs eszközbe (Grafana, Jaeger), standard formátum
**Hátrány ha nincs**: Noema zárt siló marad, nem integrálható külső eszközökkel

**Javasolt**: F-16 OTel GenAI export (P2) — core modulokból span export, Noema a "frontend", OTel a "backend"

---

## Framework Összehasonlítás Részletes

### Next.js (App Router)
- **AI kompatibilitás**: "Excellent — the most AI-friendly framework" — Cursor, Claude, v0 mind mélyen ismeri
- **Bundle**: 120KB gzipped
- **RPS**: 850 req/sec
- **Pro**: Legnagyobb ecosystem, Vercel deploy, rengeteg plugin
- **Con**: Gyakori breaking change-ek, 2-4 óra / major verzió upgrade, over-engineered egyszerű projektekre
- **Job market**: 8,200 pozíció, $120K átlag

### SvelteKit
- **AI kompatibilitás**: Javuló — Cursor egyre jobb SvelteKit támogatással
- **Bundle**: 42KB gzipped (65% kisebb)
- **RPS**: 1,200 req/sec (41% gyorsabb)
- **Pro**: Zero boilerplate, built-in reactivity, nincs useEffect hell, intuitív data loading
- **Con**: Kisebb ecosystem, kevesebb plugin, kevesebb AI tool ismeri
- **Job market**: 1,800 pozíció de 300% YoY növekedés, $135K átlag, 80% remote

**Verdict Noema-ra**: SvelteKit a helyes választás. Dashboard = adatvizualizáció + live update, nem SEO + marketing site. A kisebb bundle + gyorsabb RPS + zero boilerplate pontosan ami kell.

---

## Top 9 Open-Source Dashboard Tool (2026) — MetricFire

| Tool | Erősség | Noema relevancia |
|------|---------|-----------------|
| **Grafana** | Industry standard, multi-source | Túl nagy, túl komplex |
| **Metabase** | SQL-first, üzleti riportok | Nem agent monitoring |
| **Redash** | Query editor, vizualizáció | SQL fókuszú |
| **Superset** | Enterprise BI | Overkill |
| **Beszel** | Single container, lean | ✅ Legközelebbi rokon |
| **Dash0** | Infrastructure monitoring | Nem agent fókuszú |
| **OneUptime** | Status page + monitoring | Részleges átfedés |
| **Uptime Kuma** | Uptime monitoring | Alapértelmezett |

**Következtetés**: A Noema egyedi pozícióban van — egyik open-source dashboard sem AI agent monitoring. A Beszel a legközelebbi filozófiában (lean, self-hosted), de az sem agent fókuszú.

---

## Prioritási Javaslat

| # | Mit | Priority | Indok |
|---|-----|----------|-------|
| **F-05** | Reasoning Trace Viewer | **P1** (emelve P2-ről) | Legnagyobb gap. Azt látni MIÉRT = game-changer |
| **F-15** | Eval Scoring Engine | P2 | Iparági alapkövetelmény, de nem blocking v2 release |
| **F-16** | OTel GenAI export | P2 | Standard, de single-user use case-ben nem azonnali érték |

---

## Források

1. **Braintrust** — "Agent observability: The complete guide for 2026" — 4 pillars framework
2. **Zylos.ai** — "AI Agent Observability: Tracing, Debugging, and the OpenTelemetry Standard" — OTel convergence analysis
3. **DigitalApplied** — "AI Agent Observability 2026: Tracing & Monitoring Stack Guide" — 7 platforms compared
4. **dev.to (PaulTheDev)** — "SvelteKit vs Next.js in 2026: Why the Underdog is Winning" — bundle/RPS benchmarks
5. **VirtualOutcomes** — "Next.js vs SvelteKit: 2026 Comparison for AI Development" — production experience
6. **doolpa.com** — "Beszel Review (2026)" — lean self-hosted monitoring
7. **MetricFire** — "Open Source Dashboards: 9 Best Tools (2026)" — landscape overview
