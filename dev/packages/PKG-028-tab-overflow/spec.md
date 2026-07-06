# PKG-028: Tab Bar Overflow — Modern "More ▾" Dropdown

**Priority**: 🔴 HIGH | **Effort**: M | **Status**: 📋 F0 | **Created**: 2026-07-05 22:55

## Probléma

A tab bar 14 tab-bal + CronSidebar mellett nem fér ki széltében. A `overflow-x: auto` + rejtett scrollbar UX katasztrófa — a Noema tab teljesen eltűnt a nézetből és a felhasználó nem tudta hogy görgetni kell.

## Cél

Modern, reszponzív tab bar ami automatikusan detektálja a túlcsordulást és a nem látható tab-okat egy "More ▾" dropdown-ba helyezi.

## Scope → Mit érint

- ✅ **SvelteKit**: `src/routes/+layout.svelte` — a tab bar komponens újraírása
- ✅ **Új komponens**: `src/lib/components/layout/TabOverflow.svelte` — overflow detektáló + dropdown logika
- ⛔ **TILOS**: `archive/v4.html`, legacy HTML fájlok, Python szerver

## Specifikáció

### 1. Overflow detektálás (ResizeObserver)

```typescript
// Figyeljük a tab bar container szélességét vs a tab-ok teljes szélességét
// Ha totalWidth > containerWidth → overflow
```

### 2. "More ▾" Dropdown

- Amikor overflow van, a nem látható tab-ok egy "More ▾" gombból nyíló dropdown-ba kerülnek
- A dropdown nyíl ikon: `▾` (vagy `▼`)
- Kattintásra toggle
- Kattintás a dropdown-on kívülre → bezárul
- Dropdown item-ek: ugyanolyan stílus mint a normál tab-ok, aktív állapottal

### 3. Prioritási sorrend (melyik tab kerüljön overflow-ba)

A tab-ok fix sorrendben vannak. Amelyik nem fér ki, az overflow-ba kerül. A sorrend:

1. 🏠 Overview (MINDIG látható)
2. 🤖 Agents
3. ⏰ Crons
4. ⚡ Orchestrator
5. 🏴 HackerOne
6. 🛡️ Viktor
7. 🧠 Brainstorm
8. 🧠 Noema
9. 📋 Bills
10. 🔬 Research
11. 📋 Logs
12. 📜 Audit
13. 🌳 Trace
14. ⏰ Pipeline (mobile only)

### 4. Stílus

- Megtartja a jelenlegi tab bar stílust (alsó border, accent szín aktív tab-nál)
- "More ▾" gomb ugyanolyan padding/méret mint a többi tab
- Dropdown: `position: absolute`, fehér/sötét háttér (theme függő), `box-shadow`, `border-radius: 8px`, `z-index: 100`
- Dropdown item hover: halvány háttérszín

### 5. Reszponzivitás

- `ResizeObserver`-rel figyeljük a container méretváltozását
- Ablak átméretezéskor automatikusan újraszámol
- Mobil nézetben (≤768px): minden tab overflow-ba kerülhet kivéve az aktív + Overview

### 6. Technikai részletek

- Svelte 5 runes: `$state`, `$effect`, `$derived`
- `onMount`-ban ResizeObserver init
- `onDestroy`-ban cleanup
- A dropdown használjon `bind:this` referenciát a kattintás-ellenőrzéshez
- Az aktív tab jelölve van a dropdown-ban is (accent border/dot)

## Elfogadási kritériumok

1. [ ] 14 tab látható, de csak ami kifér → többi "More ▾"-ben
2. [ ] Ablak átméretezésre automatikusan frissül
3. [ ] Dropdown kattintásra nyílik/zárul
4. [ ] Külső kattintás bezárja
5. [ ] Aktív tab a dropdown-ban is jelölve
6. [ ] Mobil nézetben (≤768px) jól működik
7. [ ] `pnpm check` 0/0, `pnpm build` sikeres
8. [ ] A jelenlegi tab funkcionalitás változatlan

## UI Példa

```
┌──────────────────────────────────────────────────────┐
│ 🏠 Overview  🤖 Agents  ⏰ Crons  ⚡ Orch  ▾ More ▾  │
│                                            │ Audit   │
│                                            │ Trace   │
│                                            │ Noema   │
│                                            └─────────│
└──────────────────────────────────────────────────────┘
```
