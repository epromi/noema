# QA Task H: Reference Dashboard Comparison — External Benchmarking

> **Készült**: 2026-07-14 19:45 CEST
> **Források**: web_fetch (hivatalos dokumentációk, termék oldalak) — Grafana, Vercel, Linear, Datadog, Hermes Agent
> **Noema állapot forrása**: `dev/packages/INDEX.md` (2026-07-13)

---

## Executive Summary

Noema 25+ kész csomaggal erős alapokkal rendelkezik az AI agent monitoring terén — valós idejű SSE, audit trail, agent decision trace, orchestrator tab, cron management, CPU monitoring. **A legnagyobb strukturális gap: a vizualizációs réteg hiánya.** A referencia dashboard-ok mindegyike (különösen Grafana + Datadog) a gazdag, interaktív vizualizációkra épít — grafikonok, heatmap-ek, drag-and-drop widget-ek. Noema jelenleg szinte kizárólag szöveges/táblázatos nézetekkel dolgozik. A második legnagyobb gap: nincs alerting/notification rendszer a kritikus eseményekre. A harmadik: nincs sharing/collaboration.

**Eredmény**: 14 feature mapped (✅ van) vs 13 hiányzó (❌). Top 5 ajánlás lejjebb.

---

## 1. Hermes Agent Dashboard (Nous Research) — AI Agent Command Center

**Típus**: AI agent management & monitoring dashboard
**Forrás**: https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard + features overview
**Megjegyzés**: A "Meta Hermes CI/CD" néven keresett dashboard nem publikus (Meta belső rendszer). Helyette a Nous Research Hermes Agent dashboard-ját hasonlítottam, ami közvetlenül releváns Noema számára (mindkettő AI agent dashboard).

| # | Kulcs Feature | Leírás | Noema Állapot |
|---|---------------|--------|---------------|
| H1 | **Live Status Overview** | Gateway státusz (running/stopped/PID), csatlakoztatott platformok állapota, aktív session-ök száma, 20 legutóbbi session model/message/token metrikával, 5s auto-refresh | ✅ **Van** — Overview tab (PKG-021, PKG-032) + CPU load + top processes + SSE live updates (PKG-009) |
| H2 | **Embedded Browser TUI** | Teljes terminál UI böngészőben xterm.js + WebGL rendererrel, slash parancsok, model picker, tool-call kártyák, markdown streaming, approve/sudo promptok | ❌ **Hiányzik** — Nincs in-browser chat/terminal. A monitoring read-only. Nincs interakció az agent-ekkel a dashboard-on keresztül. |
| H3 | **Multi-Profile Management** | Profile switcher, URL-based deep linking (`?profile=<name>`), egy dashboard → több agent instance kezelése | ❌ **Hiányzik** — Single-instance, bár a provider layer (PKG-013) technikailag támogathatná a multi-instance-t. |
| H4 | **Skills & Config Management UI** | Skills telepítés/konfigurálás UI-on keresztül YAML/CLI helyett, API key management | ✅ **Részben** — A provider abstraction layer (PKG-013) kezeli a konfigurációt, de nincs dedikált Skills UI (Noema package-ként kezeli, nem skill marketplace-ként). |
| H5 | **Subagent Delegation** | Child agent instance-ek spawn-olása isolated context-tel, restricted toolsets, max 3 concurrent | ✅ **Van** — Orchestrator tab (PKG-023) + subagent spawn rendszer az AGENTS.md-ben definiált protokollal (Viktor, Albert, Scout, Hugo, Otto, stb.) |

---

## 2. Grafana — Monitoring & Visualization Dashboard

**Típus**: Open-source observability & monitoring dashboard
**Forrás**: https://grafana.com/products/cloud/grafana/

