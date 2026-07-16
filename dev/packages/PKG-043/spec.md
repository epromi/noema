# PKG-043: Action Queue — Teljes Feldolgozási Pipeline

> Státusz: 🔴 Tervezett | Méret: M | Függőség: PKG-023 (Orchestrator), PKG-040 (Action Queue Decisions)
> Target: `action-processor.cjs` + `relay.cjs` + `Orchestrator.svelte` + `DevJobIndicator.svelte`

## Spec

**Mit**: Az action queue jelenleg write-only dump: a felhasználó rákattint egy kanban gombra (Resolve, Delegate, Investigate, Option A/B/C), a relay beírja a JSONL-be, de utána SEMMI nem történik. A `delegate` és `investigate` action-öknek tényleges Alfred/Albert subagent spawn-t kell kiváltania, a `resolve`/`option_*` action-öknek a döntést rögzítenie és az item-et lezárnia, és minden action eredményét vissza kell mutatnia a dashboard-on.

**Miért**: A jelenlegi `2 pending` (decide_noema_crons, daily_log_streak_broken) hetek óta pang, mert a processor csak `implement` action-öket dolgoz fel. A felhasználó nem látja hogy a kattintása után történt-e bármi. Az action queue funkció félkész.

## Érintett Komponensek

### 1. action-processor.cjs — Teljes átírás (Handler Router)

**Jelenleg**: csak `implement` action-öket kezel, minden másra `console.log("Alfred inbox-ba írva")`.

**Cél**: Minden action típusra valós handler:

| Action | Handler | Eredmény |
|--------|---------|----------|
| `implement` | `bash dev-loop.sh <pkg-id>` | done/failed (meglévő) |
| `delegate` | `sessions_spawn(agentId="alfred", task=description)` | Subagent session key + poll completion |
| `investigate` | `sessions_spawn(agentId="albert", task=description)` | Subagent session key + poll completion |
| `resolve` | Azonnal `done` — a kattintás maga a döntés | done (azonnal) |
| `option_a/b/c` | Mint `resolve` + a választott opció rögzítése | done (azonnal) |
| `escalate` | `invokeTool('message', {channel:'telegram', to:'8794234536', text: description})` | done (azonnal) |
| `done` | Azonnal `done` | done (azonnal) |

**Gateway API integráció**: A processor egy Node.js CLI script, NEM agent. Minden Gateway API híváshoz a `scripts/spawn-review-agent.cjs`-ből kell átvenni a `getToken()` és `invokeTool(tool, args)` függvényeket. Az invokeTool a Gateway `/tools/invoke` endpoint-jára POST-ol Bearer auth token-nel (`openclaw.json` → `gateway.auth.token`). A processor minden subagent spawn, poll, és escalate művelethez ezt használja.

**Subagent kezelés**:
- **Spawn**: `invokeTool('sessions_spawn', {agentId:'alfred'|'albert', task: prompt, mode:'run', runTimeoutSeconds: 600})` — BLOKKOLÓ hívás, a Gateway visszaadja a subagent output-ját amikor kész
- **Prompt template**: `"${description}\n\nEzt a feladatot a Noema dashboard action queue-ból kaptad. Rögzítsd az eredményt és térj vissza."`
- Spawn előtt → entry `processing` státusz (hogy a lock file ellenőrzés lássa)
- InvokeTool visszatérésekor → ha siker → entry `done`, `result` mezőbe a subagent output (max 500 karakter)
- Ha invokeTool reject (Gateway unreachable/subagent timeout) → entry `failed`, retry counter +1
- Max 3 Gateway retry, utána `dead`
- **NINCS async poll** — a `sessions_spawn(mode:"run")` szinkron, a processor blokkol amíg a subagent végez

**Subagent queue**: Ha több `delegate`/`investigate` action van sorban, a processor sorban dolgozza fel őket (FIFO). Mivel a spawn blokkol, a timer tick alatt csak 1 subagent fut le. A következő timer tick veszi a következőt (ha van).

**Lock file védelem**:
- A processor induláskor ellenőrzi hogy van-e `/tmp/noema-action-processor.pid` lock file
- Ha a PID még él → skip (másik példány fut). Ha a PID halott → törli a lock file-t és folytatja.
- Sikeres indulás után `fs.writeFileSync('/tmp/noema-action-processor.pid', process.pid.toString())`
- Kilépéskor törli a lock file-t (finally block)
- Ez megakadályozza hogy a systemd timer egymásra indítson processzor példányokat

**Crash recovery — startup orphan check**:
- A processor induláskor ellenőrzi hogy vannak-e `processing` + `sessionKey` entry-k
- Ha igen → `sessions_list({search: sessionKey, activeMinutes: 1})` poll → ha a session nem jelenik meg (activeMinutes=1 alatt nincs aktivitás) → completed → done
- Ha a session megjelenik és timestamp > runTimeoutSeconds → timeout → failed
- Ha a session megjelenik és aktív → hagyja (másik példány dolgozik rajta — lock file véd)

**Stuck detection** (meglévő, javítva PKG-039 után):
- `processing` státuszú entry 30+ perce (`sessionKey` nélkül) → `dead` (zombie detection)

### 2. relay.cjs — Új endpoint-ok

**GET /queue** (új):
```json
{
  "entries": [...],  // minden nem-done, nem-cancelled entry részletes adatokkal
  "counts": {
    "total": 4, "devJobs": 2, "processing": 0, "pending": 2
  }
}
```

**POST /queue/cancel** (új): `{id: "PKG-039"}` → status → `dead`

**POST /queue/retry** (új): `{id: "PKG-036"}` → status → `pending`, retries → 0

**POST /action** (meglévő, kiegészítve):
- Új mezők az entry-ben: `source` = honnan jött, `sessionKey` = subagent session, `result` = visszatérési érték

