# Action Queue — visual feedback after action
> 2026-07-11 | P0 | PLANNING | est:55m act:—
> 🔍 Reviewed: 2026-07-11 | iter 1 — 5 findings fixed

## Spec

Amikor András kattint egy action gombra, a gomb 3 mp-ig ✅-zik, majd visszaáll — az item
ugyanott marad. Nincs vizuális visszajelzés. Kell: (1) azonnali resolved state (áthúzás, badge),
(2) auto-refresh ami a queue-t frissíti, (3) egy Action Log idővonal ami mutatja az összes
korábbi action-t (ki, mikor, mit csinált, mi lett az eredmény).

## Plan

Három részből áll: vizuális feedback, adatfrissítés, és aktivitás log.

### 1. Vizuális feedback (lokális state)
A `sendAction` siker esetén az item ID egy lokális `resolvedItems` Set-be kerül.
Resolved item: `opacity: 0.4`, `text-decoration: line-through`, gombok helyett ✅ badge.
Session végéig megmarad.

### 2. Adatfrissítés
POST siker után 3 mp-cel `invalidateAll()` újratölti az action queue-t.
Mivel az `action-queue.md`-t jelenleg CSAK Otto nightly módosítja (nem valós időben),
az auto-refresh tipikus esetben NEM találja az itemet a Resolved szekcióban — ilyenkor
a lokális resolved badge marad. Ha Otto már áthelyezte (másnap), akkor eltűnik.

### 3. Action Log idővonal
Új `GET /api/action-log` endpoint olvassa a `noema-actions.jsonl`-t.
A kanban board alatt "📋 Action Log" komponens: utolsó 20 action időbélyeggel,
típussal, item ID-val, státusszal. 5 mp-enként poll-ol. Új action után azonnal megjelenik.
A státusz alapértelmezetten "pending" amíg az action-processor nem frissíti.

Constraint: lokális resolved state ne befolyásolja az újratöltést (invalidate után
resolved itemek visszakerülhetnek ha a szerver még nem dolgozta fel őket).

## Tasks

- [ ] Lokális resolved state hozzáadása Orchestrator-ben  `est:10m/act:—`
  AC: `sendAction` siker után az item ID bekerül a resolvedItems Set-be. A resolved item-eknél
  `opacity: 0.4` + `text-decoration: line-through` a kb-item-en, az action gombok helyett
  ✅ Resolved badge. Az Auto-resolved oszlop item-ei nem kapnak resolved state-et (ott nincs action).

- [ ] Action queue auto-refresh a POST siker után  `est:10m/act:—`
  AC: Sikeres sendAction után 3 mp-cel `invalidateAll()` újratölti a queue-t.
  Ha az item már a Resolved szekcióban van (Otto áthelyezte), eltűnik a boardról.
  Ha még nincs ott (tipikus eset — a fájlt csak Otto nightly módosítja),
  a lokális resolved badge marad. A resolved badge segíti az átmenetet.

- [ ] Resolved badge komponens kiemelése  `est:10m/act:—`
  AC: A resolved item-eken a badge vizuálisan elkülönül: halványabb háttér, áthúzott szöveg,
  a korábbi action gombok nem jelennek meg. A resolved állapot session végéig megmarad
  akkor is ha az invalidate után az item még nem került át a szerver oldali Resolved-ba.

- [ ] Resolved oszlop megjelenítése a kanban boardon  `est:5m/act:—`
  AC: Az action-queue.md ✅ Resolved szekciójából beolvasott itemek — amelyek jelenleg
  nem jelennek meg sehol — egy új negyedik oszlopban látszanak a kanban alján,
  "✅ Resolved (today)" címmel, összecsukva.

- [ ] Action log API endpoint a JSONL olvasásához  `est:5m/act:—`
  AC: `GET /api/action-log` visszaadja az utolsó 50 sort a `noema-actions.jsonl`-ből
  JSON formátumban (timestamp, action, id, description, status).
  Ha a fájl nem létezik, üres tömböt ad vissza.

- [ ] Action log / aktivitás idővonal a kanban alatt  `est:15m/act:—`
  AC: A kanban board és a Cron Timeline között egy "📋 Action Log" szekció jelenik meg.
  Az utolsó 20 action-t listázza a `/api/action-log`-ból. Minden sor: időbélyeg,
  action típus (pl. Resolve, Delegate), item ID, leírás, és státusz
  (alapértelmezett: "pending", action-processor frissítheti "done"/"error"-ra).
  A lista 5 mp-enként frissül. Új sendAction után azonnal újratölti a logot.
