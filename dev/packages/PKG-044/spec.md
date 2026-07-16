# PKG-044: Otto Nightly Runs — Collapsible + Readable

> Státusz: 🔴 Tervezett | Méret: S | Függőség: PKG-023 (Orchestrator)
> Target: `Orchestrator.svelte` (UI réteg) — a collector (`research.ts`) változatlan, nyers adatot szolgáltat

## Spec

**Mit**: Az Orchestrator tab "⚡ Otto Nightly Runs" szekciója jelenleg felül van (az Action Queue és Cron Timeline fölött), mindig kinyitva, és a tartalma nehezen értelmezhető: nyers, verbose summary szövegek, technikai step label-ek (N+1, N+2, N+5, N+2b).

**Miért**: Az Action Queue a felhasználó fő interakciós pontja — annak kell felül lennie. Az Otto futások referencia adatok, nem igényelnek azonnali figyelmet. A jelenlegi layout-ban a felhasználó minden alkalommal átgörgeti a hosszú Otto timeline-t hogy elérje az Action Queue-t.

## Plan

### 1. Áthelyezés az Orchestrator tab aljára

Új sorrend az Orchestrator tab-on:
```
F1: Cron Timeline (24h)
F2: Action Queue Kanban
F3: 🔄 Processing Queue (PKG-043 — ha implementálva; egyébként kihagyandó)
F4: ⚡ Otto Nightly Runs (collapsible, collapsed default)
F5: 🧠 Noema Product Research (meglévő szekció, alul marad)
```

Az Otto szekció a tab aljára kerül, az interaktív elemek alá, de a Research Proposals fölé (az továbbra is legalul marad).

### 2. CollapsibleSection komponens

**Komponens API** (`src/lib/components/CollapsibleSection.svelte`):

```svelte
<!-- Props -->
<script>
  let { storageKey, title, summary, defaultCollapsed = true, children } = $props();
</script>
```

| Prop | Típus | Kötelező | Leírás |
|------|-------|----------|--------|
| `storageKey` | `string` | ✅ | localStorage kulcs a collapse állapot perzisztálásához (pl. `noema:otto-collapsed`) |
| `title` | `string` | ✅ | Fejléc szöveg (pl. "⚡ Otto Nightly Runs") |
| `summary` | `string` | ❌ | Összecsukott állapotban megjelenő összesítő szöveg (pl. "7 runs, latest: Jul 13 ✅") |
| `defaultCollapsed` | `boolean` | ❌ | Alapértelmezett: `true` |
| `children` | `Snippet` | ✅ | A kinyitható tartalom (slot) |

- Fejléc: `{title}` + `{summary}` + ▶/▼ toggle ikon
  - ▶ ha összecsukva, ▼ ha kinyitva
  - A teljes fejléc kattintható (nem csak az ikon)
- Alapértelmezés: összecsukva (csak a fejléc látszik)
- Kinyitva: a children slot tartalma (a teljes timeline)
- **localStorage perzisztálás**: `localStorage.setItem(storageKey, collapsed ? 'true' : 'false')`
  - **Fallback**: Ha localStorage nem elérhető (private browsing, quota exceeded) → session-only állapot (Svelte state), nincs perzisztálás, nincs hiba
  - **Corrupt data**: Ha a tárolt érték nem `'true'` vagy `'false'` → `defaultCollapsed` érték használata

**Accessibility**:
- `aria-expanded` a toggle gombon (`true`/`false` a collapsed állapottól függően)
- `aria-controls` a toggle gombon (a kinyitható tartalom region ID-jára mutat)
- Keyboard: a toggle gomb `Enter` és `Space` billentyűkkel működjön
- A kinyitható tartalom region kapjon `role="region"` és `aria-labelledby` attribútumot

**Átmenet**: CSS `transition` a max-height tulajdonságra (200ms ease), hogy a nyitás/csukás animált legyen.

### 3. Tartalom értelmezhetőbbé tétele

**Run summary helyett kivonat** (UI réteg az Orchestrator.svelte-ben, a `run.summary` mezőn dolgozik):
- Jelenleg: a teljes summary szöveg (verbose, max 200 karakter a collector truncation után)
- Helyette: max 80 karakteres kivonat + "Show more" gomb
- **Truncation algoritmus**: A `run.summary` már a collector által tisztított szöveg (a `parseOttoRun()` már eltávolította a meta sorokat mint `**`, `>`, `---`). Az UI oldali truncation:
  1. Ha a szöveg <= 80 karakter → teljes szöveg, nincs "Show more"
  2. Ha > 80 karakter → első 80 karakter levágva, `...` utótag + "Show more" gomb
  3. Pontosan 80 karakter → teljes szöveg (nincs `...`, nincs csonkolás)
- "Show more" gomb: `<button>` elem, kattintásra a teljes `run.summary` szöveg megjelenik inline (expand, nem modal/popover), a gomb szövege "Show less"-re vált, újabb kattintásra visszaáll

**Step label-ek emberi nyelvre** (teljes mapping, 9 lépés):

| Eredeti label (research.ts-ből) | N+X prefix | Megjelenített label |
|----------|----------|----------|
| Daily Log Gaps | N+1 | 📅 Log gaps |
| Task Changes | N+2 | 📋 Task changes |
| Fact Cross-Reference | N+2b | 🔗 Fact check |
| Agent Health | N+3 | 🫀 Agent health |
| Log Index Summary | N+5 | 📊 Log stats |
| API Cache Status | N+6 | 📦 API cache |
| Scout Auto-Spawn | N+7 | 🏕️ Scout spawn |
| Core Action Queue | N+8 | ⚡ Action Queue |
| Edwin Recovery | N+9 | 🚀 Edwin recovery |