**GET /next-trigger** (meglévő, javítva):
- `queue` count CSAK az `implement` action-öket számolja (ne a delegate/investigate-et)

### 3. Dashboard UI — Vizuális Visszajelzés

**DevJobIndicator.svelte**:
- "Sorban áll: N" kattintható → lenyíló panel a queue részletekkel
- Panel: id, action type (⚙️ implement / 📋 egyéb), státusz, hiba, kor
- Vizuális szétválasztás dev job vs egyéb action között

**Orchestrator.svelte** (új F3 szekció, az Action Queue Kanban és Otto Nightly Runs között):
- Új **"🔄 Processing Queue"** szekció — ez a JSONL queue élő állapota (NE keverd az F2 "📋 Action Queue" kanbannal!)
- Minden feldolgozás alatt lévő / nemrég lezárt entry listázva
- Státusz színkód: pending=szürke, processing=kék, done=zöld, failed=sárga, dead=piros
- Subagent-es entry-knél: futás státusz, session key, progress
- `done` entry-k 5 perces grace period alatt zöld pipával, majd eltűnnek
- `done` entry-knél **Undo gomb** a grace period alatt (5 perc) — visszateszi `pending`-be
- `failed`/`dead` entry-knél Retry gomb

**ActionButtonGroup.svelte**:
- Gomb megnyomása után: az entry azonnal megjelenik az "Processing Queue" szekcióban
- Option választásnál: a választott opció szövege látszik (pl. "A: Delete both crons")

### 4. action-queue.md Cleanup

**Jelenleg**: Otto generálja, de a resolved item-ek nem tűnnek el belőle mert nincs visszacsatolás.

**Cél**: Amikor `resolve`/`option_*` action `done`-ra vált, a processor update-eli az `action-queue.md`-t: az item státusza `[x]`-re változik.

**Update mechanika**:
- Regex: `new RegExp('^(\\s*- )?\\[ \\].*\\b' + itemId + '\\b', 'm')` — megkeresi a `- [ ] ... <itemId>` sort
- Csere: `- [ ]` → `- [x]` (a sor többi része változatlan)
- Ha a regex nem talál egyezést → log warning, de nem fail (az item lehet hogy már törölve lett az action-queue.md-ből Otto által)

## Módosítandó Fájlok

| Fájl | Művelet |
|------|---------|
| `action-processor.cjs` | **Teljes átírás** — Action router minden típusra, subagent spawn+ poll, action-queue.md update |
| `relay.cjs` | 3 új endpoint (GET /queue, POST /queue/cancel, POST /queue/retry), /next-trigger queue count fix |
| `src/lib/types/index.ts` | DevJobEntry, QueueData, ActionResult típusok |
| `src/lib/core/noema-devjob.ts` | getQueue(), cancelEntry(), retryEntry() |
| `src/lib/components/DevJobIndicator.svelte` | Kattintható queue panel, dev/egyéb szétválasztás |
| `src/lib/components/shared/ActionButtonGroup.svelte` | Opció szöveg label a gombon |
| `src/lib/components/tabs/Orchestrator.svelte` | "🔄 Processing Queue" szekció a kanban alatt |
| `tests/core/noema-devjob.test.ts` | Queue parse + filter tesztek |

## ✅ Acceptance Criteria

### Adatáramlás
- [ ] `resolve` action kattintás után az entry azonnal `done` státuszba kerül
- [ ] `option_a/b/c` kattintás után az entry `done` + a választott opció rögzítve a `result` mezőben
- [ ] `delegate` action → Alfred subagent spawn-ol → `processing` → completion után `done` + `result`
- [ ] `investigate` action → Albert subagent spawn-ol → `processing` → completion után `done` + `result`
- [ ] `implement` action továbbra is dev-loop.sh-t futtat (meglévő flow)
- [ ] `escalate` action → Gateway message tool → Telegram → `done`
- [ ] Stuck processing (30+ perc, `sessionKey` nélkül) → automatikusan `dead`
- [ ] Subagent spawn fail (Gateway unreachable) → retry next tick, max 3 Gateway retry, utána `failed`

### Dashboard visszajelzés
- [ ] Gomb megnyomása után az entry azonnal megjelenik "🔄 Processing Queue" szekcióban
- [ ] `processing` entry-knél látszik a státusz és a session key
- [ ] `done` entry 5 percig látható zöld pipával, majd eltűnik
- [ ] `failed`/`dead` entry hibaszöveggel, Retry gombbal
- [ ] DevJobIndicator "Sorban áll: N" CSAK implement action-öket számol
- [ ] DevJobIndicator kattintható panel mutatja a queue részleteit

### Rendszer
- [ ] Subagent spawn blokkoló (mode:"run"), nincs async poll — egyszerűbb, megbízhatóbb
- [ ] Lock file (`/tmp/noema-action-processor.pid`) megakadályozza a párhuzamos futást
- [ ] Subagent timeout 600s → `failed` státusz
- [ ] Processor crash után (újrainduláskor) árván maradt `processing`+`sessionKey` entry-k automatikus poll-olása
- [ ] action-queue.md `- [ ] <itemId>` → `- [x] <itemId>` resolve/option action után
- [ ] Gateway API invokeTool logika átvéve `scripts/spawn-review-agent.cjs`-ből
- [ ] Undo gomb `done` entry-knél 5 percen belül
- [ ] `pnpm test` zöld, új tesztek 85%+ coverage
- [ ] `pnpm build` hibátlan

## Out of Scope
- **`paid` action**: A `tasks.md` update külön rendszer (Otto kezeli a nightly run-ban). A `paid` action a processor-ban `done`-ba megy, a tasks.md frissítés külön PKG.
