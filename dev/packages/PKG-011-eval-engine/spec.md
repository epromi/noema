# PKG-011: Eval Scoring Engine (F-21)

> Státusz: 📋 Spec kész | Méret: L | Roadmap: F-21 P2
> Forrás: Industry Review 2026 — Braintrust eval layer, DigitalApplied "eval gates"

## Spec

**Mit**: Automatikus minőségbírálat agent session-ökön. Minden lefutott agent session kap egy score-t (0-100) a trace alapján. A score figyelembe veszi: hibák száma, loop-ok, felesleges tool hívások, timeout, sikeres completion. A fail-ök visszakerülnek az agent-hez feedback loop-ként.

**Miért**: Az iparág szerint az eval layer alapkövetelmény. "Production trace scoring and feeding failures back into the eval suite" — Braintrust. Jelenleg QA cron csak statikus ellenőrzés (template, adatfrissesség). Nem tudjuk hogy egy agent session JÓ volt-e vagy csak NEM HIBA.

**Scope**:
- `lib/core/eval-engine.ts` — scoring logika
- `lib/components/tabs/EvalPanel.svelte` — score dashboard
- Score-ok perzisztálása: `memory/state/agent-scores.jsonl`
- Feedback loop: fail → cron trigger / agent újra spawn

**Out of scope**:
- Nem valós idejű (batch processing, nightly)
- Nem használ külső LLM-et scoring-ra (szabály-alapú)
- Nincs "human review" UI (később)

## Fázisok

### F0 — Spec (~15 perc)
- [ ] Scoring kritériumok definiálása
- [ ] Súlyozás meghatározása
- [ ] Feedback loop architektúra tervezése

### F1 — Core: Scoring Engine (~60 perc)
- [ ] `lib/types/index.ts`: EvalScore, EvalCriteria, EvalData típusok
- [ ] `lib/core/eval-engine.ts`:
  - `scoreSession(sessionKey)` — egy session score-olása
  - Kritériumok:
    - **Completion** (30%) — sikeresen befejeződött?
    - **Error rate** (25%) — hiba tool hívások aránya
    - **Efficiency** (20%) — felesleges/spam tool hívások
    - **Loop detection** (15%) — ismétlődő tool hívás pattern
    - **Timeout** (10%) — közel volt-e a timeout-hoz
  - `scoreAllRecent(limit=20)` — utolsó N session
  - `getScoreTrend()` — score trend (javul/romlik)
- [ ] `tests/core/eval-engine.test.ts`: legalább 5 teszteset
- [ ] `pnpm check` ZÖLD

### F2 — UI: Score Dashboard (~60 perc)
- [ ] `EvalPanel.svelte`: 
  - Score trend chart (utolsó 20 session)
  - Kritériumbontás (miért kapta ezt a score-t)
  - Agent-enkénti átlag score
  - 🔴/🟡/🟢 threshold vizualizáció
- [ ] `+page.svelte`: tab felvétele
- [ ] `pnpm check` ZÖLD

### F3 — Integráció: Feedback Loop (~45 perc)
- [ ] `scripts/eval-processor.js`: nightly futás
  - scoreAllRecent → JSONL
  - fail threshold alatt: flag `memory/state/action-queue.md`-ben
  - Alfred automatikusan látja az action queue-ban
- [ ] Cron: `noema-eval` (daily, 02:00)
- [ ] `lib/core/collector.ts`: eval data regisztrálása
- [ ] `pnpm check` ZÖLD

### F4 — Teszt (~20 perc)
- [ ] `pnpm test` ZÖLD
- [ ] `pnpm build` ZÖLD
- [ ] Manuális: valós session score helyesnek tűnik

### F5 — Merge (~10 perc)
- [ ] Git commit: "🧠 feat: Eval Scoring Engine (F-21, PKG-011)"
- [ ] Push

## Log

| Idő | Fázis | Mi történt |
|-----|-------|------------|
| 2026-07-05 10:50 | F0 | Spec elkészítve |
