# PKG-014: Dev Loop Log Viewer

> Státusz: 📋 Spec kész | Méret: S | Priorítás: P1
> Dependencia: PKG-001 (SvelteKit scaffold)

## Spec

**Mit**: Élő Cursor log megjelenítése a dashboardon. Amikor egy csomag ▶ Mehet gombját megnyomod, a gomb `⏳`-ra vált és megjelenik egy `📋 Log` gomb mellette. A log gombra kattintva egy görgethető panel nyílik, ami 3 másodpercenként frissíti a Cursor kimenetét.

**Scope**:
- `scripts/dashboard-relay.cjs`: `GET /log/:pkgId` + `GET /running` endpointok
- `projects/noema/archive/v4.html`: CSS + JS (sendAction frissítés, viewLog, pollLog)
- `projects/noema/generate.cjs`: nincs változás (a relay és a template módosul)

## Fázisok

### F0 — Spec (~5 perc)
- [x] Igény definiálva (András: "gomb homokóra mellett ami mutatja a logot")
- [x] Architektúra: relay endpoint → fetch → DOM panel

### F1 — Relay endpointok (~10 perc)
- [x] `GET /log/:pkgId` — `projects/noema/logs/cursor-*.log` tail (utolsó 8KB)
- [x] `GET /running` — futó dev-loop processz detektálása `ps aux`-szal
- [x] `relay.js` → `relay.cjs` átnevezés (ESM/CJS fix)

### F2 — Dashboard UI (~15 perc)
- [x] CSS: `.log-panel` (sötét háttér, monospace, scroll, max-height: 320px)
- [x] CSS: `.log-btn` (📋 gomb stílus)
- [x] JS: `sendAction()` frissítve — `⏳` + `📋 Log` gomb megjelenése
- [x] JS: `viewLog(pkgId)` — fetch /log, DOM panel létrehozás
- [x] JS: `pollLog(pkgId)` — 3s interval auto-refresh
- [x] JS: `stopLogPoll(pkgId)` — takarítás

### F3 — Teszt (~5 perc)
- [ ] Manuális teszt: ▶ Mehet klikk → 📋 Log gomb megjelenik → kattintás → log panel
- [ ] Manuális teszt: Cursor futás közben a log frissül
- [ ] Manuális teszt: Cursor végez → log panel tartalma végleges

### F4 — Merge (~5 perc)
- [ ] Git commit: "🧠 feat: Dev Loop Log Viewer (PKG-014)"
- [ ] Push

## Státusz

**Fázis**: F2 kész (UI implementálva), F3-F4 manuális tesztelés pending
**Megjegyzés**: A relay endpointok és a dashboard UI már implementálva van, a template módosítások a `archive/v4.html`-ben vannak. A következő ▶ Mehet klikknél azonnal látszik a hatás.
