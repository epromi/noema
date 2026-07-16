# PKG-042: Porter Triage + Operational Pulse

**Státusz**: 📋 F0 | **Méret**: M | **Becslés**: 2h | **Függőség**: PKG-021 (Overview Tab)
**Target**: SvelteKit (`src/lib/components/tabs/Overview.svelte` + `src/lib/core/` data pipeline)

## Kérés

Két új szekció az Overview tab-on:
1. **🫀 Operational Pulse** — 8 agent élő státusz pöttyös (zöld/sárga/piros) + detail
2. **📧 Porter Email Triage** — utolsó scan, új emailek, alert-ek, unread countok age bracket-enként

## Jelenlegi Probléma

1. Az Overview tab (PKG-021): alap adatok, de nincs email triage vizibilitás
2. A `memory/state/porter-latest-triage.md` feldolgozatlan a SvelteKit pipeline-ban
3. Nincs "single pane of glass" az összes agent operatív státuszához

## Specifikáció

### 1. Data Pipeline — Porter Adatkinyerés

**Új collector**: `src/lib/core/porter.ts` (vagy meglévő core bővítése)

**Forrás**: `memory/state/porter-latest-triage.md`

**Kinyert adatok típusa**:
```typescript
interface PorterData {
  lastScan: string;         // "2026-07-12 16:09"
  newCount: number;         // 2
  alerts: PorterAlert[];    // kritikus emailek
  unreadLess7d: number;     // <7 napos
  unread7to30d: number;     // 7-30 napos
  unread30to60d: number;    // 30-60 napos
  totalUnread: number;      // összesen
  bills: string;            // "none" | szöveg
  deliveries: string;       // "none" | szöveg
  status: 'ok' | 'error';   // parse sikeresség
  nextScan: string;         // "17:09"
}

interface PorterAlert {
  header: string;
  detail: string;
  severity: 'critical' | 'warning';
}
```

**Regex-ek a parse-oláshoz**:
- Dátum: `/Porter Triage\s*[^0-9]*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/`
- Új email count: `/Summary[\s\S]*?(\d+)\s+new\s+emails?/i`
- Alert-ek: `## New Emails` szekció `###` blokkjai, ha tartalmaz 🚨/CRITICAL/bounty/💳
- Unread: `## Persistent UNREAD` → `<7d`, `7-30d`, `30-60d` regex
- Bills: `## Delivery/Shipping` szekció

### 2. Data Pipeline — Agent Operational Pulse

**Új collector**: `src/lib/core/pulse.ts` (vagy meglévő agents.ts bővítése)

**Típus**:
```typescript
interface AgentPulse {
  id: string;
  name: string;
  emoji: string;
  status: 'green' | 'yellow' | 'red';
  detail: string;
  schedule: string;
}
```

**Status mapping**:

| Agent | Status forrás | Detail |
|-------|--------------|--------|
| Otto | timeline[0].status (warn=yellow, ok=green) | timeline[0].time |
| Viktor | viktorData.circuit (TRIPPED=red), .active>0 (green), else yellow | activeLabel / "Idle" |
| Scout | cronGrid match | lastSpawn |
| Porter | cronGrid "Porter Hourly Triage" status | last run |
| Edwin | cronGrid "Edwin CCM (7-23)" status | last run |
| Hugo | cronGrid (ha van) | — |
| Cortex | cronGrid (ha van) | — |
| Alfred | always green | "Active" |

### 3. UI — Overview.svelte Módosítás

**Két új Svelte komponens** (vagy inline az Overview tab-on):

**Operational Pulse szekció**:
- Cím: "🫀 Operational Pulse"
- Layout: flex-wrap, 8 agent kártya (emoji + név + színes pötty + detail)
- Pötty színek: green → 🟢, yellow → 🟡, red → 🔴
- Min-width 100px per item

