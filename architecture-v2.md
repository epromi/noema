# Noema v2 — SvelteKit Migration Architecture

> **Elv**: Core logika plain JS, SvelteKit csak a UI réteg. Framework váltás = csak `lib/components/` újraírása.

---

## Architektúra Áttekintés

```
┌─────────────────────────────────────────────────────────────┐
│                   lib/core/ (FRAMEWORK-AGNOSTIC)             │
│                                                              │
│  collector.js  ← Periódikus adatgyűjtés (cron → timer)      │
│  crons.js      ← openclaw cron list → parsed data           │
│  agents.js     ← Agent státuszok, sessions                  │
│  h1.js         ← HackerOne API (programs, earnings)         │
│  calendar.js   ← Google Calendar (gog)                      │
│  bills.js      ← Számlák, open loop-ok (tasks.md)           │
│  research.js   ← Research státusz, KG                       │
│  action-queue.js← Action queue feldolgozás                  │
│  health.js     ← Heartbeat, model mapping                   │
│  noema.js      ← Noema saját metrikák                       │
│  index.js      ← Egyesített API: getAllData()               │
│                                                              │
│  ⚠️ ZERO Svelte import. Tiszta Node.js.                     │
│  ⚠️ Minden függvény async. Minden visszatérés plain object. │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ import
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              SvelteKit Réteg (THIN WRAPPER)                  │
│                                                              │
│  routes/api/data/+server.js    ← GET → getAllData() → JSON  │
│  routes/api/actions/+server.js ← POST → action feldolgozás  │
│  routes/api/events/+server.js  ← SSE stream (live updates)  │
│                                                              │
│  +page.svelte            ← Fő dashboard (tab váltó + grid)  │
│  +layout.svelte          ← Közös layout (dark theme, nav)   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              lib/components/ (UI KOMPONENSEK)                │
│                                                              │
│  Overview.svelte    Agents.svelte      Crons.svelte         │
│  Orchestrator.svelte  Brainstorm.svelte  Bills.svelte       │
│  Research.svelte    KPIs.svelte        Noema.svelte         │
│  [Logs.svelte]      [AuditTrail.svelte] [...]                │
│                                                              │
│  ⚠️ UI LAYER ONLY. Adat = props a szülőtől.                 │
│  ⚠️ Nincs bennük fetch/exec — csak megjelenítés.            │
└─────────────────────────────────────────────────────────────┘
```

---

## Fájlstruktúra

```
noema-v2/
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json              ← TypeScript (szigorú, null check)
├── .gitignore
├── .env.example
├── AGENTS.md
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
│
├── src/
│   ├── app.html               ← HTML shell
│   ├── app.css                ← Globális stílusok (dark theme)
│   ├── hooks.server.js        ← Szerver oldali hook-ok
│   │
│   ├── routes/
│   │   ├── +layout.svelte     ← Közös layout
│   │   ├── +page.svelte       ← Dashboard főoldal
│   │   ├── +page.js           ← Data loading (SSR/CSR)
│   │   │
│   │   └── api/
│   │       ├── data/+server.js    ← GET /api/data
│   │       ├── actions/+server.js ← POST /api/actions
│   │       └── events/+server.js  ← GET /api/events (SSE)
│   │
│   └── lib/
│       ├── core/              ← ⭐ FRAMEWORK-AGNOSTIC
│       │   ├── index.js       # getAllData() — egyesített
│       │   ├── collector.js   # Periódikus gyűjtés + cache
│       │   ├── crons.js       # openclaw cron list
│       │   ├── agents.js      # Agent státusz + sessions
│       │   ├── h1.js          # HackerOne API
│       │   ├── calendar.js    # Google Calendar
│       │   ├── bills.js       # Számlák, open loop-ok
│       │   ├── research.js    # Research + KG
│       │   ├── action-queue.js# Action queue
│       │   ├── health.js      # Heartbeat, model mapping
│       │   ├── noema.js       # Noema metrikák
│       │   └── utils.js       # Közös segédfüggvények
│       │
│       ├── server/            ← SvelteKit-specifikus wrapper-ek
│       │   ├── cache.js       # In-memory cache + TTL
│       │   └── sse.js         # SSE event manager
│       │
│       ├── components/        ← UI komponensek (Svelte)
│       │   ├── TabNav.svelte          # Tab navigáció
│       │   ├── MetricCard.svelte      # Metrika kártya
│       │   ├── StatusBadge.svelte     # Státusz badge
│       │   ├── CronTimeline.svelte    # 24h cron idővonal
│       │   ├── tabs/
│       │   │   ├── Overview.svelte
│       │   │   ├── Agents.svelte
│       │   │   ├── Crons.svelte
│       │   │   ├── Orchestrator.svelte
│       │   │   ├── Brainstorm.svelte
│       │   │   ├── Bills.svelte
│       │   │   ├── Research.svelte
│       │   │   ├── KPIs.svelte
│       │   │   └── Noema.svelte
│       │   └── [future]/
│       │       ├── Logs.svelte
│       │       ├── AuditTrail.svelte
│       │       └── KnowledgeGraph.svelte
│       │
│       └── types/             ← TypeScript típusdefiníciók
│           └── index.ts       # Data, Agent, Cron, stb. típusok
│
├── static/                    ← Statikus asset-ek
│   └── favicon.png
│
└── tests/
    ├── core/                  ← Core modulok tesztjei (vitest)
    │   ├── crons.test.js
    │   ├── agents.test.js
    │   └── ...
    └── components/            ← Komponens tesztjei (playwright)
        └── dashboard.spec.ts
```

