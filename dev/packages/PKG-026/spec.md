# PKG-026: Draggable Dev Job Floating Indicator

## Meta
| Kulcs | Érték |
|-------|-------|
| ID | PKG-026 |
| Név | Dev Job Floating Indicator |
| Méret | S |
| Státusz | 📋 F0 |
| Függőségek | PKG-021 (Data Pipeline — `/next-trigger` data source) |
| Becsült idő | 15-30 perc |
| Fázisok | 3 |

## Mit érint
- **Új komponens**: `src/lib/components/DevJobIndicator.svelte` — lebegő, húzható kis panel
- **Új data source**: `src/lib/core/noema.ts` — `getDevJobStatus()` → fetch relay `/next-trigger` + `/running`
- **Layout regisztráció**: `+layout.svelte` — globálisan elérhető, minden tab-on látható
- **TypeScript típusok**: `src/lib/types/index.ts` — `DevJobStatus` interface

## Mit NEM érint
- ❌ PKG-017 Cron Timeline vizuális (AZ a cron pipeline timeline, EZ a dev-loop státusz indikátor — különálló funkciók)
- ❌ SvelteKit routing (a `+layout.svelte`-ben csak komponens regisztráció)
- ❌ Relay endpoint-ok (már léteznek: `/next-trigger`, `/running`)
- ❌ generate.cjs / legacy dashboard

## Scope
A SvelteKit dashboard MINDEN oldalán látható, húzható (drag) lebegő indikátor ami valós időben mutatja:
- **Következő dev job visszaszámláló** (MM:SS formátum, 1 mp-enként frissül)
- **Action queue méret** (hány implementáció vár sorban)
- **Aktuálisan futó dev job** (PKG ID ha fut, különben rejtett)

### Vizuális specifikáció
- **Pozíció**: fix (position:fixed), alapértelmezés: jobb felső sarok (top: 80px, right: 16px)
- **Méret**: kompakt (~220px széles), min-width: 200px
- **Struktúra**:
  ```
  ┌──────────────────────┐
  │ ⚙️ Dev Job     ⠿    │  ← fogantyú (itt lehet húzni)
  ├──────────────────────┤
  │ Következő:   02:34   │  ← visszaszámláló
  │ Sorban áll:     2    │  ← action queue count
  │ Fut:      PKG-022    │  ← csak ha aktív (zöld)
  └──────────────────────┘
  ```
- **Stílus**: sötét háttér (var(--card)), vékony keret (var(--border)), enyhe árnyék, user-select:none
- **Állapotok**:
  - 🟦 **idle**: normál keret (nincs futó job)
  - 🟨 **soon**: sárga keret (következő futás < 1 perc)
  - 🟩 **active**: zöld keret + pulzáló animáció (futó job esetén)
- **Húzás (drag)**:
  - Csak a fogantyúval húzható (⠿ gripper ikon)
  - cursor:grab / cursor:grabbing
  - viewport határokon belül marad
  - Érintőképernyős támogatás (touchstart/touchmove/touchend)
- **Pozíció mentés**: localStorage (`dli-pos` kulcs: [left, top] JSON array)
- **Betöltés**: localStorage-ból visszaállítás page reload után

## Adatforrás
- **GET /next-trigger** → `{ next, nextMs, lastTrigger, queue, now }` — relay endpoint (már létezik)
- **GET /running** → `{ running }` — jelenleg futó PKG ID (már létezik)
- **Core funkció**: `src/lib/core/noema.ts` → `getDevJobStatus()` hívja a fenti endpoint-okat
- **Poll intervallum**: 10 mp (teljes refresh), visszaszámláló 1 mp

## Fázisok

### F1: DevJobStatus Type + Core Data Fetcher
- `src/lib/types/index.ts`: `DevJobStatus` interface hozzáadása
  ```typescript
  interface DevJobStatus {
    nextMs: number;
    queue: number;
    running: string | null;
  }
  ```
- `src/lib/core/noema.ts`: `getDevJobStatus(): Promise<DevJobStatus>` függvény
- Fetch a relay `/next-trigger` és `/running` endpoint-okról
- Hibakezelés: ha a relay offline → `{ nextMs: 0, queue: 0, running: null }` + "offline" jelzés

### F2: DevJobIndicator.svelte Komponens
- `src/lib/components/DevJobIndicator.svelte` — teljes UI komponens
- Svelte 5 runes: `$state`, `$effect`, `onMount`
- Drag implementáció: mousedown/touchstart → mousemove/touchmove → mouseup/touchend
- localStorage pozíció mentés/betöltés
- Visszaszámláló frissítés: `setInterval(1000)` + 10 mp teljes refresh
- Állapot osztályok: idle / soon / active → Svelte class binding

### F3: Layout Regisztráció + Tesztek
- `src/routes/+layout.svelte`: `DevJobIndicator` komponens hozzáadása (a `<slot />` FÖLÉ, globális)
- Layout ne renderelje az indikátort a Noema Dev tab-on (vagy renderelje? — András dönt: MINDEN tab-on látszódjon)
- Unit teszt: `tests/dev-job-indicator.test.ts`
  - `getDevJobStatus()` mock-olva, visszaadja a teszt adatokat
  - Teszt: komponens rendereli a countdown-t, queue count-ot
  - Teszt: running PKG ID megjelenik ha van
  - Teszt: offline állapot kezelése
- `pnpm check` + `pnpm test` green

## Acceptance Criteria
- [ ] Indikátor látható MINDEN tab-on (Overview, Agents, Crons, Orchestrator, H1, Viktor, Brainstorm, Bills, Research, Noema Dev)
- [ ] Visszaszámláló 1 mp-enként frissül (MM:SS formátum)
- [ ] Queue count helyes számot mutat
- [ ] Futó job esetén zöld pulzáló keret + PKG ID
- [ ] Fogantyúval húzható, pozíció localStorage-ban tárolva
- [ ] Viewport határokon belül marad
- [ ] Relay offline → "offline" felirat pirossal
- [ ] `pnpm check` 0 error 0 warning
- [ ] `pnpm test` minden teszt zöld
- [ ] Nincs negatív hatás a többi tab működésére

---

## Fejlesztői jegyzetek

### Miért S méret?
A relay endpoint-ok már léteznek, a core data pipeline (PKG-021) biztosítja az alapokat. Ez a csomag CSAK egyetlen Svelte komponens + egy core függvény + unit tesztek. A legacy verzió (~80 sor JS + ~40 sor CSS) referenciaként szolgál.

### Különbség PKG-017-től
- **PKG-017**: Cron Timeline — 24h vizuális timeline, ÖSSZES cron job látszik, NOW indikátor, melyik következik
- **PKG-026**: Dev Job Indicator — kompakt lebegő panel, CSAK a dev-loop státusz, visszaszámláló + queue + running

A kettő teljesen különböző funkció, más adatforrásból dolgoznak. A PKG-017 a relay cron schedule adatait használja, a PKG-026 a relay `/next-trigger` endpoint-ját.

### Komponens átfedés ellenőrzés
- ✅ **Egyedi komponens**: `DevJobIndicator.svelte` — más PKG nem használja
- ✅ **Egyedi tab**: NINCS saját tab (globális `+layout.svelte`-ben), nem ütközik tab PKG-kal
- ✅ **Egyedi data source**: `noema.ts` → `getDevJobStatus()` — más PKG nem definiálja


## 🎯 Mit

_Placeholder — to be filled._


## 📐 Scope

_Placeholder — to be filled._


## ✅ Acceptance Criteria

_Placeholder — to be filled._
