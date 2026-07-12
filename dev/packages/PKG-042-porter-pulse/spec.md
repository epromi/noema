# PKG-042: Porter Email Triage + Operational Pulse

**Státusz**: 📋 F0 | **Méret**: M | **Becslés**: 2h | **Függőség**: — (legacy, önálló)
**Target**: Legacy dashboard (`generate.cjs` + `archive/v4.html`)
**Review-Rigor Finding**: Overview tab nem "single pane of glass" — Porter adatok teljesen hiányoznak, 5 mp alatt áttekinthető agent státusz nincs.

## Kérés

Két új kártya az Overview tab-on:
1. **🫀 Operational Pulse** — 8 agent élő státusz pöttyös (zöld/sárga/piros) + detail, cron state-ből + Viktor live státusz
2. **📧 Porter Email Triage** — utolsó scan idő, új email count, kritikus alert-ek (H1, számla, 🚨), unread count age bracket-enként, számlák/kiszállítás

## Jelenlegi Probléma

1. Az Overview tab: csak System gauges + Weather + Critical Alerts + Projects Summary
2. **Porter email triage adatok egyáltalán nincsenek** a dashboard-on — a `memory/state/porter-latest-triage.md` feldolgozatlan
3. Nincs "single pane of glass" ahol 5 mp alatt látszik az összes agent operatív állapota
4. A Critical Alerts persistens, de nem mutatja a rendszer valós "pulzusát"

## Specifikáció

### 1. generate.cjs — Porter Adatkinyerés (~30 perc)

**Forrás**: `memory/state/porter-latest-triage.md`

**Kinyert adatok**:
```javascript
porter = {
  lastScan: "2026-07-12 16:09",    // # Porter Triage — dátum
  newCount: 2,                       // Summary → "X new emails"
  alerts: [                          // ## New Emails → 🚨/📰 alert-ek
    { header: "...", detail: "...", severity: "critical|warning" }
  ],
  unreadLess7d: 5,                   // ## Persistent UNREAD → <7d
  unread7to30d: 5,                   // 7-30d
  unread30to60d: 0,                  // 30-60d
  totalUnread: 10,                   // összeg
  bills: "none",                     // ## Delivery/Shipping
  deliveries: "none",
  status: "ok",                      // ok/error
  nextScan: "17:09"                  // lastScan + 1 óra
}
```

**Regex-ek**:
- Dátum: `/Porter Triage\s*[^0-9]*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/`
- Új email count: `/Summary[\s\S]*?(\d+)\s+new\s+emails?/i`
- Alert blokkok: `## New Emails` szekcióból `###` blokkonként, ha tartalmaz 🚨/CRITICAL/bounty/💳
- Persistent unread: `## Persistent UNREAD` szekcióból `<7d`, `7-30d`, `30-60d` pattern-ek
- Bills/deliveries: `## Delivery/Shipping` szekcióból

**Hibakezelés**: ha a file nem olvasható → `status: "error"`, minden mező default

### 2. generate.cjs — Agent Operational Pulse (~20 perc)

**Adat**: 8 agent (`agentDefs` alapján) live státusszal

```javascript
pulse = agentDefs.map(a => {
  // Cron-alapú agent-ek (Porter, Edwin, Otto): cronGrid-ből OK/Error/No recent run
  // Otto: timeline[0] státuszból (ok/warn → green/yellow)
  // Viktor: viktorData-ból (active/pending/circuit)
  // Többiek: cronGrid ha van, egyébként agent staleness-ből
  return { id, name, emoji, status: "green|yellow|red", detail: "...", schedule }
})
```

**Részletes mapping**:

| Agent | Státusz forrás | Detail |
|-------|---------------|--------|
| Otto | timeline[0].status (warn=yellow, ok=green) | timeline[0].time (dátum) |
| Viktor | viktorData.circuit (TRIPPED=red), .active > 0 (green), else yellow | activeLabel vagy "Idle" |
| Scout | cronGrid (ha van) | last spawn |
| Porter | cronGrid "Porter Hourly Triage" | last run time |
| Edwin | cronGrid "Edwin CCM (7-23)" | last run time |
| Hugo | cronGrid (ha van) | — |
| Cortex | cronGrid (ha van) | — |
| Alfred | mindig green (fő session) | — |

**Cron név mapping** (pulse kódban):
```javascript
const cronAgentMap = {
  porter: 'Porter Hourly Triage',
  edwin: 'Edwin CCM (7-23)',
  otto: 'Nightly Staff Review (Compile)'
};
```

### 3. archive/v4.html — HTML Kártyák (~15 perc)

**Hely**: Overview tab (`<section class="tab-content active" id="tab-overview">`), a System/Weather grid után, a Critical Alerts elé.

