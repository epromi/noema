# Noema 🧠 — Fejlesztési Kézikönyv

## Kinek szól

Ez a dokumentum a Noema fejlesztőinek (embereknek és AI agent-eknek egyaránt).

**Alapelv**: Minden dokumentáció a projekt könyvtárban (`projects/noema/`) van, önellátó. A Noema Research cron ezekből a fájlokból dolgozik.

---

## Fejlesztői Környezet

### Gyors áttekintés

| Mi | Hol | Parancs |
|----|-----|---------|
| Generátor | `generate.js` | `node projects/noema/generate.js` |
| Dashboard | `dashboard.html` | `curl http://localhost:8080/dashboard.html` |
| Relay | `relay.js` | `systemctl --user status dashboard-relay` |
| Action processor | `action-processor.js` | `systemctl --user status dashboard-action-processor.timer` |
| QA prompt | `qa-prompt.md` | Cron `eed1df55` olvassa |
| Research prompt | `research-prompt.md` | Cron `3b4ea5d3` olvassa |

### Template + Generator Kapcsolat

```
archive/v4.html  ←  A HTML template (statikus struktúra + JS renderer)
generate.js      ←  A data pipeline (adatgyűjtés → JSON objektum → template-be injektál)
```

**Szabály**: Template módosításnál MINDIG ellenőrizni kell, hogy a generate.js-ben lévő `D.*` kulcsok egyeznek-e a template-ben hivatkozott `D.*` kulcsokkal.

---

## Két Fejlesztési Mód

### A) OpenClaw Alfred (jelenlegi)

Alfred a `read`/`edit`/`write`/`exec` eszközökkel dolgozik. Ez jó:
- Kis módosításokra (1-2 fájl, néhány sor)
- Build & test futtatásra
- Systemd és cron managementre
- Kutatásra és spec írásra

**Limitáció**: Több fájlos komplex refaktor lassú és hibalehetőséges.

### B) Cursor Agent (ajánlott komplex munkára)

```bash
cursor agent --print --workspace /home/promi/.openclaw/workspace \
  --trust --model sonnet-4 "prompt"
```

**Mikor használd Cursor-t:**
- Template refaktorálás (860 soros HTML átstrukturálása)
- Több fájlt érintő architekturális változtatás
- Új feature implementáció (új tab, új data pipeline)
- Komplex CSS/JS átírás

**Mikor használd Alfred-et:**
- Gyors bugfix (1-2 sor)
- Build, deploy, test
- Cron és systemd management
- Kutatás, dokumentáció írás
- Cursor output review

### Cursor Workflow

1. **Alfred** kutat → specifikációt ír → menti `roadmap.md`-be
2. **Alfred** spawn-ol Cursor agent-et a feladatra
3. **Cursor** implementál → fájlokat módosít
4. **Alfred** review-z (`git diff`), build-el (`node generate.js`), test-el (`curl`)
5. **Alfred** commit-ol (ha minden OK) vagy visszagörget

```
Alfred (spec) → Cursor (code) → Alfred (review+build+deploy)
```

---

## Kódolási Standardok

### HTML Template (`archive/v4.html`)

- Egy fájl, inline CSS + JS
- Tab-ok: `<section class="tab-content" id="tab-XXX">`
- Navigáció: `<button class="tab-nav" onclick="switchTab('XXX')">`
- JS renderer: `if(D.XXX) { ... document.getElementById('tab-XXX').innerHTML = ... }`
- **Színváltozók**: CSS custom properties (`var(--accent)`, `var(--muted)`, stb.)
- **Reszponzivitás**: media query 768px alatt

### JavaScript Generator (`generate.js`)

- Egy fájl, ~800 sor
- Adatgyűjtés → `D` objektum → template változók → HTML output
- Minden adatforrás try/catch-be csomagolva
- **Output**: `D.*` kulcsok JSON.stringify-olva `<script>` tag-be
- **Template injection**: `{{VARIABLE}}` placeholder-ek cseréje

### Új Tab Hozzáadása — Checklist

1. [ ] `archive/v4.html`: új `<button class="tab-nav">` a navigációban
2. [ ] `archive/v4.html`: új `<section class="tab-content" id="tab-XXX">` a tartalommal
3. [ ] `archive/v4.html`: új JS blokk a rendererrel (utolsó `</script>` előtt)
4. [ ] `generate.js`: új `D.XXX` adat pipeline
5. [ ] `generate.js`: új `D.XXX` változó a template változók között
6. [ ] Build: `node projects/noema/generate.js`
7. [ ] Test: `curl http://localhost:8080/dashboard.html | grep 'id="tab-XXX"'`

---

## Build & Deploy

```bash
# Build
node projects/noema/generate.js

# Verify
curl -s -o /dev/null -w "HTTP %{http_code} %{size_download} bytes" http://localhost:8080/dashboard.html

# Cron regen (automata, 2 óránként)
openclaw cron run cbc7d5d6-0550-4aa2-9481-3124dabf8dad

# Systemd ellenőrzés
systemctl --user status dashboard-relay alfred-dashboard
systemctl --user status dashboard-action-processor.timer
```

---

## Verziókövetés

Minden változás kerüljön a `CHANGELOG.md`-be:

```markdown
## YYYY-MM-DD

### Változás címe
- Mit változott
- Miért
- Hatás (melyik fájl, melyik cron)
```

---

## Hibakeresés

### "Dashboard nem frissül"
1. `cron list | grep cbc7d5d6` — futott-e a Refresh cron?
2. `node projects/noema/generate.js` — kézi futtatás, van-e hiba?
3. `ls -la projects/noema/dashboard.html` — mikori a fájl?

### "Relay nem fogad gombokat"
1. `systemctl --user status dashboard-relay` — fut-e?
2. `curl http://localhost:18998/health` — válaszol-e?
3. `journalctl --user -u dashboard-relay --since "10 min ago"` — logok

### "Action processor nem küldi át"
1. `systemctl --user status dashboard-action-processor.timer` — aktív-e?
2. `cat memory/state/noema-actions.jsonl` — vannak-e pending action-ök?
3. `journalctl --user -u dashboard-action-processor --since "10 min ago"` — logok

---

## Kapcsolódó Dokumentumok

| Fájl | Tartalom |
|------|----------|
| `README.md` | Projekt áttekintés, architektúra, történet |
| `CHANGELOG.md` | Teljes változáskövetés |
| `architecture.md` | Részletes technikai architektúra |
| `roadmap.md` | Fejlesztési útiterv prioritásokkal |
| `qa-prompt.md` | Éjszakai QA cron prompt (03:00) |
| `research-prompt.md` | Product research cron prompt (01:00) |
| `research/competitive-landscape.md` | Versenytárs elemzés, best practice-ek |
| `research/cursor-integration.md` | Cursor agent használata Noema fejlesztéshez |
