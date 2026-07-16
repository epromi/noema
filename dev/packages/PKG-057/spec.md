# PKG-057: Legacy Dashboard Cleanup — dashboard.html + generate.cjs + CI

**Státusz**: 📋 F0 (specifikáció kész)  
**Méret**: S  
**Becsült idő**: 15m  
**Függőség**: —  
**Dátum**: 2026-07-16

## Probléma

A `dashboard.html` a régi statikus HTML dashboard, amit a `generate.cjs` generált. A SvelteKit migráció (PKG-021) óta a Noema a 8080-as porton fut, a statikus HTML dead code:

- **Senki nem használja** — a SvelteKit a primary
- **Zajt generál** — minden PKG után regen (commit, merge conflict, diff)
- **CI-t tör** — `validate-v1` job `archive/v4.html`-t keres ami nem létezik
- **Felesleges CPU** — `action-processor.cjs` minden implementáció után futtatja a `regenDashboard()`-ot

## Megoldás

### 1. dashboard.html — kivezetés

```bash
# .gitignore — hozzáadás
echo "dashboard.html" >> .gitignore

# Git tracking megszüntetése
git rm --cached dashboard.html
```

### 2. action-processor.cjs — regenDashboard() eltávolítás

```diff
- function regenDashboard() { ... }
- regenDashboard();
```

### 3. CI — validate-v1 job frissítés/törlés

A `.github/workflows/ci.yml` `validate-v1` step-je `archive/v4.html`-t grep-el ami nem létezik. Teljes v1 validációs step törlése, mivel a v1 (statikus dashboard) már nem él.

### 4. data/ könyvtár — gitignore

```bash
echo "data/" >> .gitignore
```

A `data/dashboard-cache.json` SSR cache, nem tartozik verziókövetésbe.

## Érintett fájlok

| Fájl | Művelet |
|------|---------|
| `.gitignore` | `dashboard.html` + `data/` hozzáadása |
| `dashboard.html` | `git rm --cached` (törlés a git-ből, nem a lemezről) |
| `action-processor.cjs` | `regenDashboard()` függvény + hívás törlése |
| `.github/workflows/ci.yml` | `validate-v1` step törlése |

## Teszt

1. `pnpm check` — 0e 0w (nem érint SvelteKit fájlokat)
2. `git status` — `dashboard.html` már nem staged, nem tracked
3. `data/` könyvtár nincs a git tracking-ben
4. CI — `validate-v1` nem fut le (sikeres skip)
5. Processor — következő PKG implementáció után nincs `Dashboard regen` log sor


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
