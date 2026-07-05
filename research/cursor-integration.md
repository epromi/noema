# Cursor Agent — Noema Fejlesztési Workflow

> Hogyan használd a Cursor agent-et Noema fejlesztésre CLI-ből.
> Cursor verzió: 3.5.38+

---

## Miért Cursor?

A Cursor agent headless módban (`--print`) tud teljes kódbázist látó, multi-file refaktorokat végezni. Ez gyorsabb és kevesebb hibát eredményez, mint Alfred manuális edit/workflow.

**Alfred erőssége**: kutatás, spec, build, deploy, review
**Cursor erőssége**: komplex kód implementáció, refaktor, template szerkesztés

---

## Elérhető Modellek

Cursor agent CLI a Cursor előfizetéshez tartozó modelleket használja:

```bash
cursor models
```

Tipikus választék: `gpt-5`, `sonnet-4`, `sonnet-4-thinking`, `gemini-2.5-pro`

Noema fejlesztésre: **`sonnet-4-thinking`** (komplex refaktor) vagy **`sonnet-4`** (egyszerűbb feladatok)

---

## Alap Parancsok

### Prompt futtatása (read-only tervezés)

```bash
cursor agent --print --mode plan \
  --workspace /home/promi/.openclaw/workspace \
  --trust --model sonnet-4 \
  "Olvasd el projects/noema/archive/v4.html-t és mondd meg hogyan lehetne 
   a JS renderert kiszervezni külön fájlba"
```

### Prompt futtatása (teljes hozzáféréssel)

```bash
cursor agent --print --force \
  --workspace /home/promi/.openclaw/workspace \
  --trust --model sonnet-4-thinking \
  "Implementáld a F-05 feature-t a roadmap.md-ből: 
   Logs Viewer tab a dashboard template-be"
```

### Session folytatása

```bash
# Előző session listázása
cursor ls

# Utolsó session folytatása
cursor agent --print --continue \
  --workspace /home/promi/.openclaw/workspace \
  --trust --model sonnet-4 "Folytasd a munkát"
```

### JSON kimenet (strukturált)

```bash
cursor agent --print \
  --output-format stream-json \
  --workspace /home/promi/.openclaw/workspace \
  --trust --model sonnet-4 "prompt"
```

---

## Fejlesztési Workflow

### 1. Feature Előkészítés (Alfred)

```bash
# Alfred elolvassa a roadmap-et, kiválasztja a következő feature-t
# Elkészíti a részletes specifikációt
```

### 2. Implementáció (Cursor)

Alfred spawn-olja a Cursor agent-et:

```bash
cursor agent --print --force \
  --workspace /home/promi/.openclaw/workspace \
  --trust --model sonnet-4-thinking \
  "Olvasd el:
   1. projects/noema/roadmap.md — F-05 Logs Viewer spec
   2. projects/noema/architecture.md — architektúra referencia
   3. projects/noema/archive/v4.html — template
   4. projects/noema/generate.js — data pipeline
   
   Implementáld az F-05 Logs Viewer tab-ot:
   - Új tab a navigációban: '📋 Logs'
   - Új section: id='tab-logs'
   - JS renderer ami az utolsó 500 sort olvassa ~/.openclaw/logs/ mappából
   - Színkódolás: ERROR=piros, WARN=sárga, INFO=kék
   - Filter gombok: All, Errors, Warnings
   - generate.js: új D.logs adat pipeline
   - Kövesd a CONTRIBUTING.md-ben lévő 'Új Tab Hozzáadása Checklist'-et"
```

### 3. Review + Build + Deploy (Alfred)

```bash
# Review: mi változott?
git diff projects/noema/

# Build
node projects/noema/generate.js

# Test
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:8080/dashboard.html

# Ha OK → CHANGELOG frissítés + commit
# Ha ERROR → visszagörgetés vagy Cursor session folytatása javítással
```

### 4. Dokumentálás (Alfred)

```bash
# CHANGELOG.md frissítése
# roadmap.md státusz update (📋 → 🚧 → ✅)
# Ha új koncepció → architecture.md frissítése
```

---

## Cursor Prompt Best Practice-ek

### ✅ Jó Prompt (részletes, kontextusos)