**Porter Email Triage szekció**:
- Cím: "📧 Email Triage"
- Fejléc: státusz + utolsó scan + következő scan + napi email count
- Alert lista (ha van): 🚨/📰 ikon + header + detail
- Unread summary sáv: <7d, 7-30d, 30-60d countok, összesen
- Ha totalUnread === 0: "✅ Nincs feldolgozatlan email"
- Bills/deliveries: csak ha van találat

### 4. Nézetváltás

| Előtte | Utána |
|--------|-------|
| System gauges + Active Projects + Stalled | System gauges → **🫀 Pulse** → **📧 Triage** → Projects |

## Módosítandó Fájlok

| Fájl | Művelet |
|------|---------|
| `src/lib/core/porter.ts` | **ÚJ** — Porter triage parser |
| `src/lib/core/pulse.ts` | **ÚJ** — Agent operational status |
| `src/lib/types/index.ts` | PorterData, PorterAlert, AgentPulse type-ok |
| `src/lib/core/index.ts` | porter + pulse collector regisztrálás |
| `src/lib/components/tabs/Overview.svelte` | Pulse + Triage szekciók hozzáadása |
| `tests/core/porter.test.ts` | **ÚJ** — Porter parser unit tesztek |
| `tests/core/pulse.test.ts` | **ÚJ** — Pulse kalkuláció tesztek |

**Out of scope**:
- `archive/v4.html` vagy `generate.cjs` módosítása — DEPRECATED, nem érintjük
- Action gombok a Porter kártyán (későbbi PKG)
- SSE live update a pulse-hoz (PKG-009 már csinálta az infrastruktúrát)

## Plan

### F0 — Spec (~20 perc)
- [x] spec.md megírva
- [ ] plan.md megírva
- [ ] Scope: max 7 fájl, XL alatt

### F1 — Core (~40 perc)
- [ ] `porter.ts`: PorterData parser, regex-ek, hibakezelés
- [ ] `pulse.ts`: AgentPulse kalkuláció cronGrid + timeline + viktorData-ból
- [ ] `types/index.ts`: PorterData, PorterAlert, AgentPulse interface-ek
- [ ] `core/index.ts`: collector regisztráció
- [ ] Unit tesztek: porter.test.ts + pulse.test.ts
- [ ] `pnpm check` ZÖLD

### F2 — UI (~40 perc)
- [ ] `Overview.svelte`: Porter + Pulse komponensek/szekciók
- [ ] Porter szekció: scan idő, alert lista, unread summary
- [ ] Pulse szekció: 8 agent kártya pöttyökkel
- [ ] Reszponzív: flex-wrap, mobile-on is olvasható
- [ ] `pnpm check` ZÖLD

### F3 — Integráció + Teszt (~30 perc)
- [ ] `pnpm test` ZÖLD (porter.test.ts + pulse.test.ts 90%+)
- [ ] `pnpm build` ZÖLD
- [ ] Manuális ellenőrzés (SvelteKit dev server)
- [ ] Edge case: porter fájl hiányzik → error státusz, placeholder
- [ ] Edge case: cronGrid nem talál név-egyezést → fallback

### F4 — Merge (~10 perc)
- [ ] Git commit + push
- [ ] INDEX.md PKG-042 → ✅ F5
- [ ] Dashboard regen

## Verifikáció

- [ ] SvelteKit dev server: Overview tab-on Pulse + Triage szekció
- [ ] Porter adatok validak (lastScan, newCount, unread countok)
- [ ] Pulse: 8 agent, legalább 6-nak értelmes detail
- [ ] `pnpm test` zöld, porter + pulse coverage 90%+
- [ ] `pnpm build` hibátlan
- [ ] Porter file hiányzik → nem crash-el, error státusz + placeholder
- [ ] Mobile layout: pulse kártyák wrap-elnek, olvasható

## Log

| Idő | Fázis | Mi történt |
|-----|-------|------------|
| 2026-07-12 17:03 | F0 | Spec átírva SvelteKit targetre (András feedback) — legacy verzió törölve |
