# PKG-024: H1 + Viktor Tab

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-021 ✅ | **Spec date:** 2026-07-05

## 🎯 Mit

HackerOne stats + program lista, és Viktor security audit dashboard.

### F1: H1 Tab

`src/lib/components/tabs/H1.svelte`:

**Stat kártyák** (4):
- Open reports (szám)
- Signal (score, színkód: pozitív=zöld, negatív=piros)
- Reputation
- Trial count

**Program lista**:
- Táblázat: Program név, Handle, BBP/Non-BBP, Scope típusok, Bounty range, Státusz
- Priority jelölés (⭐ PRIMARY, normál)
- Adat: `h1.ts` → getH1Data()

**Earnings** (ha van adat):
- Total earnings
- Utolsó payout-ok

### F2: Viktor Tab

`src/lib/components/tabs/Viktor.svelte`:

**Stat kártyák**:
- Total audits, Recall %, Pending repos, Failed audits
- Circuit státusz (Normal/Warning/Tripped)

**Recall trend**:
- Mini chart vagy számsor: utolsó 5 run recall %-ai
- Trend irány (↑ javul, ↓ romlik, → stagnál)

**Blind spots**:
- CWE lista (vesszővel elválasztva, wrap)
- Szín: sárga (warning)

**Pending repos**:
- Lista: repo név, prioritás, age

## 📐 Scope

### Mit érint
- `src/lib/components/tabs/H1.svelte` — ÚJ
- `src/lib/components/tabs/Viktor.svelte` — ÚJ (vagy az Agents tab része)
- `src/routes/+page.svelte` — tab routing
- `src/lib/types/index.ts` — ha kell új típus

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | H1.svelte: stat kártyák + program lista | `tabs/H1.svelte` |
| **Phase 2** | Viktor.svelte: audit stats + recall + blind spots | `tabs/Viktor.svelte` |
| **Phase 3** | +page.svelte: h1 és viktor tab bekötés | `+page.svelte` |
| **Phase 4** | Teszt: adatok renderelnek, `pnpm check` ✅ |

## ✅ Acceptance Criteria

1. H1 tab: statok + program lista látszik
2. Viktor tab: recall %, blind spots, pending repos látszik
3. Priority program-ok kiemelve
4. `pnpm check` ✅, `pnpm test` ✅