A label-ek rövidebbek, és az N+X prefix csak tooltip-ben (`title` attribútum) jelenik meg.

**Fallback**: Ha egy step label nem található a mapping táblában → az eredeti label jelenik meg változatlanul (N+X prefix nélkül, ha a label tartalmazza). Ez biztosítja hogy új Otto lépések nem törnek el.

**Run-ok színkódolása**:
- ✅ zöld keret — minden step ok
- ⚠️ sárga keret — van warning
- ❌ piros keret — van error
- Az egész run card kapja a színt, ne csak az ikon

**Kiemelt figyelmeztetések** (badge detekció a summary szövegből):
- Detektálás: regex a `run.summary` szövegben (case-insensitive ahol releváns)
  - `🔴 MISSING` → "🔴 Missing log" badge
  - `🚩` → "🚩 Escalated" badge
  - `⚠️` (amikor az egész run status = "warn") → "⚠️ Warning" badge
  - Duplikált badge-ek kiszűrése: ha ugyanaz a minta többször szerepel → csak 1 badge jelenik meg típusonként
- A badge-ek a card tetején, a title mellett jelennek meg
- A "Steps" lista alatta, indentált

**Üres állapot**: Ha `research.ottoRuns.length === 0` → "No timeline data" üzenet (a jelenlegi viselkedés megtartása), nincs collapse toggle, nincs fejléc statisztika.

### 4. Összesített fejléc (összecsukott állapotban)

Amikor a szekció össze van csukva, a fejléc mutassa:
```
⚡ Otto Nightly Runs — 7 runs, latest: Jul 13 ✅ | 2 ⚠️ warnings | 0 ❌ errors
```

**Statisztika számítás**:
- **Run count**: `research.ottoRuns.length` (az összes elérhető run, nem limitált 7-re)
- **Latest date**: az első/legfrissebb run `date` mezője
- **Warning count**: azon run-ok száma ahol `status === "warn"`, a legutóbbi 7 napra szűrve (ha a rendelkezésre álló adat < 7 nap → a teljes elérhető időszakra)
- **Error count**: azon run-ok száma ahol `status === "err"`, a legutóbbi 7 napra szűrve (ha a rendelkezésre álló adat < 7 nap → a teljes elérhető időszakra)
- **Latest status**: a legfrissebb run status-ának ikonja (✅/⚠️/❌)
- Ha `research.ottoRuns` üres → a CollapsibleSection nem renderelődik (helyette az üres állapot jelenik meg, lásd fent)

## Módosítandó Fájlok

| Fájl | Művelet |
|------|---------|
| `src/lib/components/CollapsibleSection.svelte` | **Új** — generic collapsible wrapper: ▶/▼ toggle, localStorage perzisztálás (fallback), aria accessibility, CSS transition, `storageKey`/`title`/`summary`/`defaultCollapsed` props, children slot |
| `src/lib/components/tabs/Orchestrator.svelte` | Átrendezés (F1→F4), CollapsibleSection wrapper, step label mapping (fallback ismeretlen label-re), color coding, summary truncation, badge detekció (dedup), 7-nap statisztika (edge case: <7 nap), Research Proposals megtartása F5-ként |
| `tests/components/CollapsibleSection.test.ts` | Toggle + localStorage + localStorage unavailable + corrupt data + accessibility + collapsed header tesztek |

## ✅ Acceptance Criteria

- [ ] Otto Nightly Runs az Orchestrator tab alján van (Cron Timeline, Action Queue, Processing Queue alatt; Research Proposals fölött)
- [ ] Research Proposals szekció ("🧠 Noema Product Research") megmarad, F5 pozícióban
- [ ] Alapértelmezetten összecsukva (csak fejléc látszik)
- [ ] ▶/▼ toggle működik, localStorage-ban perzisztál; localStorage unavailable esetén session-only fallback
- [ ] Teljes fejléc kattintható (nem csak az ikon)
- [ ] Nyitás/csukás CSS transition-nel animált (200ms ease)
- [ ] Összecsukott fejléc mutatja: run-ok száma (`ottoRuns.length`), latest dátum, latest status ikon, warning/error count (legutóbbi 7 nap; ha kevesebb adat van → a teljes időszak)
- [ ] Step label-ek emberi nyelvűek ("Daily Log Gaps" → 📅 Log gaps)
- [ ] N+X prefix csak tooltip-ben (`title` attribútum) látszik
- [ ] Ismeretlen step label → eredeti label megjelenik (nem törik el)
- [ ] Run summary max 80 karakter + "..." + "Show more" gomb (pontosan 80 karakternél nincs csonkolás)
- [ ] "Show more" kattintásra teljes summary + "Show less" toggle
- [ ] Run card színkódolt (zöld keret ✅ / sárga keret ⚠️ / piros keret ❌)
- [ ] Figyelmeztetések (MISSING log, escalated loop) badge-ként kiemelve, duplikátumok kiszűrve
- [ ] Emoji step label mapping teljes (mind a 9 Otto lépés: Daily Log Gaps, Task Changes, Fact Cross-Reference, Agent Health, Log Index Summary, API Cache Status, Scout Auto-Spawn, Core Action Queue, Edwin Recovery)
- [ ] Üres ottoRuns → "No timeline data" (nincs collapse toggle, nincs statisztika)
- [ ] CollapsibleSection: aria-expanded, aria-controls, keyboard (Enter/Space), role="region"
- [ ] `pnpm test` zöld
- [ ] `pnpm build` hibátlan