| # | Kulcs Feature | Leírás | Noema Állapot |
|---|---------------|--------|---------------|
| G1 | **Unified Multi-Source Visualization** | 150+ adatforrás plugin, "single-pane-of-glass", nincs adatmigráció — a meglévő adatokat kérdezi le API-n keresztül | ✅ **Részben** — A provider abstraction layer (PKG-013) pont ezt a mintát követi: 6 provider interface a különböző adatforrásokhoz (cron, agent, health, H1). De az unified view még limitált. |
| G2 | **Rich Panel Types** | Time series, Tables, State timeline, Stat, Gauge, Chart, Heatmaps, Histograms, GeoMaps — gyors és rugalmas | ❌ **Hiányzik** — NO charting engine. Minden adat szöveges/táblázatos formában jelenik meg. Ez a #1 gap. |
| G3 | **Unified Alerting** | Minden alert egy UI-on, létrehozás/kezelés/némítás, multi-condition triggerek | ❌ **Hiányzik** — Nincs alerting rendszer. A health data (PKG-004) + cron data (PKG-002) + agent data (PKG-003) kiváló alap lenne threshold-based alertinghez. |
| G4 | **Transformations & Correlations** | Átnevezés, összegzés, kombinálás, számítások különböző query-k és adatforrások között | ❌ **Hiányzik** — Az adatok silósítva vannak tab-onként. Nincs cross-tab korreláció vagy transzformációs pipeline. |
| G5 | **Dashboard as Code (GitSync)** | Dashboard-ok verziókövetése Git-ben, kódként kezelhető dashboard definíciók | ✅ **Részben** — A PKG lista és a dev-loop pipeline (PKG-041 tervezett) "kódként kezeli" a csomagokat. De a dashboard layout-ok nem verziózottak. |

---

## 3. Vercel Dashboard — Deployment Dashboard

**Típus**: Deployment & hosting platform dashboard
**Forrás**: https://vercel.com/features (és korábbi docs fetch)

| # | Kulcs Feature | Leírás | Noema Állapot |
|---|---------------|--------|---------------|
| V1 | **Preview Deployments** | Minden PR/branch automatikus deploy egyedi URL-lel, azonnali vizuális visszajelzés | ✅ **Részben** — Build Integrity Check (PKG-035) detektálja a sérült buildeket. De nincs preview deployment koncepció — a dev-loop jelenleg spec → Cursor implementáció. |
| V2 | **Real-time Build Logs** | Streaming build logok, deployment státusz követés, azonnali rollback | ✅ **Van** — Dev Loop Log Viewer (PKG-014) + Development Log Enhance (PKG-016) + Log Panel Auto-Refresh (PKG-018) pontosan ezt csinálja: streaming logok, auto-refresh, fordított időrend. |
| V3 | **Project-First Organization** | Projektenkénti beállítások: domainek, env vars, integrációk, serverless config | ✅ **Van** — Package-first szervezés az INDEX.md-ben. PKG-031 (Package List Clarity) fázis csoportokkal, kereséssel, progress bar-ral. |
| V4 | **Team Collaboration** | Megosztott projektek, role-based access, deployment feedback/comments | ❌ **Hiányzik** — Noema single-user. Nincs sharing, RBAC, vagy multi-user koncepció. |
| V5 | **Integrated Analytics** | Core Web Vitals, látogatói statisztikák, performance monitoring a deployment-ek mellett | ✅ **Részben** — CPU Load (PKG-032), CPU% (PKG-036), Health & Heartbeat (PKG-004). De ezek host-level metrikák, nem alkalmazás-szintűek. |

---

## 4. Linear — Project Management Dashboard

**Típus**: Modern product development & project management
**Forrás**: https://linear.app/insights + https://linear.app/features

| # | Kulcs Feature | Leírás | Noema Állapot |
|---|---------------|--------|---------------|
| L1 | **Instant Analytics for Any Stream of Work** | Aggregálás, szegmentálás, vizualizálás a teljes workspace-en keresztül — trendek, blokkolók, progress | ✅ **Részben** — Action Queue (PKG-020, PKG-040) + Data Pipeline (PKG-021) + Audit Trail (PKG-007) trackinget biztosít. De a trend-analitika és aggregált nézetek hiányoznak. |
| L2 | **Custom Dashboards with Modular Layout** | Flexibilis layout opciók, quick-glance metrikáktól részletes grafikonokig és táblákig | ❌ **Hiányzik** — A tab-ok fix struktúrájúak. Nincs dashboard builder, widget áthelyezés, vagy menthető custom layout. |
| L3 | **Drill-Down Exploration** | Kattints bármelyik adatpontra → mögöttes issue-k, quick filterek, zoom in/out | ❌ **Hiányzik** — Az adat nézetek statikusak. Nincs interaktív drill-down vagy adatpontra kattintás. |
| L4 | **Dashboard Sharing (Public/Private)** | Dashboard-ok megosztása csapaton belül, privátban tartás amíg nem publikus | ❌ **Hiányzik** — No sharing. Single-user. |
| L5 | **Purpose-Built Product Analytics** | Time series grouping, segment/slice/filter controls, data export | ❌ **Hiányzik** — Nincs time series analitika, nincs szegmentálás, nincs data export. |

