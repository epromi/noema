# PKG-039: Developer Freedom — Cursor Gardening + Research 🌿🔍

**Státusz**: 📋 F0 | **Méret**: S | **Becslés**: 1h | **DevFreedom**: gardening | **Függőség**: PKG-014, PKG-018

## Kérés

Két dolog:
1. Cursor a spec-en túl is takaríthasson a módosított fájlokban (TypeScript, error handling, accessibility)
2. Implementálás előtt végezhessen gyors webes validációt (versenytársak hogy oldják meg, best practice-ek)

## Review Jegyzetek

### Mit tartottunk meg
- **Gardening**: egy szint (gardening/strict), nincs három szint — a kettő határa nem éles
- **Research pre-fetch**: Phase 1 része, sequential — a Strategy előfeltétele
- **⛔ Guardrails**: konkrét, egyértelmű lista

### Mit egyszerűsítettünk
- **Nincs subagent** research-re → `web_search` + `web_fetch`, 60 mp limit
- **Nincs három DevFreedom szint** → gardening (default) vagy strict
- **Nincs kötelező research-topics.md** → ha van, használja; ha nincs, auto-generál
- **Nincs új phase gate rendszer** → output fájl validáció a meglévő phase-ek végén

### Mit korrigáltunk
- **Research időlimit**: 30 mp → **60 mp** (elég 3-4 web_search/fetch-re)
- **Becslés**: 2.5h → **1h** (subagent nélkül sokkal egyszerűbb)

## Specifikáció

### F1: Gardening — Automatikus Kódtakarítás 🌿

Cursor a spec által érintett fájlokban szabadon végezhet kisebb javításokat.

**Engedélyezett** (gardening):

| Kategória | Példa |
|-----------|-------|
| TypeScript | `any` → konkrét típus, type guard `as` cast helyett |
| Hibakezelés | Hiányzó try/catch, fallback értékek |
| Accessibility | `alt`, `aria-label`, `role`, `tabindex` a touched komponensekben |
| Import rend | Unused import törlés, duplikált merge |
| Edge case | `undefined`/`null` kezelés, empty state-ek |
| TODO/FIXME | A touched fájlokban lévő egyszerű fix-ek |
| DRY | Duplikált kód kiszervezése a touched fájlokon belül |

**Tilos** (⛔):

- API contract változtatás (props, route params, response format)
- CSS design token módosítás (`--accent`, `--bg`, `--border`, `--text`)
- Meglévő funkcionalitás eltávolítása vagy átnevezése
- Új npm dependency
- Routing struktúra módosítása
- Fájlok a touched scope-on kívül
- `// STABLE: do not modify` kommenttel jelölt kód

**Ha túl nagy változás kellene**: a log-ba `💡 SUGGESTION: <leírás>` → Alfred új PKG-t ír belőle.

**Engedélyezés**: minden PKG alapértelmezetten `gardening`. Ha `strict` kell:
```markdown
**Státusz**: 📋 F0 | **Méret**: S | **Becslés**: 30m | **DevFreedom**: strict
```

### F2: Pre-Implementation Research 🔍

A Phase 1 (Spec Analysis) végén, ha a PKG metadata-ban `Research: yes`:

```
Phase 1: Spec Analysis
         ├─ Fájlok azonosítása
         ├─ Függőségi térkép
         └─ [HA Research=yes] web_search + web_fetch (60 mp limit)
              │
              ├─ Ha van research-topics.md → abból query-k
              ├─ Ha nincs → auto-gen a spec címéből + első bekezdésből
              └─ Eredmény → Phase 1 output végére append
```

**Miért sequential?** A Strategy-nak tudnia kell a research eredményt MIELŐTT tervez.

**Eszközök**: `web_search` (elsődleges) ÉS `web_fetch` (DDG Lite vagy bármilyen URL), szabadon választható. NEM subagent.

**Időlimit**: 60 mp. A Cursor dönti el hogy hány keresést/fetch-et csinál — annyit amennyi belefér 60 mp-be. Ha timeout → a Phase 1 folytatódik, a research output üres.

