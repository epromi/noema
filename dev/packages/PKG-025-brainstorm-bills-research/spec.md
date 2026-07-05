# PKG-025: Brainstorm + Bills + Research Tabs

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-021 ✅ | **Spec date:** 2026-07-05

## 🎯 Mit

Három kisebb tab egy pakkban: Brainstorming, Bills (számlák + open loop-ok), Research.

### F1: Brainstorm Tab

`src/lib/components/tabs/Brainstorm.svelte`:

**Grid** kategóriánként:
- Pénzügyi AGI, Productivity AGI, Infrastrukturális AGI, Opportunity Scouting
- Minden kategória: kártyák ötletekkel
- Státusz jelölés: aktív / parkoló / kész
- Új ötlet input mező (opcionális, low prio)

### F2: Bills Tab

`src/lib/components/tabs/Bills.svelte`:

**Számlák**:
- Táblázat: Név, Összeg, Határidő, Státusz (paid/pending/overdue), Link
- Színkód: overdue (piros), ma esedékes (sárga), future (zöld)
- Adat: `bills.ts` → getBills()

**Open Loop-ok**:
- Lista: ID, leírás, kor, prioritás szín (⚠️ 🚩 🔴)
- Escalation szintek: 3-6d ⚠️, 7-13d 🚩, 14+d 🔴
- Adat: `noema.ts` → open loops adat

### F3: Research Tab

`src/lib/components/tabs/Research.svelte`:

**Kutatási listák**:
- Otto Nightly QA eredmények (utolsó 3)
- Dashboard QA eredmények  
- Active research items
- Kilépési stratégiák / strategic initiatives

## 📐 Scope

### Mit érint
- `src/lib/components/tabs/Brainstorm.svelte` — ÚJ
- `src/lib/components/tabs/Bills.svelte` — ÚJ
- `src/lib/components/tabs/Research.svelte` — ÚJ
- `src/routes/+page.svelte` — tab routing
- `src/routes/+page.server.ts` — brainstorm data (lehet új funkció)

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | Brainstorm.svelte: kategória grid | `tabs/Brainstorm.svelte` |
| **Phase 2** | Bills.svelte: számlák + open loop-ok | `tabs/Bills.svelte` |
| **Phase 3** | Research.svelte: QA + research lista | `tabs/Research.svelte` |
| **Phase 4** | +page.svelte: tab routing frissítés | `+page.svelte` |
| **Phase 5** | Teszt: `pnpm check` ✅, `pnpm test` ✅ |

## ✅ Acceptance Criteria

1. Brainstorm tab: grid látszik kategóriákkal, ötletekkel
2. Bills tab: számlák határidővel + open loop-ok escalation színkóddal
3. Research tab: QA eredmények + research lista
4. `pnpm check` ✅, `pnpm test` ✅