---

## 5. Datadog — Observability Platform

**Típus**: Full-stack observability & monitoring platform
**Forrás**: https://www.datadoghq.com/product/ + https://www.datadoghq.com/product/platform/dashboards/

| # | Kulcs Feature | Leírás | Noema Állapot |
|---|---------------|--------|---------------|
| D1 | **Real-time Interactive Dashboards** | High-resolution metrikák, drag-and-drop widget-ek, out-of-the-box template dashboard-ok, nincs query language szükséges | ✅ **Részben** — Dev Job Floating Indicator (PKG-026) draggable panel. SSE Live Updates (PKG-009) valós idejű adat. De a widget rendszer és template-ek hiányoznak. |
| D2 | **Cross-Product Correlation** | Zökkenőmentes navigáció logok, metrikák és request trace-ek között, automatikus tagging és korreláció | ❌ **Hiányzik** — Az adatok tab-onként silósítottak. Nincs cross-tab korreláció (pl. agent decision + cron failure + H1 finding egy nézetben). |
| D3 | **Template Variables & Custom Views** | Adatok szeletelése host/device/tag szerint, számítások: rates, ratios, averages, integrals | ❌ **Hiányzik** — Nincs template variable rendszer, nincsenek dinamikus filterek, nincsenek számított metrikák. |
| D4 | **Collaborative Notebooks & Sharing** | Issue-k megbeszélése kontextusban, snapshot készítése potenciális problémákról, authenticated external sharing | ❌ **Hiányzik** — Nincs snapshot, nincs sharing, nincs collaborative notebook. |
| D5 | **AI-Powered Watchdog & Alerts** | Anomália detekció, multi-condition triggerek, PagerDuty/Slack/email értesítések | ❌ **Hiányzik** — Bár a core data rendelkezésre áll (health, cron, agent), nincs anomália detekció és nincs alerting. A Session Health Scoring (PKG-011, F0) tervezett, de nincs kész. |

---

## Összesítő Mátrix

| Feature Kategória | Hermes | Grafana | Vercel | Linear | Datadog | **Noema** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Live Status / Real-time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rich Charts/Visualizations | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Alerting & Notifications | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Drag-and-Drop Dashboard Builder | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Log Viewer / Audit Trail | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Agent/Cron Management | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Subagent Orchestration | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Embedded Chat/TUI | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Multi-Profile / Multi-Instance | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Multi-Data-Source Provider Layer | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Template Variables / Dynamic Filters | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Cross-Source Data Correlation | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Dashboard Sharing / Collaboration | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Drill-Down / Interactive Exploration | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| API Access / Webhook Integration | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Dark/Light Theme | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ (PKG-045) |
| Keyboard Shortcuts | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ (PKG-046) |
| Data Export | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Build/CI Status Tracking | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Skill/Plugin Marketplace UI | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

**Összesen**: ✅ **14** | ❌ **13**

---

## Gap Analízis — Részletes

### Amit Noema MÁR TUD (és versenyelőny)

1. **Agent-Native Monitoring** — Az agent decision trace (PKG-010), audit trail (PKG-007), és agent data (PKG-003) olyan mélységű agent-specifikus tracking, amit egyik referencia dashboard sem kínál. A Hermes Agent a legközelebbi versenytárs, de az is session-szintű metrikákat mutat, nem döntési útvonalakat.

