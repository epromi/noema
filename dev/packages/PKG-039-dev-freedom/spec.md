# PKG-039: Developer Freedom — Cursor Gardening Jogkör 🌿

**Státusz**: 📋 F0 | **Méret**: M | **Becslés**: 2.5h | **Függőség**: PKG-014, PKG-018, PKG-035

> **Megjegyzés**: A kutatás a Phase 1 (Spec Analysis) része, NEM plusz fázis. Sequential — a Strategy csak a research után indul. Rövid időlimit (60 mp) + előre kitöltött `research-topics.md` = gyors.

## Kérés

A dev-loop pipeline-ban a Cursor agent kapjon korlátozott "fejlesztői szabadságot" — a spec-ben leírtakon túl is végezhessen kisebb javításokat, ha azok:
- Nem változtatnak az alapvető működésen
- Javítanak a kódminőségen vagy felhasználói élményen

## Probléma

Jelenleg a Cursor agent szigorúan a spec-et követi. Ha a spec 3 fájl módosítását írja elő, Cursor csak azt a 3 fájlt érinti. De közben:

- A szomszédos fájlokban lévő hasonló pattern-ek nincsenek javítva
- A touched fájlokban lévő régi `// TODO` vagy `FIXME` kommentek érintetlenek maradnak
- Hiányzó TypeScript típusok, `any`-k a módosított fájlokban maradnak
- Hiányzó `alt` attribútumok, aria label-ek a touched komponensekben
- Felesleges import-ok, dead code a módosított fájlokban

Ezek kis dolgok, de összeadódnak. Ha Cursor-nak lenne egy "takarítási" jogköre, a kódbázis folyamatosan javulna.

## Tervezési Alapelvek

### 1. Szabadsági Szintek

Minden PKG kap egy **devFreedom** szintet (alapértelmezett: `gardening`):

| Szint | Név | Mit Enged | Mikor Használjuk |
|-------|-----|-----------|-----------------|
| `strict` | Szigorú | CSAK a spec-ben leírtak | Security fix, infrastruktúra, API változás, data flow |
| `gardening` | Kertészet 🌿 | Spec + takarítás a touched fájlokban | **Alapértelmezett** — a legtöbb PKG |
| `ux-polish` | UX Finomítás ✨ | Gardening + mikró UX javítások | UI/UX PKG-k, komponens fejlesztések |
| — | — | (nincs magasabb szint) | Scope creep megelőzése — a Level 3+ új PKG-t igényel |

### 2. Gardening Szint — Mit Enged (🌿)

Cursor a touched fájlokon belül szabadon:

| Kategória | Példák |
|-----------|--------|
| **TypeScript** | `any` → konkrét típus, hiányzó interface-ek pótlása, `as` cast-ok helyett type guard |
| **Kód tisztaság** | Duplikált kód kiszervezése, magic number → konstans, felesleges `await` eltávolítása |
| **Hibakezelés** | Try/catch pótlása ahol hiányzik, fallback értékek, error boundary-k |
| **Accessibility** | `alt` attribútumok, `aria-label`, `role`, `tabindex` — a touched komponensekben |
| **Import rend** | Unused import törlés, duplikált import merge, barrel export rendezés |
| **Kommentek** | `// TODO` és `// FIXME` kommentekben jelzett egyszerű fix-ek (a touched fájlokban) |
| **Edge case** | `undefined`/`null` kezelése a touched függvényekben, empty state-ek |
| **Konszisztencia** | Ha a spec egy pattern-t vezet be 2 fájlban, de a 3. fájlban ugyanaz a pattern régi → frissíti |

### 3. UX Polish Szint — Mit Enged (✨)

A gardening-en felül:

| Kategória | Példák |
|-----------|--------|
| **Átmenetek** | `transition:`, `animation:`, hover/focus state-ek a touched komponensekben |
| **Mikro interakciók** | Loading skeleton, gombok disabled state finomítása, scroll viselkedés |
| **Reszponzivitás** | A spec által érintett komponensek mobilnézetének finomhangolása |
| **Üres állapotok** | Szebb empty state komponens, `{#if}` fallback-ek |
| **Szín/contrast** | Kontraszt arány javítása a touched elemeken (WCAG AA) |

