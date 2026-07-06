# PKG-029: Dev Job Floating Ablak — Collapse / Expand Toggle

**Státusz**: 📋 F0 | **Méret**: S | **Becslés**: 45m | **Függőség**: PKG-026

## Kérés

A dev job floating ablakra (PKG-026 `DevJobIndicator.svelte`) kerüljön egy gomb ami a panelt egy egysoros kompakt verzióra tudja zsugorítani és vissza nagyra nyitni.

## Specifikáció

### 1. Collapse Toggle Gomb

- Hely: a header sorban, a grip (⠿) mellé, balra tőle
- Ikon: `−` (becsukás, ha expanded) / `+` (kinyitás, ha collapsed)
- Tooltip: "Egysoros nézet" / "Részletes nézet"
- Animáció: nincs, de a gomb cserélődik az állapottal
- A gomb nem zavarhatja a grip húzás funkciót

### 2. Kompakt Állapot (Collapsed)

Amikor be van csukva, az ablak egyetlen sorra redukálódik:

```
 ⚙️  02:47  ·  3 queued  ·  🔄 audit-trail   −
```

Formátum:
- **⚙️ ikon** (fix)
- **Visszaszámláló** (MM:SS formátum, state-függő szín: idle=szürke, soon=sárga, active=zöld pulzáló, offline=piros)
- **·** elválasztó (halvány)
- **Sorban állók száma** ("N queued" vagy "üres")
- **·** elválasztó (csak ha van futó job)
- **Futó job neve** (ha van running, max 20 karakter, ellipszis ha hosszabb)
- **Collapse gomb** (jobb szélen, `−` ikon)

Megtartandó:
- Az állapotjelző keret színe (idle/soon/active) — keskenyebb, 2px→1px
- Drag működik kompakt állapotban is
- Pozíció localStorage mentés (ugyanaz a `dli-pos` kulcs)

Eltűnik:
- Header sor (⚙️ Dev Job cím)
- Külön sorok (Következő, Sorban áll, Fut)
- A nagy keret padding (12px → 6-8px)

### 3. Kibővített Állapot (Expanded)

Megegyezik a jelenlegi PKG-026 kinézettel, plusz a collapse gomb a header-ben.

### 4. Állapot Perzisztencia

- localStorage kulcs: `dli-collapsed` — érték: `"1"` (collapsed) vagy `"0"` (expanded)
- Alapértelmezett: expanded (`"0"`)
- A collapsed állapot túléli a reload-ot és a tab váltást

### 5. Stílus Részletek

**Kompakt sor**:
```css
.dji-collapsed {
  width: auto;           /* tartalomhoz igazodik */
  min-width: 200px;      /* min olvasható */
  max-width: 380px;      /* ne legyen túl széles */
  padding: 6px 10px;
  border-width: 1px;
  font-size: 0.78em;
  display: flex;
  align-items: center;
  gap: 6px;
}
```

**Toggle gomb**:
```css
.dji-toggle {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1em;
  line-height: 1;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
}
.dji-toggle:hover { color: var(--text); }
```

**Átmenet**: Nincs CSS transition (instant váltás), de a border-color state változás megmarad a meglévő transition-nel.

### 6. Edge Case-ek

- **Nincs futó job**: nincs "·" és futó job név a kompakt sorban
- **Nincs sorban álló**: "üres" szöveg
- **Offline**: a visszaszámláló helyett "offline" piros színnel
- **Lejárt/job azonnal**: "most" vagy 00:00 sárga színnel
- **Nagyon hosszú futó job név**: max 20 karakter + "…"

### 7. Módosítandó Fájlok

| Fájl | Művelet |
|------|---------|
| `src/lib/components/DevJobIndicator.svelte` | Collapse logika + toggle gomb + kompakt nézet |

### 8. Verifikáció

- [ ] Toggle gomb működik (expand → collapse → expand)
- [ ] Kompakt nézet egy soros, olvasható
- [ ] Drag működik kompakt állapotban is
- [ ] localStorage túléli a reload-ot
- [ ] Idle/soon/active/offline állapotok mind helyesek kompakt módban
- [ ] Nincs layout shift a váltáskor
- [ ] `pnpm check` hibátlan
