# PKG-011: Agent Session Health Scoring (F-21)

> Státusz: 📋 Spec kész | Méret: M (leminősítve L→M) | Roadmap: F-21 P2
> ⚠️ Átnevezve: "Eval Scoring Engine" → "Agent Session Health Scoring" — lásd review notes

## Korrekció (2026-07-05 11:00)

**Félreértés**: A Braintrust "eval layer" LLM válaszok minőségét pontozza (prompt engineering, regression tesztelés). A Noema-nak nem LLM eval-ra van szüksége, hanem **agent session egészség pontozásra** — rendszer szintű metrika.

**Amit MI tudunk**: Minden agent session-ről tudjuk hogy:
- Befejeződött-e vagy timeout-olt
- Hány tool call volt, hány hibás
- Volt-e loop (ugyanaz a tool call 3x+)
- Ismerjük a session hosszát

Ezek rendszer-metrikák, nem LLM minőségi metrikák. Ez JOBB mint az LLM eval mert konkrét, mérhető, szubjektivitás-mentes.

## Spec

**Mit**: Agent session-ök egészségének automatikus pontozása (0-100) rendszer-metrikák alapján. Score trend követése agent-enként. A pontozás NEM LLM-alapú — tisztán szabály-alapú, determinisztikus.

**Miért**: Jelenleg bináris a kép: "lefutott" vagy "nem". De egy session lehet "lefutott de 15 felesleges tool call-al" vagy "lefutott de 5 loop-pal". A health score ezt teszi láthatóvá.

**Scope**:
- `lib/core/session-health.ts` — pontozó motor
- `lib/components/tabs/SessionHealth.svelte` — score dashboard
- Perzisztálás: `memory/state/session-scores.jsonl`
- Trend riasztás: ha egy agent score-ja romlik 3 egymást követő session-ben

**Out of scope**:
- Nem LLM válasz minőség (nincs "jó volt-e a válasz" pontozás)
- Nem használ külső LLM-et
- Nincs feedback loop (az action queue-ban Alfred látja)

## Scoring Kritériumok

| Kritérium | Súly | Mit mér |
|-----------|------|---------|
| **Completion** | 35% | Sikeresen befejeződött? Timeout nélkül? |
| **Efficiency** | 30% | Tool call-ok száma / hasznos tool call-ok aránya |
| **Error rate** | 20% | Hibás tool hívások aránya |
| **Loop penalty** | 15% | Ismétlődő tool call pattern (ugyanaz 3x+) |

A súlyozás NEM Braintrust-ből jön — saját rendszer-metrika.

## Fázisok

### F0 — Scoring kalibráció (~30 perc)
- [ ] Valós session-ök áttekintése: mi a "normális" tool call szám?
- [ ] Threshold-ok meghatározása agent-enként
- [ ] Teszt session-ök score kézi validálása

### F1 — Core (~45 perc)
- [ ] `lib/types/index.ts`: HealthScore, ScoreBreakdown típusok
- [ ] `lib/core/session-health.ts`:
  - `scoreSession(sessionKey)` — 0-100 score
  - `getScoreTrend(agentId)` — utolsó 10 session trend
  - `getAgentHealthReport()` — összes agent score summary
- [ ] `tests/core/session-health.test.ts`
- [ ] `pnpm check` ZÖLD

### F2 — UI (~45 perc)
- [ ] `SessionHealth.svelte`: agent-enkénti score kártyák + trend
- [ ] Score bontás: melyik kritérium milyen
- [ ] 🔴🟡🟢 threshold: <40 / 40-70 / >70
- [ ] `pnpm check` ZÖLD

### F3-F5: Integráció, teszt, merge
