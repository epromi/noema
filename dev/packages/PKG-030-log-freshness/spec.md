# PKG-030: Log Menu Frissesség + Fordított Időrend

**Státusz**: 📋 F0 | **Méret**: M | **Becslés**: 1.5h | **Függőség**: PKG-014, PKG-016

## Kérés

A log menu mindig friss logot mutasson (auto-refresh) és a legfrissebb bejegyzés legyen felül rendezésileg (reverse chronological order).

## Jelenlegi Probléma

1. **`LogPanel.svelte`** (dev-loop log panel): adat egyszer betölt, nincs polling. Panel nyitva maradása alatt a Cursor által írt új sorok nem jelennek meg.
2. **`LogsViewer.svelte`** (rendszer log tab): adat egyszer betölt, nincs polling. A sorok a fájlbeli sorrendben jelennek meg (legrégebbi felül).
3. A PKG-018 csak a v4 HTML dashboard-ra készült — a SvelteKit komponensek érintetlenek.

## Specifikáció

### 1. LogPanel.svelte — Auto-Refresh (Dev-Loop Log)

**Polling**:
- Nyitott panel esetén 5 mp-enként `getDevLoopLog(pkgId)` újrahívása
- Csak akkor frissít DOM-ot ha a tartalom valóban változott (content hash összehasonlítás)
- Poller indítás: panel megnyitásakor (`open` prop `true`-ra vált)
- Poller leállítás: panel bezárásakor (`open` `false`-ra vált)
- OnDestroy cleanup — ha a komponens unmount-olódik, a timer törlődik

**Scroll viselkedés**:
- Ha a scroll alul van (utolsó 50px-en belül) → auto-scroll az új tartalom aljára
- Ha a felhasználó feljebb görgetett → NE mozduljon (ne zavarja az olvasást)
- Panel első nyitásakor → scroll a legfrissebb sorhoz (alulra ha normál, tetejére ha fordított)

### 2. LogPanel.svelte — Fordított Időrend Toggle

**Toggle gomb**: `↓` / `↑` ikon a panel jobb felső sarkában
- `↓` = normál (legrégebbi felül, legújabb alul) — alapértelmezett
- `↑` = fordított (legújabb felül, legrégebbi alul)

**Implementáció**: a `content` string sorainak megfordítása megjelenítés előtt
```typescript
const displayContent = $derived(
  reversed ? content.split('\n').reverse().join('\n') : content
);
```

**Perzisztencia**: localStorage `log-reversed` kulcs (`"1"` / `"0"`)

### 3. LogsViewer.svelte — Auto-Refresh (Rendszer Logok)

**Polling**: 10 mp-enként `getLogs()` újrahívása (gyakrabban mint a collector 60s ciklusa)

**Smart frissítés**:
- Megtartja az aktív filter-t (all/errors/warnings) a refresh alatt
- Viewport scroll pozíció megőrzése (ne ugorjon)
- Ha új sorok érkeztek → frissíti a listát, de a régiókban lévő sorok DOM-ja nem cserélődik (csak append/prepend)

### 4. LogsViewer.svelte — Fordított Időrend

**Alapértelmezett**: legújabb felül (a `logEntries` tömb `.reverse()`-elése)

A `FilterBar`-ba kerül egy új toggle gomb: `↓/↑` — ugyanaz a localStorage kulcs (`log-reversed`).

**Jelenlegi kód**:
```svelte
{#each filteredEntries as entry (entry.lineNum + entry.raw)}
```
**Új kód**:
```svelte
{#each displayEntries as entry (entry.lineNum + entry.raw)}
```
Ahol `displayEntries = reversed ? [...filteredEntries].reverse() : filteredEntries`

### 5. Perzisztencia Összefoglaló

| Kulcs | Értékek | Alapértelmezett |
|-------|---------|-----------------|
| `log-reversed` | `"0"` / `"1"` | `"0"` (normál) |

### 6. Edge Case-ek

- **Üres log**: "No log data" placeholder, polling folytatódik (lehet később érkezik tartalom)
- **Hálózati hiba**: hiba placeholder, polling folytatódik (next poll újrapróbálja)
- **Nagyon gyors változás** (< 1s): a content hash ellenőrzés miatt nem lesz felesleges DOM update
- **Panel unmount**: minden timer törlődik (`onDestroy`)

### 7. Módosítandó Fájlok

| Fájl | Művelet |
|------|---------|
| `src/lib/components/shared/LogPanel.svelte` | Polling + reverse toggle + scroll logic |
| `src/lib/components/tabs/LogsViewer.svelte` | Polling + reverse order + filter preservation |

### 8. Verifikáció

#### LogPanel
- [ ] Panel nyitva → 5 mp-enként frissül (Network tab-ban látszik)
- [ ] Panel bezár → poller leáll (nincs további fetch)
- [ ] Újranyit → poller újraindul
- [ ] ↓/↑ toggle működik, localStorage túléli a reload-ot
- [ ] Nincs memória leak (többszöri nyitás-zárás után is max 1 timer)

#### LogsViewer
- [ ] Tab betölt → logok 10 mp-enként frissülnek
- [ ] Filter (all/errors/warnings) megmarad refresh alatt
- [ ] Új sorok megjelennek anélkül hogy a régiók eltűnnének
- [ ] ↓/↑ toggle működik
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
