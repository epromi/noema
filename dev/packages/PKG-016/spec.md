# PKG-016: Development Log Enhancements

> Státusz: 📋 Spec kész | Méret: S | Priorítás: P1
> Dependencia: PKG-001 (scaffold), PKG-014 (log viewer)

## Spec

**Mit**: Három fejlesztés a dashboard development log funkciójához:

1. **Strukturált dev log**: A `dev-loop.sh` minden fázis váltáskor írjon `logs/dev-PKG-XXX.log`-ba. A dashboard ezt a fájlt poll-olja (ne a cursor log-ot). A log formátuma emberi olvasásra optimalizált plain text.

2. **📋 Log gomb kész package-eken**: A ✅ kész package-ek mellett is jelenjen meg a 📋 Log gomb, ami a kész dev log-ot mutatja. Nincs polling (kész → statikus).

3. **Kész / Fejlesztésre vár szekciók**: A dashboard package listája két külön szekcióban jelenjen meg: "✅ Kész" felül, "📋 Fejlesztésre vár" alul.

## Scope

### F1: Structured dev log writer (dev-loop.sh)

A `dev-loop.sh` Phase 1 előtt hozza létre a `logs/dev-PKG-XXX.log`-ot és minden fázis elején/végén append-eljen státusz sorokat:

```
[16:07:01] 🚀 Pipeline indult: PKG-004-core-health
[16:07:01] 📋 Phase 1/6: Spec Analysis — kezdve
[16:07:02] ✅ Phase 1: Spec Analysis — kész (4 expected files)
[16:07:02] 📋 Phase 2/6: Strategy — CURSOR AGENT (S size)
[16:07:02] 📋 Phase 3/6: Cursor Prompt — generálva (61 lines)
[16:07:02] 🖊️  Phase 4/6: Cursor Agent — fut...
[16:08:45] ✅ Phase 4: Cursor Agent — kész (4 files, 116 lines)
[16:08:45] 🔍 Phase 5/6: Deep Review — kezdve
[16:08:46] ✅ 5a: Lint + Format — clean
[16:08:47] ✅ 5b: Test Suite — 69/69 passed, 90.95% coverage
[16:08:47] ✅ 5c: Architecture — compliant
[16:08:47] ✅ 5d: Code Quality — OK
[16:08:47] ✅ 5e: Security Scan — clean
[16:08:47] 📊 5f: Summary — 6✅ 0⚠️ 0❌
[16:08:47] 📤 Phase 6/6: Commit + Push — kezdve
[16:08:49] ✅ Phase 6: Commit + Push — kész (73e5104)
[16:08:50] ✅ Pipeline kész: PKG-004-core-health (122s)
```

A `DEV_LOG` változó a script elején definiálva:
```bash
DEV_LOG="$PROJECT_DIR/logs/dev-${PKG_ID}.log"
```
Minden fázis elején/végén:
```bash
echo "[$(date +%H:%M:%S)] 📋 Phase X/6: Név — kezdve" >> "$DEV_LOG"
echo "[$(date +%H:%M:%S)] ✅ Phase X: Név — kész (részletek)" >> "$DEV_LOG"
```

### F2: Dashboard — 📋 Log gomb kész package-eken

A `generate.cjs`-ben:
- A ✅ kész package-eknél a ▶ Mehet gomb HELYETT 📋 Log gomb jelenjen meg
- A 📋 Log gomb a kész dev log-ot nyitja meg (a meglévő `viewLog(pkgId)` függvényt hívja)
- Nincs polling (a `pollLog` csak ha a gomb ⏳ állapotban van)

### F3: Dashboard — Kész / Fejlesztésre vár szekciók

A `generate.cjs` package list render-elése:
```
✅ Kész (7)
  PKG-001  SvelteKit Scaffold          L  ✅  📋
  PKG-013  Provider Abstraction        M  ✅  📋
  ...

📋 Fejlesztésre vár (8)
  PKG-005  Core: H1 Data               M  ▶ Mehet
  PKG-006  Logs Viewer Tab             S  ▶ Mehet
  ...
```

A státusz alapján a package-ek két tömbbe rendezve, külön `<div>`-ben render-elve, szekció címmel.

## Fázisok

### F0 — Spec (~5 perc)
- [x] Igény definiálva
- [x] Scope leírva

### F1 — Structured dev log writer (dev-loop.sh) — 15 perc
- [ ] `DEV_LOG` változó definiálása
- [ ] `log_phase()` helper függvény: timestamp + státusz sor append
- [ ] Minden fázis elején `log_phase "kezdve"`, végén `log_phase "kész (részletek)"`
- [ ] Pipeline időzítés: induláskor `date +%s`, végén `$((END - START))s` számolás
- [ ] Teszt: `bash -n scripts/dev-loop.sh` + manuális futás

### F2 — Dashboard: Log gomb kész package-eken — 10 perc
- [ ] `generate.cjs`-ben: done státuszú package → `📋 Log` gomb render (▶ Mehet helyett)
- [ ] `onclick="viewLog('PKG-XXX')"` — statikus, nincs `sendAction`
- [ ] Template CSS: kész log gomb más szín (pl. `var(--muted)`)

### F3 — Dashboard: Kész / Fejlesztésre vár szekciók — 10 perc
- [ ] `generate.cjs`-ben: package-ek szétválogatása `done` és `pending` tömbökbe
- [ ] Két külön `<div>` render-elés, szekció címmel
- [ ] "✅ Kész (N)" + "📋 Fejlesztésre vár (N)" címek
- [ ] Dashboard regen + verifikáció

## Várt fájlok
- `scripts/dev-loop.sh` (modify — F1)
- `generate.cjs` (modify — F2, F3)
- `dashboard.html` (regen — F2, F3)
