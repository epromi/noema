# PKG-003: Core — Agent Data Module

> Státusz: 📋 Spec kész | Méret: S | 
> Dependencia: PKG-002 (core utils)

## Spec

**Mit**: `lib/core/agents.ts` — agent státuszok, session-ök, utolsó spawn időpontok lekérése.

**Scope**:
- `src/lib/types/index.ts`: AgentEntry, AgentData
- `src/lib/core/agents.ts`: getAgents()
- `tests/core/agents.test.ts`

## Fázisok

### F0 — Spec (~5 perc)
- [ ] Mintát követi (PKG-002)

### F1 — Core (~45 perc)
- [ ] `src/lib/types/index.ts`: AgentEntry, AgentData, AgentStatus típusok
- [ ] `src/lib/core/agents.ts`:
  - `getAgents()` → `sessions_list` + `agents/list` API (vagy exec)
  - Parse sessions: aktív, idle, stuck detektálás
  - Agent-enként: spawn count, last active, uptime, státusz
  - `getAgentDetail(agentId)` → egy agent részletes státusza
  - Fallback: status.md fájlokból ha API nem elérhető
- [ ] `tests/core/agents.test.ts`: parse + classify teszt
- [ ] `pnpm check` ZÖLD

### F2 — Teszt (~10 perc)
- [ ] `pnpm test` ZÖLD
- [ ] `pnpm build` ZÖLD

### F3 — Merge (~5 perc)
- [ ] Git commit: "🧠 feat: Agent data module (PKG-003)"
- [ ] Push
