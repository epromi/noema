# PKG-031: Development Packages — Áttekinthetőség ⭐

**Státusz**: 📋 F0 | **Méret**: M | **Becslés**: 2h | **Függőség**: PKG-021, PKG-025

## Kérés

A Development Packages tab átláthatóbb: kész csomagok külön összecsukott listába + egyéb áttekinthetőségi fejlesztések.

## Jelenlegi Probléma

A `Noema.svelte` egyetlen lapos listát renderel minden PKG-ból. A 30+ csomag között:
- A kész (✅ F5) csomagok keverednek az aktívakkal
- Nincs keresés, nincs szűrés
- Nincs progress visszajelzés
- Nincs vizuális csoportosítás

## Specifikáció

### 1. Fázis Alapú Csoportosítás (Collapsible Sections)

A csomagok három szekcióba rendezve:

```
📋 Specifikáció Kész (N)     ← nyitva
  PKG-008  Cron Health Timeline
  PKG-011  Session Health Scoring
  ...

🔨 Fejlesztés Alatt (M)      ← nyitva
  PKG-027  Nightly Dash Research
  ...

✅ Kész (X)                   ← ALAPÉRTELMEZETTEN ZÁRVA
  PKG-001  SvelteKit Scaffold
  PKG-013  Provider Abstraction
  ...
```

**Szekció fejléc**:
- Cím + darabszám (pl. "✅ Kész (17)")
- `▸` / `▾` chevron a nyitás/zárás jelzésére
- Klikk a fejlécre → toggle collapse
- Done szekció **alapértelmezésben csukva**

**Csoportosítási logika**:
```typescript
function groupPackages(pkgs: DevPackageEntry[]) {
  return {
    spec: pkgs.filter(p => p.phase.match(/F0|📋/)),   // 📋 F0
    active: pkgs.filter(p => p.phase.match(/F[1-4]|🔨|⏸/)), // 🔨 F1-F4
    done: pkgs.filter(p => p.done || p.phase.includes('F5')), // ✅ F5
  };
}
```

### 2. Keresés / Szűrés

**Kereső mező** a lista tetején:

```
┌─────────────────────────────┐
│ 🔍 Keresés...               │
└─────────────────────────────┘
```

- Valós idejű, case-insensitive szűrés
- Szűr: PKG ID (pl. "029"), név (pl. "collapse"), fázis (pl. "F0")
- Üres mező = minden látszik
- A szekciók automatikusan nyitnak ha a szűrés találatot ad bennük
- Ha egy szekcióban nincs találat → szekció fejléc eltűnik (vagy "0 találat")

### 3. Progress Bar + Stats

A kereső felett:

```
📊 19/30 kész (63%)  ████████████████░░░░░░░░░░
📋 7 spec  🔨 2 aktív  ✅ 19 kész
```

- Progress bar: zöld (done) / kék (active) / szürke (spec) / üres
- Számok élőben frissülnek
- Vizuális, de nem tolakodó

### 4. Szekció Perzisztencia

- localStorage kulcsok: `pkg-collapsed-done`, `pkg-collapsed-spec`, `pkg-collapsed-active`
- Reload után a felhasználó által beállított nyitott/zárt állapotok megmaradnak

### 5. Kompakt Nézet Toggle (Opcionális)

Egy toggle gomb a progress bar mellett: `📋` / `📜`

**Kompakt módban** a sorok rövidebbek:
```
PKG-001  SvelteKit Scaffold  ✅
PKG-013  Provider Abs...     ✅
```

- Csak ID + név (max 30 karakter) + fázis ikon
- Nincs ▶ Mehet / 📋 Log gomb (kattints a sorra a részletes nézethez, vagy a toggle visszakapcsol)
- Sűrűbb spacing (4px padding vs 8px)

### 6. Edge Case-ek

- **Üres szekció**: ha minden kész → a spec és active szekció "nincs aktív csomag" üzenettel jelenik meg
- **Túl hosszú név**: kompakt módban ellipszis, normál módban tördelés
- **⏸️ Blokkolt csomagok**: az active szekcióban jelennek meg, narancs színnel
- **Nagyon sok kész csomag**: a done szekció csukva indul → nem zavar

### 7. Módosítandó Fájlok

| Fájl | Művelet |
|------|---------|
| `src/lib/components/tabs/Noema.svelte` | Teljes átírás: group logic + search + progress bar |
| `src/lib/components/shared/DevPackageRow.svelte` | Kompakt mód támogatás (opcionális `compact` prop) |

### 8. Verifikáció

- [ ] Három szekció jól csoportosít (spec/active/done)
- [ ] Done szekció alapértelmezetten csukva
- [ ] Chevron toggle működik minden szekciónál
- [ ] Keresés valós időben szűr, case-insensitive
- [ ] Keresés találat esetén a szekciók automatikusan nyitnak
- [ ] Progress bar számai pontosak
- [ ] localStorage túléli a reload-ot
- [ ] Kompakt mód toggle működik
- [ ] Nincs layout shift váltáskor
- [ ] `pnpm check` hibátlan


## 🎯 Mit

_Placeholder — to be filled._


## 📐 Scope

_Placeholder — to be filled._


## Mit érint

_Placeholder — to be filled._


## Mit NEM érint

_Placeholder — to be filled._


## Fázisok

_Placeholder — to be filled._


## ✅ Acceptance Criteria

_Placeholder — to be filled._