### 4. Amit SOHA (⛔)

Függetlenül a szinttől:

- ❌ API contract megváltoztatása (props interface, route params, API response formátum)
- ❌ Design token-ek módosítása (`--accent`, `--bg`, `--border`, `--text` CSS változók)
- ❌ Meglévő funkcionalitás eltávolítása vagy átnevezése
- ❌ Új npm dependency hozzáadása
- ❌ Routing struktúra módosítása (új route, route átnevezés)
- ❌ Collector, health check, vagy SSE logika módosítása
- ❌ Fájlok a touched scope-on kívül (kivéve: shared type-ok, barrel export-ok)
- ❌ `// STABLE: do not modify` kommenttel jelölt kódblokkok

### 5. Scope Határok

A gardening CSAK a spec által **már érintett fájlokra** vonatkozik. Kivétel:

- **Barrel export fájlok** (`index.ts`) — ha új export kerül be a spec miatt, a gardening rendezheti az export sorrendet
- **Shared type fájlok** — ha a spec új típust vezet be, a gardening kiegészítheti a kapcsolódó típusokat
- **Közvetlen szomszédos komponens** — CSAK ha a spec által bevezetett változás breaking change-et okozna ott (pl. átnevezett prop)

Ha a Cursor agent úgy érzi hogy a gardening-en TÚLI változás kellene:
→ A log-ba írja: `💡 SUGGESTION: <rövid leírás>` → ezeket Alfred átnézi és új PKG-t ír ha értékes.

### 6. Pipeline Implementáció

#### 6a. PKG Spec → DevFreedom Mező

A spec.md metadata blokkjában:

```markdown
**Státusz**: 📋 F0 | **Méret**: S | **Becslés**: 30m | **DevFreedom**: gardening
```

Az INDEX.md táblázatban új oszlop (opcionális, alapértelmezett `gardening`):

```markdown
| PKG-039 | ... | 📋 F0 | — | M | 2h | gardening | PKG-014, PKG-018 |
```

#### 6b. Phase 1 (Spec Analysis) → Freedom Szint Kiolvasása

A `dev-loop.sh` a spec.md-ből vagy INDEX.md-ből kiolvassa a `DevFreedom` értéket. Ha nincs megadva → `gardening`.

#### 6c. Phase 3 (Cursor Prompt) → Freedom Bekötése

A Cursor agent prompt-jába kerül egy `## 🎨 Developer Freedom` szekció:

```markdown
## 🎨 Developer Freedom — Level: gardening 🌿

You have LIMITED freedom to improve code quality and UX within the files you touch.
Do NOT change any file not listed above unless it's a barrel export or shared type file.

### Allowed (gardening level):
- Fix TypeScript `any` types to concrete types
- Add missing error handling (try/catch, fallback values)
- Remove unused imports, merge duplicates
- Add missing accessibility attributes (alt, aria-label, role)
- Fix simple TODO/FIXME comments in touched files
- Handle undefined/null edge cases in the functions you modify
- DRY up duplicated code within the touched files

### NOT Allowed (EVER):
- ❌ Change API contracts (props interfaces, route params, response formats)
- ❌ Change CSS design tokens (--accent, --bg, --border, --text, etc.)
- ❌ Remove or rename existing functionality
- ❌ Add new npm dependencies
- ❌ Modify routing structure
- ❌ Touch files outside the scope listed above
- ❌ Modify code marked with // STABLE: do not modify

### Suggestions
If you see an opportunity beyond gardening scope, add a comment in the PR:
`💡 SUGGESTION: <brief description>` — these will be reviewed for future PKGs.

### Commit Strategy
- Freedom changes should be in the SAME commit as the spec changes
- If the freedom changes are significant (>20% of diff), split into 2 commits:
  `feat: PKG-XXX description` + `chore: adjacent cleanup`
```

