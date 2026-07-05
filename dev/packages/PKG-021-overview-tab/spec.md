# PKG-021: Data Pipeline + Overview Tab

**Size:** L | **Effort:** 2-3h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-001 ✅, PKG-002/003/004/005 ✅ | **Spec date:** 2026-07-05

## 🎯 Mit

A SvelteKit dashboard első érdemi tab-ja: Overview. Plusz a teljes data pipeline beüzemelése — `+page.server.ts` betölt MINDEN adatot a core modulokból, `+page.svelte` rendereli a megfelelő tab komponenst.

### F1: Data Pipeline — page.server.ts

A `+page.server.ts` betölti az ÖSSZES adatot a meglévő core modulokból:

```
src/lib/core/crons.ts → getCrons()
src/lib/core/agents.ts → getAgents()
src/lib/core/health.ts → getHealth()
src/lib/core/h1.ts → getH1Data()
src/lib/core/noema.ts → getNoemaData()
src/lib/core/research.ts → getResearch()
src/lib/core/bills.ts → getBills()
src/lib/core/calendar.ts → getCalendar()
src/lib/core/dev-loop-log.ts → getDevPackages()
```

Minden hívás a provider rétegen keresztül (`src/lib/providers/`).

### F2: Overview Tab komponens

`src/lib/components/tabs/Overview.svelte` — a dashboard főoldala:

**Metrics bar** (4 kártya):
- Crons: healthy/total (zöld/sárga/piros)
- Agents: active/total (zöld/sárga)
- H1: signal score + reputation
- System: uptime, disk %, RAM

**Agent státusz grid** (kompakt):
- 4 oszlopos grid, minden agent egy mini kártya
- Emoji, név, státusz pötty (zöld/sárga/piros), last run
- Stale warning ha >3d

**H1 summary** (2 kártya egymás mellett):
- Open reports, bounty earned
- Signal, reputation, trial count

**System health sáv:**
- Hostname, uptime, disk (használt/összes), RAM

### F3: +page.svelte tab routing

A `+page.svelte` kap egy `{#if}` / `{:else if}` láncot ami a `tabContext.current` alapján rendereli a megfelelő komponenst:

```
overview → <Overview ...>
agents → placeholder (PKG-022)
crons → placeholder (PKG-022)
orchestrator → placeholder (PKG-023)
h1 → placeholder (PKG-024)
brainstorm → placeholder (PKG-025)
bills → placeholder (PKG-025)
research → placeholder (PKG-025)
noema → <Noema ...> (már kész)
```

### F4: Types frissítés

`src/lib/types/index.ts` bővítése az új PageData típusokkal.

## 📐 Scope

### Mit érint
- `src/routes/+page.server.ts` — data loading
- `src/routes/+page.svelte` — tab routing
- `src/lib/components/tabs/Overview.svelte` — ÚJ: overview komponens
- `src/lib/types/index.ts` — típusok bővítése
- `tests/core/` — ha új core funkció kell

### Mit NEM érint
- `archive/v4.html` — semmi (legacy)
- `generate.cjs` — semmi
- `relay.cjs` — semmi
- `src/lib/core/` — SEM változtatás (csak HASZNÁLAT)

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | page.server.ts: minden core modul betöltése | `+page.server.ts` |
| **Phase 2** | Types: PageData bővítés | `types/index.ts` |
| **Phase 3** | Overview.svelte: metrics bar, agent grid, H1 cards, system health | `tabs/Overview.svelte` |
| **Phase 4** | +page.svelte: tab routing (if/else lánc) | `+page.svelte` |
| **Phase 5** | Teszt: data loading működik, Overview renderel, tab váltás működik | Manuális böngésző |
| **Phase 6** | `pnpm check` ✅, `pnpm test` ✅ |

## 🎨 Design

Az Overview tab vizuálisan hasonlít a legacy dashboard overview tab-jára:
- Metrics bar felül (4 oszlop)
- Agent grid középen (2-4 sor)
- H1 summary alul (2 kártya)
- System health sáv az oldal tetején/alján

## ✅ Acceptance Criteria

1. `pnpm dev` → dashboard betölt, Overview tab látható
2. Metrics bar mutatja: crons healthy/total, agents active, H1 signal, system info
3. Agent grid mutatja mind a 9 agent-et státusszal
4. H1 summary mutatja a HackerOne statokat
5. Tab váltás működik (Overview, Noema — a többi placeholder)
6. `pnpm check` ✅, `pnpm test` ✅ (meglévő 92 teszt nem törik)