---

## Core Modul API Spec (framework-agnostic)

Minden core modul ezt a mintát követi:

```js
// lib/core/crons.js
/**
 * @returns {Promise<{crons: Cron[], healthy: number, total: number, updatedAt: number}>}
 */
export async function getCrons() {
  const raw = await exec('openclaw cron list --json');
  const crons = JSON.parse(raw);
  // ... parse, classify (NIGHT/MORNING/DAYTIME/EVENING)
  return {
    crons: classifiedCrons,
    healthy: crons.filter(c => c.lastResult === 'ok').length,
    total: crons.length,
    updatedAt: Date.now()
  };
}
```

**Szabályok:**
1. Minden export async függvény
2. Visszatérési érték mindig plain JS object (JSON-serializable)
3. NULL és undefined helyett default értékek (üres tömb, 0, "unknown")
4. Hiba esetén `{ error: "message", data: fallback }` struktúra
5. **SEMMI Svelte import** — tiszta Node.js

---

## Data Flow

```
┌──────────────┐    60 másodpercenként     ┌──────────────────┐
│ collector.js │ ──────────────────────────→│  in-memory cache  │
│ (setInterval)│                            │  (Map, TTL alapú) │
└──────────────┘                            └────────┬─────────┘
                                                     │
                              ┌──────────────────────┼──────────────────────┐
                              │                      │                      │
                              ▼                      ▼                      ▼
                     ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
                     │ GET /api/data │      │ SSR +page.js │      │ SSE /events  │
                     │ (REST API)    │      │ (initial load)│      │ (live push)  │
                     └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
                            │                     │                      │
                            ▼                     ▼                      ▼
                     ┌──────────────────────────────────────────────────────┐
                     │              Svelte Frontend (reaktív)                │
                     │                                                       │
                     │  data = $page.data (SSR)  vagy  fetch('/api/data')   │
                     │  sse.onmessage → data frissítés                      │
                     │  action gomb → POST /api/actions                     │
                     └──────────────────────────────────────────────────────┘
```

---

## Idővonal

| Fázis | Idő | Mit |
|-------|-----|-----|
| **F0** | Most | Architektúra terv (ez a fájl) → GitHub |
| **F1** | 1-2 nap | `lib/core/` modulok: crons, agents, health (4-5 modul) |
| **F2** | 1 nap | SvelteKit scaffold + 3 alap tab (Overview, Crons, Agents) |
| **F3** | 1-2 nap | Maradék core modulok + tab-ok |
| **F4** | 1 nap | SSE live update + collector.js |
| **F5** | 1 nap | Action system (gombok → API → Alfred) |
| **F6** | 1 nap | Tesztek, deploy, régi Noema leállítás |
| **Összes** | ~1 hét | Teljes v2 migráció |

---

## Migrációs Stratégia

1. **Párhuzamos futás**: Noema v1 (current) és v2 (SvelteKit) egymás mellett
   - v1: HTTP :8080 (régi)
   - v2: HTTP :5173 (dev) → :8080 (production)

2. **Core modulok fokozatos**: Egyesével implementáljuk, teszteljük
   - Minden core modul önállóan tesztelhető: `node -e "import('./lib/core/crons.js').then(m => m.getCrons().then(console.log))"`

3. **Tab-ok fokozatos**: Ahogy készülnek a core modulok, úgy a tab-ok is
   - Régi tab → új Svelte komponens, egyesével

4. **Vágás**: Amikor minden tab kész + stabil → v1 leáll, v2 veszi át a :8080-at

---

## Best Practice-ek (Sparkl mintájára)

| Gyakorlat | Cél |
|-----------|-----|
| TypeScript `strict: true` | Null safety, típushibák elkerülése |
| `vitest` unit tesztek | Minden core modulhoz |
| `playwright` e2e | Dashboard render + gomb működés |
| GitHub Actions CI | `npm run check && npm run test` |
| `.env.example` | Konfig sablon (nincs secret a repoban) |
| `AGENTS.md` | Cursor AI instrukciók |
| `.cursor/rules/` | Projekt-specifikus Cursor szabályok |
