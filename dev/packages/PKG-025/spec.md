# PKG-025: Brainstorm + Bills + Research Tabs

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-021 ✅ | **Spec date:** 2026-07-05  
**Review:** v2

## 🎯 Mit

Három kisebb tab egy pakkban. Plusz egy új data source: `getBrainstorm()` hozzáadása a `noema.ts`-hez — a brainstorm adatok eddig nem voltak a core modulokban.

### F0: Brainstorm Data Source — `src/lib/core/noema.ts`

⚠️ **Ez a data source még NEM létezik** — a PKG-025 hozza létre.

`getBrainstorm()` függvény hozzáadása `noema.ts`-hez:
- Beolvassa `memory/brainstorming/action-tracker.md`-t a provider-en keresztül
- Parse-olja a szekciókat: autoexec, autonotify, approval, weekend, backlog
- Visszaadja: `{ sections: {key, label, items: [{name, status, done}]}, pending: number }`
- Type: `BrainstormData` hozzáadása `src/lib/types/index.ts`-hez

### F1: Brainstorm Tab — `src/lib/components/tabs/Brainstorm.svelte`

**Grid** kategóriánként (autoexec, autonotify, approval, weekend, backlog):
- Minden kategória: címke + item kártyák
- Item: név, státusz (✅ kész / ⏳ folyamat / 📋 pending)
- Pending counter a tab header-ben
- Adat: `noema.ts` → getBrainstorm()

### F2: Bills Tab — `src/lib/components/tabs/Bills.svelte`

**Számlák**:
- Táblázat: Név, Összeg, Határidő, Státusz (paid/pending/overdue), Link
- Színkód: overdue (piros), ma esedékes (sárga), future (zöld)
- Adat: `bills.ts` → getBills()

**Open Loop-ok**:
- Lista: ID, leírás, kor, prioritás szín (⚠️ 🚩 🔴)
- Escalation szintek: 3-6d ⚠️, 7-13d 🚩, 14+d 🔴
- Adat: `bills.ts` → getBills() → openLoops mező

### F3: Research Tab — `src/lib/components/tabs/Research.svelte`

**Kutatási listák**:
- Dashboard Research proposals (autoFix, propose, idea count)
- Otto Nightly QA (utolsó 3 run)
- Kilépési stratégiák
- Adat: `research.ts` → getResearch()

## 📐 Scope

### Mit érint
- `src/lib/core/noema.ts` — ÚJ: getBrainstorm() függvény
- `src/lib/types/index.ts` — ÚJ: BrainstormData, BrainstormSection típusok
- `src/lib/components/tabs/Brainstorm.svelte` — ÚJ
- `src/lib/components/tabs/Bills.svelte` — ÚJ
- `src/lib/components/tabs/Research.svelte` — ÚJ
- `src/routes/+page.svelte` — tab routing
- `tests/core/noema.test.ts` — brainstorm data source teszt

### Mit NEM érint
- Más core modul — CSAK noema.ts (getBrainstorm)
- Cron pipeline / Viktor — azok másik PKG-ban

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | noema.ts: getBrainstorm() + types: BrainstormData | `core/noema.ts`, `types/index.ts` |
| **Phase 2** | Brainstorm.svelte: kategória grid action-tracker adatokból | `tabs/Brainstorm.svelte` |
| **Phase 3** | Bills.svelte: számlák + open loop-ok | `tabs/Bills.svelte` |
| **Phase 4** | Research.svelte: QA + research lista | `tabs/Research.svelte` |
| **Phase 5** | +page.svelte routing + teszt: `pnpm check` ✅ + `pnpm test` ✅ | `+page.svelte` |

## ✅ Acceptance Criteria

1. getBrainstorm() parse-olja a action-tracker.md-t → sections + pending count
2. Brainstorm tab: kategóriák látszanak, item-ek státusszal, pending counter
3. Bills tab: számlák + open loop-ok escalation színkódokkal
4. Research tab: QA eredmények + proposals
5. `pnpm check` ✅, `pnpm test` ✅ (meglévő tesztek nem törnek)
