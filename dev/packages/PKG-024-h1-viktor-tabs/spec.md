# PKG-024: H1 + Viktor Tabs

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-021 ✅ | **Spec date:** 2026-07-05  
**Review:** v2 (issue 2 fixed — no Viktor overlap with PKG-022; MINI vs FULL explicit)

## 🎯 Mit

Két önálló tab komponens: H1 (HackerOne stats + program lista) és Viktor (TELJES security audit dashboard).

⚠️ **Viktor elhatárolás**: PKG-022 Agents tab alján CSAK 2 szám (`Total: X | Recall: Y%`). ITT van a TELJES Viktor dashboard (trend, blind spots, pending repos).

### F1: H1 Tab — `src/lib/components/tabs/H1.svelte`

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
- Total earnings, utolsó payout-ok

### F2: Viktor Tab — `src/lib/components/tabs/Viktor.svelte`

A TELJES Viktor security audit dashboard (nem csak mini stats):

**Stat kártyák** (4):
- Total audits | Recall % | Pending repos | Failed
- Circuit státusz (Normal/Warning/Tripped)

**Recall trend**:
- Utolsó 5 run recall %-ai (számsor)
- Trend irány (↑ javul, ↓ romlik, → stagnál)

**Blind spots**:
- CWE lista, sárga warning szín

**Pending repos**:
- Lista: repo név, prioritás, age

## 📐 Scope

### Mit érint
- `src/lib/components/tabs/H1.svelte` — ÚJ
- `src/lib/components/tabs/Viktor.svelte` — ÚJ (TELJES Viktor, nem mini)
- `src/routes/+page.svelte` — tab routing (h1 + viktor)

### Mit NEM érint
- Agents tab MINI Viktor — az PKG-022 (ott CSAK 2 szám: Total + Recall)

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | H1.svelte: stat kártyák + program lista + earnings | `tabs/H1.svelte` |
| **Phase 2** | Viktor.svelte: stat kártyák + recall trend + blind spots + pending repos | `tabs/Viktor.svelte` |
| **Phase 3** | +page.svelte: h1 + viktor tab routing | `+page.svelte` |
| **Phase 4** | Teszt: render ellenőrzés, `pnpm check` ✅, `pnpm test` ✅ | Manuális |

## ✅ Acceptance Criteria

1. H1 tab: statok + program lista + earnings látszik
2. Viktor tab: recall trend (5 run), blind spots, pending repos
3. Priority program-ok ⭐ kiemelve
4. NINCS Viktor duplikáció PKG-022-vel (ott csak 2 szám, itt minden)
5. `pnpm check` ✅, `pnpm test` ✅
