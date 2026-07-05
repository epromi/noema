# PKG-027: Nightly Dashboard Research → Developer Pipeline Bridge

**🚨 TARGET: scripts (processor) + Otto workflow — NEM UI komponens**

> Ez egy INFRA csomag — a dashboard kódjához nem nyúl.
> Cél: Otto éjszakai dashboard research-ének AUTO-FIX + PROPOSE item-ei automatikusan
> bekerüljenek a Noema developer pipeline-ba (relay → processor → Cursor → SvelteKit).
> ⛔ TILOS az `archive/v4.html`-hez nyúlni!

**Size:** S | **Effort:** 30-45m | **Priority:** P0 | **Status:** spec
**Depends on:** PKG-013 (Provider) ✅ | **Spec date:** 2026-07-05

## 🎯 Mit

Otto éjszakai dashboard review-ja (jelenleg `memory/research/dashboard/YYYY-MM-DD.md`) automatikusan
tudjon PKG action-öket queue-olni a fejlesztői pipeline-ba.

### F1: Otto → Relay integráció

Otto tudjon POST-olni a relay `/action` endpoint-ra:

```bash
curl -X POST http://127.0.0.1:18998/action \
  -H "Content-Type: application/json" \
  -d '{"action":"implement","id":"PKG-XXX","description":"AUTO-FIX: <finding>"}'
```

- **AUTO-FIX itemek** → azonnali queue `action: "implement"` + `id: "PKG-XXX"`-ként
- **PROPOSE itemek** → `action: "implement"` + `id: "PKG-XXX"`-ként, de a description-ben `[PROPOSE]` prefix
- A PKG ID-ket a rendszer automatikusan osztja ki (következő szabad PKG-NNN szám)

### F2: Auto-PKG spec generálás

A processor tudjon minimális PKG spec-et generálni Otto finding-jaiból:

1. Otto POST-ol a relay-nek egy dashboard finding-ot
2. A relay fogadja (már működik)
3. A processor érzékeli az új action-t
4. A processor automatikusan generál egy minimal PKG spec fájlt (`dev/packages/PKG-NNN-auto-fix-N/spec.md`)
5. A processor frissíti az INDEX.md-t (új sor)
6. A processor elindítja a Cursor agent-et a generált spec-kel

### F3: Otto workflow update

Otto AGENTS.md-jének frissítése:
- Dashboard research után AUTO-FIX finding-ok automatikus relay POST
- Formátum: `{"action":"implement","id":"PKG-XXX","description":"AUTO-FIX: <rövid leírás>"}`
- PROPOSE finding-ok is queue-olhatók, de `[REVIEW]` flag-gel
- Nincs manuális kör — az egész automata

### F4: Deduplikáció

- A processor ellenőrizze, hogy ugyanaz a finding ne legyen már queue-olva
- Ha már van aktív (pending/processing) action ugyanarra, skip
- Dedup key: `id` mező

## 📐 Scope

### Mit érint
- `memory/protocols/otto-nightly-dashboard.md` — **ÚJ**: Otto dashboard auto-fix protokoll
- `agents/back-office/AGENTS.md` — Otto workflow: dashboard research utáni relay POST lépés
- `scripts/dashboard-action-processor.js` — Auto-PKG spec generálás + INDEX.md update
- `memory/research/dashboard/` — formátum: machine-parseable szekció

### Mit NEM érint
- ⛔ `archive/v4.html`, `dashboard.html`, `generate.cjs` — TILOS!
- `src/lib/` — semmi (ez infrastruktúra, nem UI)
- `relay.cjs` — relé már fogad POST-ot, nem kell változtatni
- `src/lib/components/` — semmi

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | Otto→Relay POST template: curl parancs a relay `/action` endpoint-ra | `memory/protocols/otto-nightly-dashboard.md` |
| **Phase 2** | Processor: auto-PKG spec generálás (minimal spec template finding-ból) | `scripts/dashboard-action-processor.js` |
| **Phase 3** | Processor: INDEX.md auto-update (új PKG sor beszúrása) | `scripts/dashboard-action-processor.js` |
| **Phase 4** | Otto AGENTS.md: dashboard research után relay POST lépés | `agents/back-office/AGENTS.md` |
| **Phase 5** | Deduplikáció: processor ellenőrizze a duplikált action-öket | `scripts/dashboard-action-processor.js` |
| **Phase 6** | Teszt: manuális relay POST → processor feldolgozza → PKG spec létrejön → Cursor elindul | E2E manuális |

## 🎨 Design

### Otto relay POST template (bash)
```bash
# Minden AUTO-FIX finding-ra:
curl -s -X POST http://127.0.0.1:18998/action \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"implement\",\"id\":\"PKG-$(printf '%03d' $NEXT_ID)\",\"description\":\"AUTO-FIX: $TITLE\"}"
```

### Auto-generált PKG spec minimal template
```markdown
# PKG-NNN: <finding title>

**🚨 TARGET: SvelteKit — <target file>**

**Size:** S | **Effort:** 15m | **Priority:** P1 | **Status:** spec
**Auto-generated:** Otto Nightly Dashboard Research | **Date:** YYYY-MM-DD

## 🎯 Mit
<finding description>

## 📐 Scope
- `<target file>` — <what to change>

## ✅ Acceptance
- `<condition>`
- `pnpm check` ✅
- ⛔ `archive/v4.html` untouched
```

### Processor flow
```
1. Read action from JSONL
2. If description starts with "AUTO-FIX: " or "[PROPOSE] ":
   a. Generate PKG spec in dev/packages/PKG-NNN-<slug>/spec.md
   b. Append to INDEX.md
   c. Write Cursor prompt
   d. Run dev-loop.sh
3. If description doesn't match: existing PKG flow (unchanged)
```

## ✅ Acceptance Criteria

1. Otto tud relay-nek POST-olni dashboard finding-okat
2. A processor érzékeli és feldolgozza az AUTO-FIX action-öket
3. Auto-PKG spec generálódik a finding-ból
4. INDEX.md automatikusan frissül
5. Cursor agent elindul a generált spec-kel
6. Deduplikáció működik
7. `pnpm check` ✅ (processor JS-re)
8. ⛔ archive/v4.html untouched
