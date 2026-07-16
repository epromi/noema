# PKG-015: Expandable Package Detail Rows

> Státusz: ✅ KÉSZ | Méret: S | Priorítás: P2
> Dependencia: PKG-001 (SvelteKit scaffold)

## Spec

**Mit**: Minden fejlesztési csomag sora a dashboardon lenyitható. Kattintásra megjelenik a csomag részletes leírása: mit csinál, milyen fájlokat érint, milyen fázisokból áll. A sorok mellett `▸` / `▾` chevron jelzi a nyitott/zárt állapotot.

**Scope**:
- `projects/noema/generate.cjs`: spec.md parse-olás, detail HTML generálás, soronként onclick
- `projects/noema/archive/v4.html`: CSS (`.pkg-detail`, `.pkg-row`), JS (`togglePkg()`)

## Fázisok

### F0 — Spec (~5 perc)
- [x] Igény definiálva (András: "minden development packages sor jó lenne ha lenyitható lenne")

### F1 — Adat (~15 perc)
- [x] `generate.cjs`: minden csomaghoz `dev/packages/<pkg-dir>/spec.md` beolvasása
- [x] Spec parse-olás: `**Mit**:` leírás, `**Scope**:` fájllista, `### F0-F5` fázisok
- [x] Detail HTML generálás: leírás + scope fájlok + fázisok (max 4, a többi "+N")

### F2 — UI (~10 perc)
- [x] CSS: `.pkg-row { cursor:pointer }` + hover effekt
- [x] CSS: `.pkg-detail { display:none }` — rejtett alapból
- [x] JS: `togglePkg(rowId)` — display toggle + `▸` ↔ `▾` animáció
- [x] `▶ Mehet` gomb: `event.stopPropagation()` hogy a gomb ne nyissa a sort

### F3 — Teszt (~5 perc)
- [x] Manuális teszt: 13 csomag mind lenyitható
- [x] Manuális teszt: ▶ Mehet gomb nem nyitja a sort (stopPropagation)
- [x] Dashboard regen: 96KB (spec adatokkal, 82KB-ról)

### F4 — Merge
- [x] Git commit: "🧠 feat: Expandable package detail rows (PKG-015)"

## Státusz

**Fázis**: ✅ F5 — KÉSZ (2026-07-05 14:52)
**Eredmény**: 13 csomag, mind lenyitható. Spec részletek: leírás + scope + fázisok. Dashboard 96KB.