#### 6d. Phase 5 (Deep Review) → Freedom Review

A review fázis a gardening változásokat KÜLÖN ellenőrzi:

| Ellenőrzés | Szigor |
|-----------|--------|
| Spec követelmények teljesülnek? | ⚠️ **FAIL ha nem** |
| Gardening változás törte a teszteket? | ⚠️ **FAIL ha igen** |
| Gardening változás scope-on kívüli fájlban van? | ⚠️ **FAIL** — revert that file |
| Gardening változás ⛔ szabályt szegett? | ⚠️ **FAIL** — revert |
| Gardening változás bevezetett egy warning-ot? | ⚡ **WARN** — elfogadható de jelzi |
| Gardening változás javított egy warning-ot? | ✅ **GOOD** — pozitív visszajelzés |

#### 6e. Phase 6 (Commit) → Két Commit Stratégia

Ha a gardening változások > a diff 20%-a:
```bash
git add <spec-only files>     # csak a spec változások
git commit -m "feat: PKG-XXX ..."
git add <gardening files>     # a takarítás
git commit -m "chore: gardening cleanup in <files>"
```

Egyébként egy commit.

### 7. Research Subagent — Sequential, Phase 1-ba Integrálva 🔍

A kutatás a **Phase 1 (Spec Analysis) része**, nem külön fázis. A pipeline lépésszámot nem növeli — a meglévő Phase 1 bővül egy conditional research blokkal.

**Miért sequential?** A research ELŐFELTÉTELE a Strategy-nak. A Cursor-nak tudnia kell a versenytársak megoldását MIELŐTT stratégiát tervez. Ha párhuzamos, a Strategy vakon indul és utólag kell korrigálni.

#### 7a. Pipeline Flow

```
Phase 0: Spec Review
         │
         ▼
Phase 1: Spec Analysis
         │
         ├─ 1.1 Fájlok azonosítása
         ├─ 1.2 Függőségi térkép
         ├─ 1.3 [HA Research=yes] Research Agent spawn + várakozás ⏱️ max 60 mp
         │       │
         │       ├─ research-topics.md beolvasása
         │       ├─ Albert subagent spawn (60 mp timeout)
         │       └─ Eredmények mentése → Phase 2 input
         │
         └─ 1.4 Phase 1 output: files + deps + research findings
         │
         ▼
Phase 2: Strategy Analysis (research eredményekkel informált)
         │
         ▼
Phase 3-7: normál flow
```

**Kulcs**: A Phase 1 MINDIG lefut teljesen. Ha Research=yes → a research kötelező része a Phase 1-nek, nem opcionális skip. Ha timeout (60 mp) → a Phase 1 akkor is befejeződik, a research output üres lesz.

#### 7b. Időlimit — Gyors, Nem Blokkoló

| Paraméter | Érték | Indoklás |
|-----------|-------|----------|
| Research agent timeout | **60 mp** | A spec előre kitöltött, az agent csak keres és visszatér |
| Keresések száma | Max **2** keresés | Kettő elég a validációhoz |
| Fallback ha timeout | Üres `## 🔍 Research: Timed out` | Pipeline folytatódik research nélkül |
| `research-topics.md` | **Előre kitöltött** | Agent-nek nem kell kitalálnia mit keressen → gyors |

#### 7c. Research Agent Spec

**Spawn**: `sessions_spawn(agentId="albert", label="research-PKG-XXX", timeoutSeconds=60)`

**Prompt** (rövid, célzott):
```
## 🔍 Quick Research — PKG-XXX

**Context**: <spec első bekezdése, 1 mondat>

**Search Queries** (from research-topics.md):
1. <query 1>
2. <query 2>

**Rules**:
- ⏱️ Max 2 searches + 1 fetch, max 60 seconds
- 📝 Return ONLY findings block
- 🚫 No code upload, no credentials

### Output Format
## 🔍 Research Findings

### 1. <topic>
🔎 Query: <search terms>
📊 Finding: <1-2 sentences>
🎯 Impact: <approach change or "none">

### 2. <topic>
(same format)

No results → 📊 Finding: No useful results — proceed as spec'd.
```