```
Olvasd el:
1. projects/noema/CONTRIBUTING.md — fejlesztési standardok
2. projects/noema/roadmap.md — F-05 specifikáció
3. projects/noema/competitive-landscape.md — Hermes Studio Logs Viewer referencia

Implementáld a Logs Viewer tab-ot. A template-ben (archive/v4.html):
- Új tab nav gomb: sor 215 után
- Új tab-content section: sor 720 után
- JS renderer: utolsó </script> előtt

A generate.js-ben új D.logs pipeline:
- exec("tail -500 ~/.openclaw/logs/*.log")
- parse: timestamp + level + message
- color mapping: ERROR→#ff4444, WARN→#ffaa00, INFO→#4488ff

Output: 3 gomb (All/Errors/Warnings) + max 500 sor színkódolva
```

### ❌ Rossz Prompt (túl általános)

```
Csinálj egy log viewert a dashboardhoz
```

---

## Biztonság

### `--trust` flag
- Megbízik a workspace-ben, nem kérdez rá fájlműveletekre
- **Csak a saját workspace-re használd** (`/home/promi/.openclaw/workspace`)

### `--force` / `--yolo` flag
- Automatikusan jóváhagyja a shell parancsokat
- **Csak kontrollált környezetben** (build, test parancsok)
- Ne használd ha a prompt törölhet vagy módosíthat production fájlokat

### Biztonságos Alapértelmezés

```bash
# Read-only tervezés (mindig biztonságos)
cursor agent --print --mode plan --trust --workspace ... "prompt"

# Implementáció manuális review-val
cursor agent --print --trust --workspace ... "prompt"
# → Alfred átnézi git diff-et
```

---

## Példa Session-ök

### 1. Template JS Kiszervezés (F-13)

```bash
# 1. Tervezés (read-only)
cursor agent --print --mode plan \
  --workspace /home/promi/.openclaw/workspace \
  --trust --model sonnet-4 \
  "Olvasd el projects/noema/archive/v4.html-t.
   Hogyan lehet a JS renderer blokkokat kiszervezni külön .js fájlokba?
   Milyen függőségi sorrend kell? Hogyan injektáljuk be a D.* adatokat?"

# 2. Implementáció (Alfred review-val)
cursor agent --print \
  --workspace /home/promi/.openclaw/workspace \
  --trust --model sonnet-4-thinking \
  "Implementáld a JS kiszervezést:
   - archive/v4.html: script blokkok cseréje <script src='...'> tag-ekre
   - Új fájlok: js/render-*.js (tab-onként egy fájl)
   - D.* adatobjektum megtartása a HTML-ben
   - generate.js: új fájlok másolása a kimeneti mappába"
```

### 2. Audit Trail Implementáció (F-06)

```bash
cursor agent --print --force \
  --workspace /home/promi/.openclaw/workspace \
  --trust --model sonnet-4-thinking \
  "Olvasd el:
   - projects/noema/research/competitive-landscape.md (Hermes Studio Audit Trail)
   - projects/noema/architecture.md (data pipeline)
   
   Implementáld az Audit Trail tab-ot:
   - Adatforrás: sessions_list API + cron run history + agent status fájlok
   - Timeline UI: függőleges idővonal, bal oldalon timestamp, jobbra esemény
   - Event típusok: SESSION_START, AGENT_SPAWN, CRON_TRIGGER, CRON_COMPLETE, ERROR, ACTION
   - Szűrés: session, event type, utolsó 24h/7d
   - generate.js: D.auditTrail pipeline"
```

---

## Troubleshooting

### "Cursor agent nem indul"
```bash
# Ellenőrizd az autentikációt
cursor status

# Ha nincs bejelentkezve
cursor login
```

### "Agent timeout-ol"
```bash
# Próbáld kisebb scope-pal
# VAGY használj több kisebb prompt-ot session folytatással
```

### "Rossz fájlt módosított"
```bash
git diff  # nézd meg mi változott
git checkout -- <fájl>  # állítsd vissza
# Majd pontosabb prompt-tal próbáld újra
```

---

## Kapcsolódó Dokumentumok

| Fájl | Tartalom |
|------|----------|
| `CONTRIBUTING.md` | Általános fejlesztési útmutató |
| `architecture.md` | Technikai architektúra |
| `roadmap.md` | Feature prioritások |
| `../research/competitive-landscape.md` | Versenytárs feature-ök |
