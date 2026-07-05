# PKG-022: Agents + Crons Tab

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-021 ✅ (data pipeline) | **Spec date:** 2026-07-05

## 🎯 Mit

Két tab komponens: Agents (teljes agent tábla Viktor al-tabbal) és Crons (cron tábla a meglévő crons.ts adatokból).

### F1: Agents Tab

`src/lib/components/tabs/Agents.svelte` — minden agent részletes nézetben:

**Táblázat**:
- Oszlopok: Emoji, Agent név, Státusz pötty (🟢🟡🔴), Státusz szöveg, Stale szint (0d/3d/7d színkód), Last run, Schedule, Role
- Rendezés: státusz szerint (red→yellow→green), azon belül ABC
- Stale detection: <1d zöld, 1-3d sárga, >3d piros border
- Hover: tooltip extra infóval

**Viktor al-szekció** (az Agents tab alján):
- Total audits, Recall %, Pending repos, Failed
- Recall trend (utolsó 2 run)
- Blind spots lista

### F2: Crons Tab

`src/lib/components/tabs/Crons.svelte` — cron lista a crons.ts adatokból:

**Táblázat** a legacy cron pipeline mintájára:
- Oszlopok: Időpont, Cron név, Agent (emoji + név), Leírás, Utolsó futás, Státusz pötty
- Csoportosítás: ÉJSZAKA / REGGEL / NAPPAL / ESTE / AUTOMATIKUS
- Színkód: OK (zöld), Error (piros), Warning (sárga)

## 📐 Scope

### Mit érint
- `src/lib/components/tabs/Agents.svelte` — ÚJ
- `src/lib/components/tabs/Crons.svelte` — ÚJ
- `src/routes/+page.svelte` — tab routing bővítés
- `src/routes/+page.server.ts` — extra adat ha kell

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | Agents.svelte: táblázat + Viktor al-szekció | `tabs/Agents.svelte` |
| **Phase 2** | Crons.svelte: csoportosított cron tábla | `tabs/Crons.svelte` |
| **Phase 3** | +page.svelte: agents és crons tab-ok bekötése | `+page.svelte` |
| **Phase 4** | Teszt: mindkét tab renderel, adatok helyesek | Manuális + `pnpm check` |

## ✅ Acceptance Criteria

1. Agents tab: minden agent látszik, státusz színkódok helyesek
2. Viktor adatok látszanak (recall, pending, blind spots)
3. Crons tab: cron-ok csoportosítva, időpontok helyesek
4. `pnpm check` ✅, `pnpm test` ✅
