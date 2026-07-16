# PKG-022: Agents + Crons Tab

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-021 ✅ (data pipeline) | **Spec date:** 2026-07-05  
**Review:** v2 (issues 2,3 fixed)

## 🎯 Mit

Két tab komponens: Agents (teljes agent tábla mini Viktor statokkal) és Crons (egyszerű lista tábla).

### F1: Agents Tab — `src/lib/components/tabs/Agents.svelte`

Teljes agent tábla:

**Táblázat**:
- Oszlopok: Emoji, Agent név, Státusz pötty (🟢🟡🔴), Státusz szöveg, Last run, Schedule, Model, Role
- Rendezés: státusz szerint (red→yellow→green), azon belül ABC
- Stale detection a `lastRun` mezőből: friss (<1d zöld), 1-3d sárga, >3d piros border

**MINI Viktor stat sor** (az Agents tab alján, CSAK 2 szám):
- Total audits: X | Recall: Y% | Pending repos: Z
- Ez NEM a teljes Viktor dashboard — az a PKG-024-ben van.

### F2: Crons Tab — `src/lib/components/tabs/Crons.svelte`

Egyszerű cron lista tábla (NEM a pipeline timeline — az a PKG-023 orchestrator tab-ban):

**Táblázat**:
- Oszlopok: Cron név, Agent, Schedule (időpont), Leírás, Last run, OK/Error
- Egyszerű lista, nincs csoportosítás, nincs timeline sáv
- Színkód: OK (zöld pötty), Error (piros pötty)
- Adat: `crons.ts` → getCrons()

## 📐 Scope

### Mit érint
- `src/lib/components/tabs/Agents.svelte` — ÚJ
- `src/lib/components/tabs/Crons.svelte` — ÚJ (egyszerű lista, nem pipeline)
- `src/routes/+page.svelte` — tab routing bővítés

### Mit NEM érint
- Cron pipeline / timeline — az PKG-023
- Teljes Viktor dashboard — az PKG-024
- Viktor blind spots / trend — az PKG-024

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | Agents.svelte: táblázat + MINI Viktor stats (2 szám) | `tabs/Agents.svelte` |
| **Phase 2** | Crons.svelte: egyszerű cron lista | `tabs/Crons.svelte` |
| **Phase 3** | +page.svelte: agents és crons tab routing | `+page.svelte` |
| **Phase 4** | Teszt: render ellenőrzés, `pnpm check` ✅, `pnpm test` ✅ | Manuális |

## ✅ Acceptance Criteria

1. Agents tab: minden agent látszik státusszal + stale jelöléssel
2. Agents tab alján MINI Viktor: `Total: X | Recall: Y% | Pending: Z` (max 1 sor)
3. Crons tab: egyszerű cron lista (nincs csoportosítás, nincs timeline)
4. `pnpm check` ✅, `pnpm test` ✅
