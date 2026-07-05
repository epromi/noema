# Dashboard Project

Egy átlátható dashboard oldal a teljes OpenClaw működés követésére.

**Státusz**: v1 — Static HTML, auto-generált az éjszakai pipeline által.

## Használat

- **Manuális generálás**: `bash projects/dashboard/generate.sh`
- **Auto**: Otto Compilation (03:35 nightly) hívja
- **Megtekintés**: Nyisd meg böngészőben: `file:///home/promi/.openclaw/workspace/projects/dashboard/dashboard.html`

## Jelenlegi (v1)

Egyetlen statikus HTML fájl, adatok a meglévő fájlokból:
- `autoresearch-state.json` → pipeline statok
- Fájlrendszer → memory fájlszám, daily log streak
- Hardcode + fájl scan → agent státusz, H1, projektek

## Jövőbeni (v2+)

- [ ] Live adat cron state-ből (API hívások helyett cron state JSON)
- [ ] HTTP server (pl. `python3 -m http.server`) auto-indítással
- [ ] Grafikonok (recall trend, CWE diversity trend)
- [ ] Kattintható agent kártyák → részletes nézet
- [ ] Agent management system kutatás
