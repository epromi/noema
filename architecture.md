# Noema 🧠 — Technikai Architektúra

> Részletes belső működési leírás. Fejlesztőknek és AI agent-eknek.

---

## Áttekintő Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADATFORRÁSOK (22+)                            │
│                                                                      │
│  cron list  agent status  autorch.state  H1 API  GCal  memory/*.md │
│  action-queue  bills  open-loops  KG   model-mapping  heartbeat    │
│  sessions  research/  brainstorming  nightly  agents/status/*.md   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        generate.js (Node.js)                          │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────┐ │
│  │ DATA FETCH   │  │ DATA PROCESS │  │ TEMPLATE RENDER             │ │
│  │              │  │              │  │                             │ │
│  │ exec(cron)   │  │ parse JSON   │  │ read archive/v4.html       │ │
│  │ read files   │  │ classify     │  │ replace {{VARIABLES}}      │ │
│  │ exec(API)    │  │ sort/group   │  │ inject D.* as <script>     │ │
│  │              │  │ compute      │  │ write dashboard.html       │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     dashboard.html (~73KB)                            │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Tab-ok: Overview | Agents | Crons | Orchestrator | Brainstorm  │ │
│  │         Bills | Research | KPIs | 🧠 Noema                      │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ Render: D.* JSON objektumok → DOM manipuláció (vanilla JS)     │ │
│  │ Style: CSS custom properties, dark theme, responsive            │ │
│  │ Actions: <button onclick="fetch('/action?...')"> → relay.js    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────┬──────────────────────────────────┬────────────────────────────┘
       │                                  │
       │ HTTP :8080 (python3 -m)          │ Gomb action-ök
       │                                  │
       ▼                                  ▼
┌──────────────┐              ┌─────────────────────────────────┐
│ Böngésző     │              │ relay.js (HTTP :18998)          │
│ (megtekintés)│              │                                 │
└──────────────┘              │ POST /action → JSONL fájlba írás│
                              │ GET /health → 200 OK            │
                              └────────────┬────────────────────┘
                                           │ 10 percenként poll
                                           ▼
                              ┌─────────────────────────────────┐
                              │ action-processor.js             │
                              │                                 │
                              │ JSONL olvas → Gateway API       │
                              │ → sessions_send → Alfred session│
                              └─────────────────────────────────┘
```

---

## Data Pipeline (generate.js)

### Bemeneti Adatforrások

| Kategória | Forrás | Metódus | D.* kulcs |
|-----------|--------|---------|-----------|
| Cron státusz | `openclaw cron list --json` | `exec()` | `D.crons` |
| Agent státusz | `agents/<agent>/status.md` | `fs.readFileSync()` | `D.agents` |
| Autoresearch | `projects/autoresearch/autoresearch-state.json` | `fs.readFileSync()` | `D.autoresearch` |
| H1 adatok | `h1.sh programs`, `h1.sh earnings` | `exec()` | `D.h1` |
| Calendar | `gog calendar list` | `exec()` | `D.calendar` |
| Action queue | `memory/state/action-queue.md` | `fs.readFileSync()` | `D.actionQueue` |
| Open loops | `memory/logistics/tasks.md` | `fs.readFileSync()` | `D.openLoops` |
| Bills | `memory/logistics/tasks.md` | `fs.readFileSync()` | `D.bills` |
| KG stats | `memory/knowledge_graph/nodes.json` | `fs.readFileSync()` | `D.kg` |
| Model mapping | `memory/agents-model-mapping.md` | `fs.readFileSync()` | `D.modelMapping` |
| Heartbeat | `memory/state/heartbeat-state.json` | `fs.readFileSync()` | `D.heartbeat` |
| Sessions | `sessions_list` API | `exec()` | `D.sessions` |
| Research | `memory/research/INDEX.md` | `fs.readFileSync()` | `D.research` |
| Brainstorming | `memory/brainstorming/` | `fs.readdirSync()` | `D.brainstorm` |
| Nightly reviews | `memory/nightly/` | `fs.readdirSync()` | `D.nightly` |
| **Noema** | Noema project files | `fs.statSync()`, `fs.readFileSync()` | `D.noema` |
| Research cron | `memory/research/noema/` | `fs.readdirSync()` | `D.dashboardResearch` |

### Classifikációs Logika

Minden cron agent a neve + ütemezése alapján kerül besorolásra:

| Csoport | Szűrés | Példa |
|---------|--------|-------|
| NIGHT | 00:00-06:00 között futó | Otto Core, Noema QA |
| MORNING | 06:00-09:00 között futó | Porter Triage, Edwin Morning |
| DAYTIME | 09:00-17:00 között futó | Daytime Fact Sync-k |
| SPANNING | teljes napot lefedő | Heartbeat, Noema Refresh |
| EVENING | 17:00-24:00 között futó | Evening Standup |

### Memóriahasználat

- **Szinkron fájlolvasás**: `fs.readFileSync()` — minden adatforrás blokkoló
- **Exec hívások**: `execSync()` — cron list, H1 API, calendar
- **Teljes futási idő**: ~2-5 másodperc (22+ adatforrás)
- **Memória csúcs**: ~50-100MB (minden adat egyszerre a memóriában)

---

## Tab Rendszer

### Tab Struktúra

```javascript
function switchTab(tabName) {
  // 1. Összes tab-content elrejtése
  // 2. Összes tab-nav inactive
  // 3. Kiválasztott tab-content + tab-nav active
  // 4. URL hash frissítése: #tab-XXX
}
```

### Tab-ok és Adat Kulcsok

| Tab | ID | Adat kulcs | Renderer |
|-----|-----|-----------|----------|
| Overview | `tab-overview` | `D.crons`, `D.agents`, `D.h1` | Összesítő kártyák |
| Agents | `tab-agents` | `D.agents` | Agent kártyák |
| Crons | `tab-crons` | `D.crons` | Csoportosított cron tábla |
| Orchestrator | `tab-orchestrator` | `D.autoresearch`, `D.actionQueue`, `D.dashboardResearch` | Kutatás + action queue |
| Brainstorm | `tab-brainstorm` | `D.brainstorm` | Ötlet lista |
| Bills | `tab-bills` | `D.bills`, `D.openLoops` | Számlák + open loop-ok |
| Research | `tab-research` | `D.research`, `D.kg` | Kutatási statisztika |
| KPIs | `tab-kpis` | `D.heartbeat`, `D.modelMapping`, `D.sessions` | Rendszer metrikák |
| 🧠 Noema | `tab-noema` | `D.noema` | Termék oldal |

---

## Action Rendszer (Gombok → Alfred)

### Adatfolyam

```
Böngésző gomb click
  → fetch('/action', {method:'POST', body: JSON.stringify({action, id, desc})})
  → relay.js (Express, :18998)
  → noema-actions.jsonl (fájlba írás)
  → action-processor.js (10 percenként timer)
  → Gateway API (sessions_send)
  → Alfred session (Telegram)
  → Alfred feldolgozza
  → Válasz Telegramra
```

### Támogatott Action-ök

| Action | Cél | Feldolgozás |
|--------|-----|-------------|
| `noema done <id>` | Action queue item lezárása | `action-queue.md` frissítés |
| `noema escalate <id>` | Open loop eszkalálás | Albert spawn |
| `noema restart <id>` | Agent/cron újraindítás | Státusz ellenőrzés, restart |
| `noema trigger <id>` | Cron azonnali futtatás | `openclaw cron run` |
| `noema investigate <id>` | Critical alert vizsgálat | API/böngésző ellenőrzés |
| `noema activate <id>` | Brainstorm aktiválás | Agent spawn |
| `noema paid <id>` | Bill kifizetve | `tasks.md` frissítés |
| `noema implement <id>` | Proposal implementálás | Research fájl olvasás, kód módosítás |

---

## Cron Architektúra

### Noema-Specifikus Cron-ok

| Cron | Név | Ütemezés | Timeout | Modell | Prompt |
|------|-----|----------|---------|--------|--------|
| `cbc7d5d6` | Noema Refresh | 2 óránként | default | N/A | `node generate.js` |
| `3b4ea5d3` | Noema Product Research | 01:00 CEST | 900s | ⚡ Flash | `research-prompt.md` |
| `eed1df55` | Noema Nightly QA | 03:00 CEST | 900s | 🔷 Pro | `qa-prompt.md` |

### Systemd Service-ek

| Service | Típus | Port | Leírás |
|---------|-------|------|--------|
| `alfred-dashboard.service` | simple | 8080 | Dashboard HTTP kiszolgálás |
| `dashboard-relay.service` | simple | 18998 | Böngésző action-ök fogadása |
| `dashboard-action-processor.timer` | timer | — | 10 percenkénti JSONL feldolgozás |

---

## Fájl Struktúra (Teljes)

```
projects/noema/
├── README.md              ← Projekt áttekintés
├── CHANGELOG.md            ← Változáskövetés
├── CONTRIBUTING.md         ← Fejlesztési kézikönyv
├── architecture.md         ← Ez a fájl
├── roadmap.md              ← Fejlesztési útiterv
├── generate.js             ← Fő generátor (~800 sor, Node.js)
├── dashboard.html          ← Generált kimenet (~73KB)
├── relay.js                ← Action fogadó (Express, :18998)
├── action-processor.js     ← JSONL → Gateway API (10p timer)
├── qa-prompt.md            ← QA cron prompt
├── research-prompt.md      ← Research cron prompt
├── archive/                ← Régi verziók
│   ├── v4.html             ← HTML template (~920 sor)
│   ├── generate.sh         ← Eredeti bash generátor
│   ├── generate-v4.sh      ← v4 shell wrapper
│   ├── index.html          ← Redirect
│   └── README-v1.md        ← Eredeti README
└── research/               ← Kutatási anyagok
    ├── competitive-landscape.md  ← Versenytárs elemzés
    └── cursor-integration.md     ← Cursor agent workflow
```

---

## Külső Függőségek

| Függőség | Használat | Verzió |
|-----------|-----------|--------|
| Node.js | generate.js, relay.js, action-processor.js | v24 |
| OpenClaw CLI | `openclaw cron list`, `openclaw sessions` | legfrissebb |
| H1 API | `scripts/h1.sh` | N/A |
| Google Calendar | `gog calendar` plugin | N/A |
| Cursor | AI-assisted fejlesztés | 3.5.38 |
| python3 | HTTP server (:8080) | 3.12 |
| systemd (user) | Service management | — |
