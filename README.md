# Noema 🧠 — System Intelligence Dashboard

> *noēma* (görög: νόημα) — észlelet, gondolat, értelem. Ahogyan a rendszer önmagát észleli.

## Küldetés

A Noema az Alfred agent-ecosystem központi idegrendszere. Valós idejű dashboard, cron orchestráció, és éjszakai öndiagnosztika. Minden adat ide fut be, innen indul minden riasztás, és itt születnek a döntési pontok.

## Architektúra

```
projects/noema/
├── README.md              ← Ez a fájl
├── CHANGELOG.md            ← Változások követése
├── generate.js             ← Fő generátor (N API hívás → 1 HTML output)
├── dashboard.html          ← Generált kimenet (~66KB, 2 óránként frissül)
├── relay.js                ← Böngésző akciók → fájlba írás (HTTP :18998)
├── action-processor.js     ← Fájl → Gateway API → Alfred session (10p timer)
├── qa-prompt.md            ← Éjszakai QA cron prompt (03:00)
├── research-prompt.md      ← Product research cron prompt (01:00)
├── CONTRIBUTING.md         ← Fejlesztési kézikönyv
├── architecture.md         ← Részletes technikai architektúra
├── roadmap.md              ← Fejlesztési útiterv prioritásokkal
├── archive/                ← Régi verziók, legacy scriptek
└── research/               ← Kutatási anyagok
    ├── competitive-landscape.md  ← Versenytárs elemzés
    └── cursor-integration.md     ← Cursor agent workflow
    ├── v4.html             ← Dashboard v4 (átmeneti)
    ├── generate.sh         ← Eredeti bash generátor
    ├── generate-v4.sh      ← v4 shell wrapper
    ├── index.html          ← Redirect
    └── README-v1.md        ← Eredeti README
```

## Adatfolyam

```
 22+ cron job ──┐
 5+ agent      ──┤
 state.json    ──┤
 API (H1, GCal)──┤
 action-queue  ──┤
 bills, OL      ──┤
                   ▼
           ┌──────────────┐    2 óránként     ┌─────────────────┐
           │  generate.js  │ ─────────────────→ │ dashboard.html   │
           │  (~34KB JS)   │                    │  (~66KB HTML)    │
           └──────────────┘                    └────────┬────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │  HTTP :8080      │
                                              │  (python3 -m)   │
                                              └────────┬────────┘
                                                       │
                                            Böngésző ──┤
                                            (gombok)   │
                                                       ▼
                                              ┌─────────────────┐
                                              │  relay.js :18998 │
                                              │  → JSONL fájl    │
                                              └────────┬────────┘
                                                       │ (10 percenként)
                                              ┌────────▼────────┐
                                              │  action-         │
                                              │  processor.js    │
                                              │  → Gateway API   │
                                              │  → Alfred session │
                                              └─────────────────┘
```

## Cron Integráció

| Cron | ID | Szerep |
|------|-----|--------|
| Noema Refresh | `cbc7d5d6` | 2 óránként regen |
| Noema Product Research | `3b4ea5d3` | 01:00 dogfooding research + competitor analysis |
| Noema Nightly QA | `eed1df55` | 03:00 code review + minőségbiztosítás |

## Dokumentáció

| Fájl | Tartalom |
|------|----------|
| `architecture.md` | Technikai architektúra, data pipeline, tab rendszer, action flow |
| `CONTRIBUTING.md` | Fejlesztési kézikönyv, coding standardok, hibakeresés |
| `roadmap.md` | Prioritizált fejlesztési útiterv (19 feature, 4 szinten) |
| `research/competitive-landscape.md` | 8 versenytárs elemzése, best practice-ek |
| `research/cursor-integration.md` | Cursor agent használata Noema fejlesztésre |

## Történet

- **2026-07-01**: Első dashboard (generate.sh, bash)
- **2026-07-03**: v4 átállás (generate-v4.js, 26 kártya)
- **2026-07-04**: Interaktív gombok (relay + action-processor)
- **2026-07-05**: Noema rebrand, Research + QA cron, termékoldal tab, teljes dokumentáció
