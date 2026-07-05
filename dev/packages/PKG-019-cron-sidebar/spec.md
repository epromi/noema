# PKG-019: Cron Sidebar — Mindig látható oldalsáv

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-017 (Cron Timeline) ✅ | **Spec date:** 2026-07-05

## 🎯 Mit

A cron pipeline timeline **fix oldalsávban**, mindig látható — bármelyik tab-on vagy. A dashboard layout átalakítása: fő tartalom + jobb oldali sidebar.

### F1: Layout átalakítás — sidebar hozzáadása

A dashboard kétoszlopos layout-ra vált:
- **Bal oldal (flex: 1)**: a jelenlegi tab-ok és tartalmuk
- **Jobb oldal (280px fix)**: Cron Sidebar — mindig látható, sticky

```
┌─────────────────────────────────────────┬──────────────┐
│  🧠 Noema                               │ ⏰ Cronok    │
│  [Tab1] [Tab2] [Tab3] ...               │              │
├─────────────────────────────────────────┤  16:57 ════  │
│                                          │              │
│  [Kiválasztott tab tartalma]            │  17:00 📋 FS  │
│                                          │     in 3m    │
│                                          │  18:00 📋 FS  │
│                                          │     in 1h    │
│                                          │  20:00 📚 HRP │
│                                          │     in 3h    │
│                                          │  21:00 🧩 KG  │
│                                          │     in 4h    │
│                                          │  22:00 💡 BT  │
│                                          │     in 5h    │
│                                          │  23:05 💾 BK  │
│                                          │     in 6h    │
│                                          │              │
│                                          │  01:00 🔍 HI │
│                                          │    in 8h     │
│                                          │              │
└─────────────────────────────────────────┴──────────────┘
```

### F2: Sidebar tartalom — kompakt cron lista

- **Fejléc**: "⏰ Cronok" + mostani idő (frissül)
- **NOW vonal**: piros pulzáló indikátor
- **Következő 12-24 óra cron-jai**, időrendben
- **Minden sor**: időpont, emoji, rövid név, countdown ("in 3m", "in 1h 15m")
- **Színkód**: OK (zöld bal border), Error (piros), Warning (sárga)
- **Múltbeli**: halványított
- **Épp következő**: kiemelt (kék glow)
- **30 mp-enként auto-frissül**
- **Hover**: teljes név tooltip + leírás

### F3: Reszponzív viselkedés

- **Asztali (>900px)**: sidebar fix 280px, normál nézet
- **Tablet (600-900px)**: sidebar 220px, kisebb betűméret
- **Mobil (<600px)**: sidebar eltűnik, helyette egy "⏰ Cronok" tab jelenik meg

### F4: Sidebar toggle

- "◀" / "▶" gomb a sidebar tetején — összecsukás/kinyitás
- Összecsukott állapot: csak egy vékony csík (40px) az ikonokkal
- Kinyitott állapot: teljes 280px sidebar
- Állapot localStorage-ban mentve

## 📐 Scope

### Mit érint
- `archive/v4.html` — CSS: layout átalakítás (.app-layout, .main-content, .cron-sidebar), JS: cronSidebarRender(), sidebarToggle()
- `generate.cjs` — cronGrid adat sidebar-ba is (már megvan, csak új embed hely)

### Mit NEM érint
- `relay.cjs` — semmi (cron adat a dashboard JSON-ból jön, nincs új endpoint)
- `src/lib/core/` — semmi (csak dashboard template)
- `scripts/dev-loop.sh` — semmi

### Fázisok (max 5 fájl per fázis)

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | CSS — `.app-layout`, `.main-content`, `.cron-sidebar`, reszponzív breakpoint-ok | `archive/v4.html` CSS |
| **Phase 2** | HTML — layout struktúra átalakítás, sidebar container | `archive/v4.html` HTML |
| **Phase 3** | JS — `renderCronSidebar()`: kompakt cron lista, countdown, NOW, auto-refresh | `archive/v4.html` JS |
| **Phase 4** | JS — `toggleSidebar()`: collapse/expand, localStorage | `archive/v4.html` JS |
| **Phase 5** | Integráció — tab-ok sidebar mellé rendezése, reszponzív teszt | `archive/v4.html` |
| **Phase 6** | Teszt: sidebar frissül, toggle működik, reszponzív breakpoint-ok, localStorage persist | Manuális böngésző |

## 🎨 Design Részletek

### Sidebar CSS
```css
.app-layout { display: flex; min-height: 100vh; }
.main-content { flex: 1; min-width: 0; }
.cron-sidebar { width: 280px; min-width: 280px; position: sticky; top: 0; height: 100vh; overflow-y: auto; background: var(--card); border-left: 1px solid var(--border); }
.cron-sidebar.collapsed { width: 40px; min-width: 40px; }
.cron-sidebar .cr-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-left: 2px solid transparent; font-size: 0.82em; }
.cron-sidebar .cr-item.now-marker { border-top: 2px solid var(--red); border-bottom: 2px solid var(--red); background: rgba(255,80,60,0.08); }
```

### Sidebar cron item
```
┌──────────────────────────────────┐
│ 17:00  📋  Daytime Fact Sync     │ ← border-left: green
│             in 3m                │ ← countdown
│ 18:00  📋  Daytime Fact Sync     │
│             in 1h 3m             │
│ ─── NOW 16:57 ───               │ ← piros pulzáló
│ 20:00  📚  Hugo Repo Prep        │
│             in 3h 3m             │
│ 21:00  🧩  KG Extractor          │
│             in 4h 3m             │
└──────────────────────────────────┘
```

### Toggle gomb
```
┌──────────────────────────────────┐
│ [◀] ⏰ Cronok        16:57:03   │ ← fejléc
│ ...                              │
```
Összecsukva:
```
┌─┬────────────────────────────────┐
│▶│                                │
│ │                                │
│ │                                │
│📋│                                │
│📚│                                │
│🧩│                                │
│💡│                                │
└─┴────────────────────────────────┘
```

## ✅ Acceptance Criteria

1. Sidebar látható minden tab-on, fix pozícióban
2. NOW vonal mindig az aktuális időnél, 30 mp-enként frissül
3. Minden cron sor mutatja: idő + emoji + név + countdown
4. Sidebar összecsukható/nyitható, állapot localStorage-ban
5. Reszponzív: asztali (280px), tablet (220px), mobil (tab-ba kerül)
6. A régi orchestrator tab cron pipeline megmarad (ott nagyobb, részletesebb nézet)
7. `bash -n` ✅, `pnpm check` ✅