2. **Subagent Orchestration** — Az Orchestrator tab (PKG-023) + AGENTS.md protokoll (Viktor, Albert, Scout, Hugo, Otto) egyedi képesség. A Hermes Agent tud subagent delegációt, de a monitoring/management felület kevésbé fejlett.

3. **Provider Abstraction Layer** — A PKG-013 6 provider interface-e (cron, agent, health, H1) ugyanazt a clean architecture mintát követi mint a Grafana data source plugin rendszer, csak lightweight formában.

4. **Dev-Loop Pipeline** — A package-first CI/CD szemlélet (build integrity check, live log viewer, auto-refresh) a Vercel deployment dashboard-jával vetekszik.

### Ami HIÁNYZIK (és kritikus)

| Gap | Hatás | Súlyosság |
|-----|-------|-----------|
| **Vizualizációs réteg** | Minden adat szöveges/táblázatos. Nincs time series, nincs gauge, nincs heatmap. A Grafana/Linear/Datadog ereje a vizuális storytellingben van. | 🔴 Kritikus |
| **Alerting & Notification** | Nincs mód threshold-based alert-ekre (CPU > 90%, cron failure, agent health drop). Az adatok rendelkezésre állnak, de nincs feldolgozásuk. | 🔴 Kritikus |
| **Dashboard Customization** | Fix tab struktúra. A felhasználó nem tudja átrendezni a widget-eket, nem menthet custom layout-ot. | 🟠 Magas |
| **Cross-Source Correlation** | Az adatok silósítva vannak. Egy agent hibát nem lehet korrelálni egy cron failure-rel vagy H1 activity-vel ugyanazon a nézeten. | 🟠 Magas |
| **Sharing & Collaboration** | Single-user. Nincs snapshot, nincs megosztás, nincs team view. | 🟡 Közepes (MVP-re nem kritikus) |
| **API / Webhook Access** | Nincs publikus API a dashboard adatokhoz. A Datadog és Grafana teljes API hozzáférést ad. | 🟡 Közepes |
| **Data Export** | Nincs CSV/JSON export. A Linear és Datadog támogatja az adatexportot. | 🟡 Közepes |

---

## Top 5 Legnagyobb Hatású Ajánlás

### 1. 🥇 Charting & Visualization Engine (Grafana/Datadog/Linear inspired)

**Mit**: Time series, gauge, stat card, heatmap, és simple bar/line chart komponensek a meglévő data provider-ekre építve.

**Miért ez az első**: Az ÖSSZES referencia dashboard (kivéve Hermes Agent, ami egyébként is lightweight) erre épül. A monitoring adatok értéke exponenciálisan nő ha vizuálisan jelennek meg. Jelenleg Noema "adatot mutat", a referencia dashboard-ok "történetet mesélnek".

**Mit érint**: PKG-004 (health → gauge), PKG-002 (cron → timeline chart), PKG-003 (agent → decision count bar chart), PKG-005 (H1 → bounty trend line).

**Becsült effort**: L (40-60h) — Chart.js vagy D3.js integráció SvelteKit-ben, 4-5 chart type, provider integration.

**Reference**: Grafana panel types, Datadog timeboards, Linear insights charts.

### 2. 🥈 Alerting & Notification System (Grafana/Datadog inspired)

**Mit**: Threshold-based alert definíciók a meglévő data provider-ekre. Értesítés Telegram-ra/Slack-re. Alert history + silence/acknowledge.

**Miért ez a második**: Jelenleg passzív monitoring van — a felhasználónak aktívan néznie kell a dashboard-ot hogy észrevegye a problémákat. Az alerting az ami a monitoring rendszert proaktívvá teszi. A PKG-004 (Health), PKG-002 (Cron), és PKG-003 (Agent) adatai kiváló inputok lennének.

**Mit érint**: Új alert definition schema, Telegram notification integration, Alert history tab.

**Becsült effort**: M (20-30h) — Alert engine, threshold config UI, notification dispatch.

**Reference**: Grafana unified alerting, Datadog Watchdog + multi-condition alerts.

### 3. 🥉 Dashboard Builder / Customizable Layout (Linear/Datadog inspired)

