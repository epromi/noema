# PKG-017: Cron Timeline Vizuális + Processor Timer

**Size:** M | **Effort:** 1-2h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-013 (Provider) ✅ | **Spec date:** 2026-07-05

## 🎯 Mit

Két dashboard feature egy csomagban:

### F1: ⏰ Cron Timeline Vizuális (24h)

Az orchestrator tabon a jelenlegi táblázatos cron pipeline helyett **függőleges vizuális timeline**:

- **24 órás skála**, fentről lefelé kronologikus sorrendben
- **NOW indikátor** — jól látható, piros pulzáló vonal az aktuális időnél
- **Minden cron egy sor**, mutatva: időpont, emoji/ikon, név, következő futás countdown ("in 43m", "in 2h 15m")
- **Státusz színkód**: zöld (OK) / sárga (warning) / piros (error) bal oldali border
- **Auto-scroll NOW gomb** — egy kattintással a jelenlegi időhöz ugrik
- **Section headerek**: ÉJSZAKA / REGGEL / NAPPAL / ESTE
- **Múltbeli crons** halványítva (opacity 0.45), **jövőbeliek** normál
- **Next-to-run cron** kiemelve (kék border, subtle glow)
- **Hover effekt** a sorokon
- **5 mp-enként auto-frissül** (csak a countdown-ok)
- **Reszponzív** mobil nézetben is

### F2: ⏱️ Processor Timer

A "📦 Development Packages" kártya **felett** egy jól látható státuszsáv:

- **Épp futó Cursor** → "🖊️ Cursor: PKG-XXX — folyamatban…" (kék)
- **Queue-ban vár** → "⚡ Processor: N elem a sorban — most indul" (zöld)
- **Idle** → "⏳ Processor: idle — következő ellenőrzés Xs múlva" (szürke)
- **Offline** → "❓ Processor: timer offline" (piros)
- 5 mp-enként poll-olja a relay `/next-trigger` és `/running` endpointjait
- A relay-ben új `/next-trigger` endpoint (LastTriggerUSec + OnUnitInactiveSec alapján)

### F3: Relay `/next-trigger` endpoint (F2-höz szükséges)

A `relay.cjs`-ben új GET endpoint ami visszaadja:
- `next`: a processor következő trigger ideje (ISO timestamp)
- `nextMs`: epoch ms (könnyű JS diff számoláshoz)
- `queue`: hány elem van a sorban (queued + pending)
- `lastTrigger`: utolsó trigger ideje
- `now`: szerver aktuális ideje

## 📐 Scope

### Mit érint
- `archive/v4.html` — Új CSS komponensek (.cron-timeline-v, .ct-*) + JS renderelés (cronTimelineRender) + processorTimer poll
- `relay.cjs` — `/next-trigger` endpoint (ha még nincs)
- `generate.cjs` — F2 data injection (ha kell)

### Mit NEM érint
- `src/lib/core/` — semmi (csak dashboard template + relay infra)
- `scripts/dev-loop.sh` — semmi
- `src/lib/components/` — semmi (még nincs SvelteKit frontend)

### Fázisok (max 5 fájl per fázis)

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | CSS — .cron-timeline-v, .ct-*, .ct-now, pulse animáció | `archive/v4.html` CSS section |
| **Phase 2** | JS — `renderCronTimeline()`: parse schedule, compute next-run, NOW marker, section headers | `archive/v4.html` JS section |
| **Phase 3** | JS — `processorTimer()`: poll `/next-trigger` + `/running`, státuszsáv render | `archive/v4.html` JS section |
| **Phase 4** | Relay `/next-trigger` endpoint (ha még nincs) | `relay.cjs` |
| **Phase 5** | HTML struktúra: timeline container, timer bar, legend, scroll gomb | `archive/v4.html` HTML section |
| **Phase 6** | Teszt: cron list parse edge cases, timer polling, NOW marker pozíció | `generate.cjs` update + manuális teszt |

## 🎨 Design Részletek