**Keresési query generálás**:
1. Ha van `research-topics.md` → abból a query-k
2. Ha nincs → spec címéből + első bekezdéséből 2 query: egy "competitor" és egy "best practice"
   ```
   Query 1: "<spec tárgya> dashboard design pattern"
   Query 2: "<spec technológiája> best practice 2026"
   ```

**Output formátum** (Phase 1 log végén):
```
## 🔍 Research (XXs, N results)

### Query 1: "grafana dashboard agent status panel"
📊 Grafana uses expandable rows with status badges and last-check timestamps.
🎯 Validates our approach — add timestamp to agent detail panel.

### Query 2: "svelte slide panel accessibility"
📊 WAI-ARIA recommends role="dialog" with aria-labelledby for slide-in panels.
🎯 Change from <aside> to role="dialog" in the panel implementation.
```

**Log**: a `dev-PKG-XXX-*.log` fájlban mindig látszik a research output (akkor is ha timeout).

### F3: Pipeline Output Validáció

Minden phase végén ellenőrzés hogy a kötelező output fájlok léteznek és nem üresek:

| Phase | Kötelező Output |
|-------|----------------|
| 0 | `review-PKG-XXX-*.log` |
| 1 | `spec-analysis.json` (files, deps, + research ha volt) |
| 2 | `strategy.md` |
| 3 | `cursor-prompt.md` |
| 4 | Git diff (legalább 1 fájl változott) |
| 5 | `deep-review.md` |
| 6 | Git commit hash |
| 7 | `ci-result.json` |

Ha bármelyik hiányzik → pipeline FAIL, a hibás phase nevével.

### F4: Cursor Prompt Bővítés

A Phase 3 prompt két új szekciót kap:

```markdown
## 🎨 Gardening (DevFreedom: gardening)

You may improve the code within the files listed above. Allowed:
- Fix TypeScript `any` → concrete types
- Add missing error handling, fallback values
- Remove unused imports, add accessibility attributes
- Fix simple TODO/FIXME comments in touched files
- DRY up duplicated code within these files

NOT allowed: change API contracts, CSS design tokens, routing, add deps,
touch files outside scope, modify // STABLE code.

If you see a larger improvement opportunity, add a comment:
`💡 SUGGESTION: <brief description>`

## 🔍 Research Findings (if available)

<research output from Phase 1 — may be empty if no research was done>
```

## Elfogadási Kritériumok

- [ ] `DevFreedom` mező a spec-ben: `gardening` (default) vagy `strict`
- [ ] Cursor prompt tartalmazza a Gardening szekciót a ⛔ listával
- [ ] Cursor prompt tartalmazza a Research Findings szekciót (ha volt research)
- [ ] `💡 SUGGESTION` kommentek a log-ban → Alfred review-zható
- [ ] `Research: yes` esetén Phase 1 végén web_search/web_fetch, max 60 mp
- [ ] `research-topics.md` opcionális — ha van, használja; ha nincs, auto-generál
- [ ] Research timeout esetén a pipeline folytatódik (empty research output)
- [ ] Phase output validáció: hiányzó fájl → FAIL a phase nevével
- [ ] `// STABLE` marker-eket a gardening ignorálja


## 🎯 Mit

_Placeholder — to be filled._


## 📐 Scope

- `src/lib/core/dev-freedom.ts` — metadata parsing, research query gen, prompt sections, phase validation
- `tests/core/dev-freedom.test.ts` — unit tests (≥70% coverage)
- `scripts/dev-freedom-helper.mjs` — pipeline CLI (research fetch, prompt gen, validation)
- `scripts/dev-loop.sh` — integrate gardening, research, output validation
- `prompts/cursor-implement.txt` — Gardening + Research Findings placeholders (F4)


## Mit érint

_Placeholder — to be filled._


## Mit NEM érint

_Placeholder — to be filled._


## Fázisok

_Placeholder — to be filled._


## ✅ Acceptance Criteria

_Placeholder — to be filled._
