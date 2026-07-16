# PKG-023: Orchestrator Tab

**Size:** L | **Effort:** 2-3h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-021 ✅, PKG-022 ✅ (Agents + Crons tabs must exist) | **Spec date:** 2026-07-05  
**Review:** v2 (issues 3,4,5,6 fixed — reclassified L, PKG-020 ⏭️ absorbed, crons dedup, phases reduced to 5)

## 🎯 Mit

Az Orchestrator tab — a vezérlőközpont. Otto nightly timeline, action queue kanban, cron pipeline (vízszintes timeline + grouped table), kutatási proposal-ök.

⚠️ **Ez a PKG abszorbeálja a PKG-020-at** (action multi-choice). PKG-020 már ⏭️ (absorbed) státuszban.

### F1: Otto Nightly Timeline

Vertikális timeline az Otto nightly run-okról:
- Minden run: dátum, státusz ikon (✅❌⚠️), rövid summary
- Legutóbbi 10 run
- Adat: `research.ts` → Otto nightly log parse

### F2: Action Queue Kanban (+ PKG-020 multi-choice)

3 oszlopos kanban: ⚡ Auto-resolved, 👔 Alfred, 🧑 András
- Multi-action gombok minden item-en: gombcsoport a lehetséges action-ökből
- Action típusok: implement, done, escalate, restart, trigger, investigate, activate, paid
- Szintaxis: `→ [Done|Escalate|Investigate]` formátum
- Adat: `noema.ts` → action queue adat

### F3: Cron Pipeline — Timeline + Grouped Table

Vízszintes cron timeline + csoportosított táblázat:
- **Timeline sáv**: 24 órás vízszintes sáv cron pöttyökkel, aktuális idő jelölő
- **Grouped table**: csoportosítva (ÉJSZAKA / REGGEL / NAPPAL / ESTE / AUTOMATIKUS)
- Oszlopok: Időpont, Név, Agent, Leírás, Utolsó futás, OK/Error pötty
- A PKG-022 Crons tab-ban CSAK egyszerű lista van — ITT van a teljes pipeline nézet
- Adat: `crons.ts` → getCrons()

### F4: Noema Product Research

Dashboard research proposal-ök:
- Dátum, PROPOSE/IDEA count
- Proposal kártyák: státusz, priority, ▶ Mehet gomb
- Adat: `research.ts` → getResearch()

## 📐 Scope

### Mit érint
- `src/lib/components/tabs/Orchestrator.svelte` — ÚJ
- `src/routes/+page.svelte` — tab routing
- `src/lib/types/index.ts` — action queue multi-action típusok

### Mit NEM érint
- Agents / Crons tab komponensek — azok PKG-022
- Viktor tab — az PKG-024
- Crons egyszerű lista — az PKG-022 (ez itt a pipeline nézet)

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | Otto timeline komponens | `Orchestrator.svelte` |
| **Phase 2** | Action queue kanban (multi-action gombokkal) — PKG-020 abszorpció | `Orchestrator.svelte` |
| **Phase 3** | Cron pipeline: timeline sáv + grouped table | `Orchestrator.svelte` |
| **Phase 4** | Research proposals szekció | `Orchestrator.svelte` |
| **Phase 5** | +page.svelte routing + `pnpm check` ✅ + `pnpm test` ✅ | `+page.svelte` |

## ✅ Acceptance Criteria

1. Otto timeline: utolsó 10 run, státusz ikonok, rövid summary
2. Action queue: 3 oszlop, multi-action gombok, működő `sendAction` hívások
3. Cron pipeline: 24h timeline sáv + grouped table, aktuális idő jelölő
4. Research proposals: ▶ Mehet gombok működnek
5. `pnpm check` ✅, `pnpm test` ✅
