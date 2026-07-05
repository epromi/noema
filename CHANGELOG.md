# Noema 🧠 — Changelog

## 2026-07-05

### Noema Rebrand
- Projekt hivatalosan átnevezve **Noema**-ra
- `projects/dashboard/` → `projects/noema/`, fájlok átnevezve, systemd + cron frissítve
- Backward compat symlinkek megtartva

### Noema Termékoldal (Dashboard Tab)
- Új 🧠 Noema tab: Product Identity, Health, Architecture, Code Metrics, Crons, CHANGELOG, QA, Proposals
- `generate.js`: új `noema:` data pipeline, template ~920 sor

### Noema Product Research (3b4ea5d3)
- Timeout: 600s → 900s, új prompt: dogfooding + competitor research + product thinking

### Noema Nightly QA (eed1df55)
- Új cron 03:00: 5 fázis (Discovery→Review→Categorize→Auto-Fix→Test→Report)

### Teljes Dokumentáció
- `CONTRIBUTING.md` — Fejlesztési kézikönyv, Cursor workflow
- `architecture.md` — Technikai architektúra, data pipeline
- `roadmap.md` — 19 feature 4 prioritási szinten
- `research/competitive-landscape.md` — 8 versenytárs + 12 feature ötlet
- `research/cursor-integration.md` — Cursor agent CLI használata

### Self-Review Fixek
- Cron nevek, generate.js path-ok, JSONL path, scope bug

## 2026-07-04

### Interaktív Gombok
- Böngésző gombok → relay.js (HTTP :18998) → JSONL → action-processor.js (10p) → Alfred
- 8 action típus: implement, done, escalate, restart, trigger, investigate, activate, paid
- Systemd: dashboard-relay.service + dashboard-action-processor.timer

### Dashboard Research Cron (3b4ea5d3)
- 01:00 napi analízis: 5 fázis (Analysis → Web Research → Categorize → Auto-Execute → Report)
- PHASE 1 upgraded: szisztematikus full-pipeline audit (MAP → VERIFY → CROSS-CHECK → OUTPUT → REGEX)
- Dashboard integráció: research eredmények megjelennek az Orchestrator tab-on

### Cron Scheduling Megareform
- 7 cron áthelyezve peak→off-peak
- Autoexecutor crons: 02:00 + 07:00
- Otto: 03:00→02:30 (Core), 03:35→06:00 (Compilation)
- Daytime Fact Sync: 09:00→12,15,18,21

### Viktor Self-Learning Fix
- "ready" státusz hozzáadva orchestratorhoz
- Dashboard élő adat: gap fájlokból számított recall (76%), nem hardcoded 100%
- Stats tracking: minden futáskor újraszámolás

## 2026-07-03

### Dashboard v4
- Card grid → grouped table + 24h timeline strip
- 5 csoport: ÉJSZAKA, REGGEL, EGÉSZ NAP, NAPPAL, ESTE
- Cron detail: 30+ entry részletes leírással
- Porter/Edwin klasszifikációs bug fix (`isSpanning()`)

## 2026-07-01

### Első Dashboard
- Bash generátor (generate.sh)
- HTML kártyák: agent státusz, cron lista, alap metrikák
- Python HTTP server :8080