**Operational Pulse kártya**:
```html
<div class="card wide" style="margin-top:14px"><h3>🫀 Operational Pulse</h3>
  <div id="op-pulse" style="display:flex;gap:20px;flex-wrap:wrap;
    font-size:0.90em;align-items:center">Loading…</div>
</div>
```

**Porter Email Triage kártya**:
```html
<div class="card wide" style="margin-top:14px"><h3>📧 Email Triage</h3>
  <div id="porter-triage" style="font-size:0.90em;line-height:1.7">Loading…</div>
</div>
```

### 4. archive/v4.html — JS Rendering (~25 perc)

**Operational Pulse rendering**:
- Minden agent: emoji + név + színes pötty (🟢/🟡/🔴) + detail szöveg
- `flex-wrap: wrap` layout, min-width 100px per item
- Üres pulse esetén "No agent data"

**Porter Email Triage rendering**:
- Fejléc sor: státusz pötty + utolsó scan idő + következő scan + napi email count
- Alert lista: 🚨/📰 ikon + header + detail, severity szerint
- Unread summary: <7d, 7-30d, 30-60d countok, összesen
- Ha `totalUnread === 0`: "✅ Nincs feldolgozatlan email" (zöld)
- Bills/deliveries: csak ha van találat (nem "none")

### 5. Új Overview Layout

**Előtte**:
```
Metrics bar → System/Weather grid → Critical Alerts → Projects/Stalled
```

**Utána**:
```
Metrics bar → System/Weather grid → 🫀 Operational Pulse → 📧 Email Triage → 🚨 Critical Alerts → Projects/Stalled
```

## Módosítandó Fájlok

| Fájl | Művelet | Scope |
|------|---------|-------|
| `generate.cjs` | Porter parser + Pulse kalkuláció hozzáadása | ~80 sor beszúrás |
| `archive/v4.html` | HTML kártyák + JS rendering | ~90 sor beszúrás |

**Out of scope**:
- SvelteKit Overview.svelte módosítása (külön PKG, amikor a SvelteKit eléri a legacy paritást)
- Porter relay endpoint (már van a v4 generate.cjs statikus adatkinyerés)
- Action gombok a Porter kártyán (későbbi PKG)

## Plan

### F0 — Spec (~20 perc)
- [x] spec.md megírva
- [ ] plan.md megírva
- [ ] phases.md becslésekkel
- [ ] Scope ellenőrzés: max 2 fájl, <200 sor

### F1 — generate.cjs Adatkinyerés (~30 perc)
- [ ] Porter parser függvény (read porter-latest-triage.md → porter objektum)
- [ ] Agent Operational Pulse kalkuláció (agentDefs + cronGrid + timeline + viktorData)
- [ ] porter + pulse hozzáadása a JSON payload-hoz
- [ ] `node generate.cjs` hiba nélkül fut
- [ ] dashboard.html-ben `"porter":` és `"pulse":` jelen van

### F2 — archive/v4.html Template (~30 perc)
- [ ] HTML: Operational Pulse + Porter Triage kártyák az Overview tab-on
- [ ] JS: Operational Pulse rendering (D.pulse → agent pöttyök)
- [ ] JS: Porter Triage rendering (D.porter → scan idő, alert-ek, unread count)
- [ ] `node generate.cjs` újra → dashboard.html-ben mindkét szekció renderelt

### F3 — Integráció + Teszt (~30 perc)
- [ ] Manuális ellenőrzés — dashboard.html böngészőben
- [ ] Porter adatok verifikálása: lastScan, newCount, alerts, unread countok
- [ ] Pulse adatok verifikálása: 8 agent, helyes státusz + detail
- [ ] Edge case: porter-latest-triage.md hiányzik → "error" státusz, minden mező default
- [ ] Edge case: cronGrid nem talál agent nevet → fallback agent staleness-ből

### F4 — Merge (~10 perc)
- [ ] Git commit
- [ ] Push
- [ ] INDEX.md frissítve → PKG-042 ✅ F5

## Verifikáció

- [ ] `grep -c "Operational Pulse\|Email Triage\|op-pulse\|porter-triage" dashboard.html` → 13+ találat
- [ ] `grep '"porter":{' dashboard.html` → valid JSON, lastScan, newCount, unreadLess7d, totalUnread
- [ ] `grep '"pulse":[' dashboard.html` → 8 agent, status green/yellow/red
- [ ] Böngésző: Operational Pulse kártya látható, 8 agent pöttyel
- [ ] Böngésző: Porter Email Triage kártya látható, scan idővel + unread countokkal
- [ ] `node generate.cjs` exit code 0, nincs stderr
- [ ] Porter file hiányzik → "Porter triage data not available" (nem crash)

## Log

| Idő | Fázis | Mi történt |
|-----|-------|------------|
| 2026-07-12 17:00 | F0 | Spec megírva — Alfred, review-rigor alapján |
