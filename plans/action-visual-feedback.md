# Action Queue — visual feedback after action
> 2026-07-11 | P0 | PLANNING | est:35m act:—

## Spec

Amikor András kattint egy action gombra (pl. Resolve, Delegate, Investigate), a gomb 3 másodpercre
✅-ra vált, majd visszaáll idle állapotba. Az item ugyanott marad a táblán. Semmi nem jelzi
hogy az action megtörtént. Olyan vizuális visszajelzés kell ami megmarad: az item elhalványul,
áthúzott lesz, és egy ✅ Resolved badge jelenik meg. Pár másodperc múlva a dashboard automatikusan
frissíti a queue adatokat és ha az item átkerült a Resolved szekcióba, eltűnik a boardról.

## Plan

Kétlépcsős visszajelzés: (1) lokális state → azonnali vizuális feedback, (2) adat frissítés →
ha a szerver oldalon is resolved, eltűnik.

A `sendAction` siker esetén az item ID-t egy lokális `resolvedItems` Set-be teszi.
A resolved item-ek: `opacity: 0.4`, `text-decoration: line-through`, az action gombok helyett
✅ Resolved badge. Ez megmarad session végéig.

Emellett a POST siker után 3 mp-cel SvelteKit `invalidateAll()` frissíti az összes page data-t.
Ha az item már átkerült a action-queue.md Resolved szekciójába, eltűnik a boardról.
Ha még nem (pl. mert az action-processor vagy Otto még nem dolgozta fel), a lokális resolved
állapot akkor is mutatja a vizuális visszajelzést.

Az action-queue.md Resolved szekciójának olvasása már működik a `getActionQueue()`-ban
(a parser kihagyja a `[x]`-elt itemeket). A gond az hogy az action-processor jelenleg nem
módosítja a fájlt real-time — ez egy külön task.

Constraint: a lokális resolved state ne befolyásolja az újratöltést (invalidate után a resolved
itemek visszakerülhetnek ha a szerver még nem dolgozta fel őket → újra megjelennek halványan).

## Tasks

- [ ] Lokális resolved state hozzáadása Orchestrator-ben  `est:10m/act:—`
  AC: `sendAction` siker után az item ID bekerül a resolvedItems Set-be. A resolved item-eknél
  `opacity: 0.4` + `text-decoration: line-through` a kb-item-en, az action gombok helyett
  ✅ Resolved badge. Az Auto-resolved oszlop item-ei nem kapnak resolved state-et (ott nincs action).

- [ ] Action queue auto-refresh a POST siker után  `est:10m/act:—`
  AC: Sikeres sendAction után 3 mp-cel a dashboard újratölti az action queue adatokat.
  Ha az item már a Resolved szekcióban van a fájlban, eltűnik a boardról. A resolved badge
  segíti az átmenetet amíg a refresh meg nem történik.

- [ ] Resolved badge komponens kiemelése  `est:10m/act:—`
  AC: A resolved item-eken a badge vizuálisan elkülönül: halványabb háttér, áthúzott szöveg,
  a korábbi action gombok nem jelennek meg. A resolved állapot session végéig megmarad
  akkor is ha az invalidate után az item még nem került át a szerver oldali Resolved-ba.

- [ ] Resolved oszlop megjelenítése a kanban boardon  `est:5m/act:—`
  AC: Az action-queue.md ✅ Resolved szekciójából beolvasott itemek — amelyek jelenleg
  nem jelennek meg sehol — egy új negyedik oszlopban látszanak a kanban alján,
  "✅ Resolved (today)" címmel, összecsukva.
