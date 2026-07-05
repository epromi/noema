# PKG-010: Agent Decision Trace (F-20)

> Státusz: 📋 Spec kész | Méret: L | Roadmap: F-20 P2 (leminősítve P1→P2)
> ⚠️ Átnevezve: "Reasoning Trace Viewer" → "Agent Decision Trace" — lásd review notes

## Korrekció (2026-07-05 11:00)

**Félreértés**: A Braintrust "reasoning steps" pillére az LLM **belső gondolkodási lánca** egy API híváson belül. A Zylos.ai maga mondja: "fundamentally difficult" — azaz nyitott kutatási probléma, nem pedig hiányzó feature.

**Amit MI tudunk**: Agent session-ök tool call timeline-ja — mit csinált, milyen sorrendben, milyen argumentumokkal, mi volt az eredmény. Ez a "döntési fa" látható, a "gondolatmenet" nem.

**Érték**: A Hermes Studio "Audit Trail"-jénél több — nem csak eseménylista, hanem strukturált döntési fa: melyik tool-t miért hívta (tool output → következő tool választás), hol akadt el, hol loop-olt.

## Spec

**Mit**: Agent session-ök teljes tool call fájának kinyerése és vizualizációja — döntési lánc, nem gondolati lánc. Mit csinált az agent, milyen sorrendben, mi volt az egyes tool hívások eredménye, hogyan befolyásolta az output a következő döntést.

**Honnan**: `sessions_history` → assistant messages + tool_use blokkok → feldolgozás

**Scope**:
- `lib/core/decision-trace.ts` — tool call timeline parse-olás session history-ból
- `lib/components/tabs/DecisionTrace.svelte` — faszerkezet vizualizáció
- Tool call-ok közötti kapcsolat: mi trigger-elte a következő tool-t?

**Out of scope**:
- NEM próbáljuk kinyerni a modell "gondolatait" (nem elérhető)
- NEM használunk külső LLM-et a döntések magyarázatára
- NEM score-oljuk a trace-t (PKG-011 scope)

## Fázisok

### F0 — Verifikáció (~20 perc)
- [ ] `sessions_history` API teszt: tool_use blokkok elérhetők-e
- [ ] Milyen formátumban jön a session history (JSON struktúra)
- [ ] Mennyi session érhető el, milyen hosszúak
- [ ] Vizualizáció: fa vs timeline

### F1 — Core (~60-90 perc)
- [ ] `lib/types/index.ts`: DecisionStep, DecisionTrace típusok
- [ ] `lib/core/decision-trace.ts`:
  - `getDecisionTrace(sessionKey)` — tool call-ok sorrendben
  - Tool call → output → következő tool kapcsolat
  - `detectLoops()` — ismétlődő tool call pattern
  - `detectBottlenecks()` — hosszú tool hívások
- [ ] `tests/core/decision-trace.test.ts`
- [ ] `pnpm check` ZÖLD

### F2 — UI (~60-90 perc)
- [ ] `DecisionTrace.svelte`: bal oldal = fa, jobb oldal = részletek
- [ ] Session választó
- [ ] Tool call kártyák: tool név, argumentumok, output preview, latency
- [ ] Loop kiemelés (piros keret)
- [ ] `pnpm check` ZÖLD

### F3-F5: Integráció, teszt, merge (mint az eredeti spec)
