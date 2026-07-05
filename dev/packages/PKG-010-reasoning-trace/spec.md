# PKG-010: Reasoning Trace Viewer (F-20)

> Státusz: 📋 Spec kész | Méret: L | Roadmap: F-20 P1
> Forrás: Industry Review 2026 — Braintrust "4 pillars", Zylos.ai "reasoning visibility gap"

## Spec

**Mit**: Agent session-ök `<thinking>` blokkjainak kinyerése és vizualizációja a Noema dashboard-on. Plan-act-observe fázisok, tool választási indoklások, chain-of-thought trace-ek interaktív timeline-on.

**Miért**: Jelenleg CSAK az output-ot látjuk (mit csinált az agent, milyen tool-t hívott). Azt NEM látjuk hogy MIÉRT. A Braintrust szerint a reasoning trace az agent observability #1 pillére. Ez a Noema legnagyobb differentiator-a a Hermes ecosystem-től.

**Scope**:
- `lib/core/reasoning-trace.ts` — session history parse-olás, `<thinking>` blokk kinyerés
- `lib/components/tabs/ReasoningTrace.svelte` — timeline vizualizáció
- OpenClaw session history API: `thinking` blocks elérhetők-e? Ha nem: session transcript parse

**Out of scope**:
- Nem mentjük külön a trace-eket (csak session history-ból olvassuk)
- Nem score-oljuk a trace minőségét (az PKG-011)
- Nincs "agent replay" (az PKG-011 része)

## Fázisok

### F0 — Spec (~20 perc)
- [ ] `sessions_history` API teszt: thinking blokk elérhető-e
- [ ] Session transcript formátum feltérképezése
- [ ] Milyen agent session-ök érhetők el, mennyi trace anyag van
- [ ] Vizualizációs library választás (D3.js timeline vs CSS-only)

### F1 — Core: Reasoning Extractor (~60-90 perc)
- [ ] `lib/types/index.ts`: ReasoningStep, ReasoningTrace, ReasoningData típusok
- [ ] `lib/core/reasoning-trace.ts`: 
  - `getReasoningTrace(sessionKey)` — egy session trace kinyerése
  - Regex: `<thinking>...</thinking>` blokkok
  - `classifyStep()` — PLAN / ACT / OBSERVE / DECIDE fázisok
  - `extractToolDecision()` — melyik tool, miért
  - `getRecentTraces(limit=10)` — utolsó N session trace
- [ ] Fallback: ha nincs thinking blokk → session timeline tool call-okból
- [ ] `tests/core/reasoning-trace.test.ts`: legalább 3 teszteset
- [ ] `pnpm check` ZÖLD

### F2 — UI: Trace Timeline (~60-90 perc)
- [ ] `ReasoningTrace.svelte`: interaktív timeline
  - Bal oldal: idővonal, színkódolt fázisok (PLAN=kék, ACT=zöld, OBSERVE=sárga, DECIDE=lila)
  - Jobb oldal: kiválasztott lépés részletei (thinking szöveg, tool választás, argumentumok)
  - Hover: tooltip a teljes thinking blokkal
- [ ] Session választó dropdown
- [ ] Filter: csak PLAN/ACT/OBSERVE/DECIDE
- [ ] `+page.svelte`: tab felvétele
- [ ] `pnpm check` ZÖLD

### F3 — Integráció (~20 perc)
- [ ] `lib/core/collector.ts`: `getRecentTraces()` regisztrálása
- [ ] `lib/core/index.ts`: `getAllData()` frissítése
- [ ] `pnpm check` ZÖLD

### F4 — Teszt (~20 perc)
- [ ] `pnpm test` ZÖLD
- [ ] `pnpm build` ZÖLD
- [ ] Manuális: valós session trace megjelenik

### F5 — Merge (~10 perc)
- [ ] Git commit: "🧠 feat: Reasoning Trace Viewer (F-20, PKG-010)"
- [ ] Push

## Log

| Idő | Fázis | Mi történt |
|-----|-------|------------|
| 2026-07-05 10:50 | F0 | Spec elkészítve |
