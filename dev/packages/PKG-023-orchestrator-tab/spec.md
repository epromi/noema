# PKG-023: Orchestrator Tab

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-021 ✅ | **Spec date:** 2026-07-05

## 🎯 Mit

Az Orchestrator tab — a vezérlőközpont. Otto nightly timeline, action queue kanban, cron pipeline (vízszintes timeline + táblázat), kutatási proposal-ök.

### F1: Otto Nightly Timeline

A legacy dashboard `#otto-timeline` div-jének SvelteKit megfelelője. Vertikális timeline az Otto nightly run-okról:
- Minden run: dátum, státusz ikon (✅❌⚠️), rövid summary
- Legutóbbi 10 run
- Adat: `research.ts` → Otto nightly log-ok parse-olása

### F2: Action Queue Kanban

3 oszlopos kanban: ⚡ Auto-resolved, 👔 Alfred, 🧑 András
- Minden item: ID, leírás, kor, prioritás szín
- **Multi-action gombok** (PKG-020 spec alapján): gombcsoport action-önként
- Adat: `noema.ts` → action queue parse-olás
- **⚠️ PKG-020 implementációját IS tartalmazza** (action multi-choice)

### F3: Cron Pipeline

A legacy vízszintes cron timeline + csoportosított táblázat SvelteKit verziója:
- Timeline sáv: 24 órás vízszintes sáv pöttyökkel
- Táblázat: csoportosítva (ÉJSZAKA/REG GEL/NAPPAL/ESTE/AUTO)
- Adat: `crons.ts` → getCrons()

### F4: Noema Product Research

Dashboard research proposal-ök listája:
- Dátum, AUTO-FIX/PROPOSE/IDEA count
- Proposal kártyák: státusz, priority, ▶ Mehet gomb
- Adat: `research.ts` → getResearch()

## 📐 Scope

### Mit érint
- `src/lib/components/tabs/Orchestrator.svelte` — ÚJ: a teljes orchestrator tab
- `src/routes/+page.svelte` — tab routing
- `src/lib/types/index.ts` — action queue típusok (multi-action)

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | Otto timeline komponens | `Orchestrator.svelte` |
| **Phase 2** | Action queue kanban (multi-action gombokkal) | `Orchestrator.svelte` |
| **Phase 3** | Cron pipeline (timeline + táblázat) | `Orchestrator.svelte` |
| **Phase 4** | Research proposals | `Orchestrator.svelte` |
| **Phase 5** | +page.svelte orchestrator tab bekötés | `+page.svelte` |
| **Phase 6** | `pnpm check` ✅, `pnpm test` ✅ |

## ✅ Acceptance Criteria

1. Otto timeline mutatja az utolsó 10 nightly run-t
2. Action queue kanban: 3 oszlop, multi-action gombok minden item-en
3. Cron pipeline: vízszintes timeline + csoportosított táblázat
4. Research proposals: ▶ Mehet gombok működőképesek
5. `pnpm check` ✅, `pnpm test` ✅