#### 7d. `research-topics.md` — Kötelező Ha Research=yes

A `Research: yes` flag mellett KÖTELEZŐ a `research-topics.md`. Ez biztosítja:
- A research agent NEM veszteget időt a téma kitalálására
- A keresési query-k relevánsak és célzottak
- A 60 mp-es időlimit tartható

**Minimális formátum**:
```markdown
# PKG-XXX Research Topics
1. "grafana dashboard cpu load percentage display format"
2. "datadog infrastructure agent status panel design"
```

**Ha nincs `research-topics.md` és Research=yes**: a pipeline **FAIL** — "Missing research-topics.md".

#### 7e. Kihagyás Megelőzése — Phase Gate-ek

Minden phase egy KÖTELEZŐ checkpoint. Ha egy phase FAIL, a pipeline MEGÁLL.

```bash
# Minden phase gate — || exit 1 garantálja a megállást
run_phase 0 "Spec Review"        || exit 1
run_phase 1 "Spec Analysis"      || exit 1  # ← research itt, ha Research=yes
run_phase 2 "Strategy"           || exit 1
run_phase 3 "Cursor Prompt"      || exit 1
run_phase 4 "Cursor Agent"       || exit 1
run_phase 5 "Deep Review"        || exit 1
run_phase 6 "Commit"             || exit 1
run_phase 7 "CI Verification"    || exit 1
```

A `run_phase()` függvény ellenőrzi:
1. Phase script lefutása
2. Kötelező output fájlok létezése
3. Bármi hiányzik → FAIL, pipeline STOP

Ez garantálja hogy a Cursor SOHA nem hagy ki lépéseket.

### 8. `// STABLE` Marker

Azok a kódrészek amiket SOHA nem szabad gardening közben módosítani, kapjanak `// STABLE` kommentet:

```typescript
// STABLE: do not modify — health check logic is critical path
export async function checkGatewayHealth(): Promise<string> {
  // ...
}

// STABLE: design tokens — changes require global design review
--accent: #3a86ff;
```

A meglévő STABLE marker-ek listáját a pipeline `memory/protocols/stable-markers.md`-ben tartja nyilván.

## Elfogadási Kritériumok

- [ ] PKG spec-ekben `DevFreedom` mező: `strict`, `gardening`, vagy `ux-polish`
- [ ] Alapértelmezett: `gardening`
- [ ] Cursor prompt tartalmazza a Developer Freedom szekciót a megfelelő szinttel
- [ ] A ⛔ szabályok listája a prompt-ban explicit, Cursor által értelmezhető
- [ ] Deep Review fázis külön ellenőrzi a gardening változásokat
- [ ] Scope-on kívüli gardening változás → FAIL
- [ ] `💡 SUGGESTION` kommentek a Cursor output-ban → Alfred átnézi és új PKG-t generál ha értékes
- [ ] `// STABLE` marker lista karbantartva a `memory/protocols/stable-markers.md`-ben
- [ ] Két commit stratégia ha a gardening >20%
- [ ] Research subagent a Phase 1 része (sequential, nem párhuzamos)
- [ ] Research agent max 60 mp, max 2 keresés
- [ ] `research-topics.md` kötelező ha Research=yes, hiánya → FAIL
- [ ] Ha nincs research-topics.md → auto-generált keresések a spec alapján
- [ ] Research eredmények strukturáltan (🔎/📊/🎯) a log-ban
- [ ] Research flag alapértelmezetten `no` — explicit kell engedélyezni
- [ ] Timeout esetén a pipeline folytatódik research nélkül, nem FAIL
- [ ] A pipeline nem lassul a freedom check-ek miatt (már meglévő review lépésekbe integrálva)