### Timeline vizuális specifikáció
```
┌─────────────────────────────────────────────────────┐
│  ⏰ Cron Timeline (24h)                  [📍 NOW]  │
│  ● OK  ● Error  ● Warning      🔴 NOW vonal        │
├─────────────────────────────────────────────────────┤
│  00:00 │·····································│      │
│  01:00 │ 🧠 01:30  Autoresearch Orch.    in 8h 15m │ ← status-ok (zöld)
│  01:30 │ 🔍 01:30  Nightly Hacker Intel   in 8h 15m │
│  02:00 │ ⚡ 02:00  Autoexecutor A          in 8h 45m │
│        │                                              │
│        ├── 🌅 REGGEL (06:00–08:00) ───── 4 crons ──│  │
│        │                                              │
│  06:00 │ 🧠 06:30  Cortex Optimizer       in 16h 5m  │ ← past (halvány)
│  07:00 │ ⚡ 07:00  Autoexecutor B          in 16h 35m │ ← past
│  07:05 │ 💾 07:05  Morning Backup          in 16h 40m │ ← past
│        │ 👁️ Edwin CCM (7-23)              hourly     │ ← future
│        │ 🚪 Porter (6-23)                 hourly     │ ← future
│        │                                              │
│  16:32 ├── ▐▐▐▐ NOW 16:32:05 ▐▐▐▐ ─────────────│   │ ← piros pulzáló
│        │                                              │
│  17:00 │ 📋 Daytime Fact Sync            in 28m       │ ← next-up (kék)
│  18:00 │ 📋 Daytime Fact Sync            in 1h 28m    │
│  20:00 │ 📚 Hugo Repo Prep               in 3h 28m    │
│  21:00 │ 🧩 KG Extractor                 in 4h 28m    │
│  22:00 │ 💡 Brainstorming Trigger        in 5h 28m    │
│  23:05 │ 💾 Nightly Backup               in 6h 33m    │
│  24:00 │········································│      │
└─────────────────────────────────────────────────────┘
```

### Processor Timer specifikáció
```
┌─────────────────────────────────────────────────────┐
│ ⏳ Processor: várakozik         következő: 1m 43s   │ ← szürke (idle)
│ vagy                                                  │
│ ⚡ Processor: 1 a sorban             most indul      │ ← zöld (queue)
│ vagy                                                  │
│ 🖊️ Cursor: PKG-017               folyamatban…       │ ← kék (fut)
└─────────────────────────────────────────────────────┘
```

### Next-run számítási logika (kliens oldali JS)

```javascript
function computeNextRun(sched) {
  // "06-23 hourly" → ha currentHour 6-23 közt: következő óra :00, különben holnap 06:00
  // "01:30 daily" → ha 01:30 > now: ma 01:30, különben holnap 01:30
  // "12,15,18,21" → következő időpont ami > now
  // "every 2h" → kiszámolni az utolsó futásból
  // "15:30 Tue" → következő kedd 15:30
  // "auto" → null (nincs fix idő)
  // "03:00 + 03:35" → két időpont, a következő ami > now
}
```

### Színpaletta
- OK border: `var(--green)` = #4caf50
- Error border: `var(--red)` = #f44336
- Warning border: `var(--yellow)` = #ff9800
- NOW marker: `var(--red)` háttér gradient, pulzáló animáció
- Next-up: kék left border `var(--blue)`
- Past rows: opacity 0.45
- Hover: `rgba(255,255,255,0.04)` háttér

## ✅ Acceptance Criteria

1. A cron timeline mutatja az ÖSSZES aktív cron job-ot kronologikus sorrendben
2. A NOW vonal pontosan az aktuális időnél van és 5 mp-enként frissül
3. Minden cron mellet látszik a következő futásig hátralévő idő
4. A "📍 NOW" gomb a jelenlegi időhöz scroll-ol
5. A processor timer mutatja hogy fut-e a Cursor, van-e queue, vagy idle
6. Reszponzív: mobil nézetben is olvasható
7. A régi cron pipeline táblázat eltávolítva (helyette az új timeline)
8. `bash -n` ✅, `pnpm check` ✅, `node -c relay.cjs` ✅
9. Minden cron schedule formátum helyesen parse-olva (ld. `generate.cjs` cronDetail)