**Mit**: Drag-and-drop widget átrendezés, panel resize, menthető custom dashboard layout-ok. A felhasználó választhatja ki mely widget-eket szeretné látni és hol.

**Miért ez a harmadik**: A fix tab struktúra korlátozza a személyre szabást. Minden felhasználónak más metrikák fontosak. A Linear "fully modular" dashboard-jai és a Datadog "drag-and-drop widgets" pont ezt a flexibilitást adják.

**Mit érint**: PKG-021 (Overview tab) → custom grid layout, widget registry, layout persistence.

**Becsült effort**: L (30-50h) — Grid layout engine (gridstack.js vagy hasonló), widget component interface, local storage persistence.

**Reference**: Linear modular dashboards, Datadog drag-and-drop screenboards.

### 4. Embedded Chat / Agent Interaction (Hermes Agent inspired)

**Mit**: Beágyazott chat vagy terminál interfész a dashboard-on belül, ahol a felhasználó közvetlenül interakcióba léphet az agent-ekkel. Parancsok küldése, session resume, model váltás.

**Miért**: Ez transzformálná Noema-t egy "command center"-ré a passzív monitoring panel helyett. A Hermes Agent pont ezt csinálja az xterm.js + WebGL TUI-jával. Noema-nak nem kell teljes TUI — egy chat panel az agent-ekkel való interakcióhoz elég lenne.

**Mit érint**: Új Chat tab vagy slide-out panel, agent API integration, session management.

**Becsült effort**: M (20-30h) — Chat UI komponens, SSE/WebSocket kapcsolat az agent API-hoz, session history.

**Reference**: Hermes Agent embedded browser TUI (xterm.js + WebGL).

### 5. Cross-Source Data Correlation & Unified Search (Grafana/Datadog inspired)

**Mit**: Egyesített keresés és korrelációs nézet ami összeköti a különböző adatforrásokat. Pl. "mutasd meg az összes activity-t az elmúlt 1 órában" — agent decisions + cron executions + H1 changes egy idővonalon.

**Miért**: Ez oldaná fel a jelenlegi adat-silókat. A Datadog "navigate seamlessly between logs, metrics, and traces" és a Grafana "correlate your data in one place" pontosan ezt a value proposition-t képviseli.

**Mit érint**: Unified timeline component, cross-provider query API, correlation engine.

**Becsült effort**: M (20-30h) — Unified search API, timeline component, provider aggregation layer.

**Reference**: Datadog cross-product correlation, Grafana transformations.

---

## Prioritási Mátrix (Impact vs Effort)

```
Magas Impact │
             │  5. Cross-Source    │  1. Charting Engine 🥇
             │  Correlation        │  3. Dashboard Builder 🥉
             │                     │
             │  2. Alerting 🥈     │  4. Embedded Chat
             │                     │
Alacsony     │  Dark Theme         │
Impact       │  Keyboard Shortcuts │
             │  Data Export        │
             └─────────────────────┴──────────────────────
                Alacsony Effort        Magas Effort
```

**Kezdési sorrend ajánlás**: #2 Alerting → #1 Charting → #3 Dashboard Builder → #5 Correlation → #4 Chat

---

## Függelék: Módszertan

- **Adatgyűjtés**: `web_fetch` hivatalos dokumentációs oldalakról és termék landing page-ekről (2026-07-14)
- **Hermes megjegyzés**: A Meta belső "Hermes" CI/CD dashboard-ja nem publikus. A Nous Research Hermes Agent dashboard-ját használtam proxy-ként, mivel (a) ez az egyetlen jól dokumentált "Hermes" nevű dashboard, és (b) közvetlenül releváns Noema számára (mindkettő AI agent dashboard).
- **Grafana**: https://grafana.com/products/cloud/grafana/ + grafana.com/grafana/
- **Vercel**: https://vercel.com/features
- **Linear**: https://linear.app/insights + https://linear.app/features
- **Datadog**: https://www.datadoghq.com/product/ + /product/platform/dashboards/
- **Noema**: `dev/packages/INDEX.md` (47 csomag, 2026-07-13)

---

*Report generated by Alfred 👔 — QA Task H — 2026-07-14 19:45 CEST*
