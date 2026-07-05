## 🧪 Dashboard QA — Code Review → Categorize → Auto-Fix → Test → Report

Teljeskörű dashboard minőségbiztosítás 5 fázisban. A hangsúly a KÓDMINŐSÉGEN van — nem csak bug-okat keresel, hanem strukturális, olvashatósági, karbantarthatósági problémákat is.

### PHASE 0: Architecture Discovery
1. `ls -la projects/noema/ projects/noema/*`
2. Map: melyik fájl mit csinál, milyen függőségek vannak köztük
3. Mérd fel a kódbázis méretét: `wc -l projects/noema/*.js projects/noema/*.html projects/noema/*.js`

### PHASE 1: 🔍 Teljeskörű Code Review

**1a. generate.js (fő generátor — ~34KB)**

🐛 **BUG-OK**:
- Regex-ek helyessége: teszteld mindegyiket legalább 1 valós input-tal
- Data pipeline: forrásfájl → parser → JSON mező → template — minden csatorna teljes?
- `undefined`/`null`/`NaN` guard: minden `.property` hozzáférés előtt van null check?
- Cron dedup: mind a 27+ cron pontosan egyszer jelenik meg?
- Timeline strip: `parseTime()` + `isSpanning()` correctness
- `countRows()` logika: section-boundary detekció működik minden szekciónál?

📐 **KÓDSTRUKTÚRA**:
- Fájl méret: 34KB egy fájlban — érdemes lenne modulokra bontani? (pl. cronParser.js, agentParser.js, h1Parser.js)
- Függvények felelőssége: single responsibility? Van 100+ soros függvény?
- Ismétlődő kód: van copy-paste? (pl. ugyanaz a fájolvasási minta többször)
- Konfiguráció vs kód: vannak hardcoded értékek amik config-ba valók?
- Magic numbers/strings: fájlnevek, path-ok, threshold értékek

👁️ **OLVASHATÓSÁG**:
- Változónevek: beszédesek? (pl. `m`, `x`, `tmp` vs `match`, `cronEntry`, `tempResult`)
- Kommentek: a komplex részek dokumentálva vannak?
- Függvénynevek: mit csinál a `processSection()`? Egyértelmű?
- Indentáció/formázás konzisztens?

🔧 **KARBANTARTHATÓSÁG**:
- Új adatforrás hozzáadása: hány helyen kell módosítani?
- Új dashboard szekció: mennyi boilerplate kell?
- Hibakeresés: van debug log? Ha a dashboard rossz adatot mutat, hogyan találod meg a hibát?
- Tesztelhetőség: a generate.js tesztelhető unit tesztekkel?

📈 **TOVÁBBFEJLESZTHETŐSÉG**:
- Új feature (pl. új chart, új metrika): mennyire invazív a változás?
- Plugin architektúra: lehetne a szekciókat pluginként kezelni?
- API: a generate.js használható lenne library-ként?

✅ **BEST PRACTICES**:
- Error handling: try/catch van a kritikus részeken?
- Async/sync: megfelelő a sync függvények használata?
- Memória: nagy fájlok beolvasása Buffer-rel vagy stream-mel történik?
- process.exit() hívások megfelelőek?
- console.log vs proper logging?

**1b. dashboard-relay.js (HTTP server)**
- Race condition: konkurens write-ok kezelve?
- Error handling: sérült JSONL, telemetry
- Security: localhost-only? Rate limiting?
- Memory: növekvő JSONL fájl → van rotate/truncate?

**1c. dashboard-action-processor.js**
- Retry logika: 3 retry után dead letter → működik?
- Gateway API auth: token frissítés kezelve?
- Queue state: pending/sent/failed/dead tranzíciók — minden state kezelve?
- Idempotencia: ha a cron duplán fut, nem küld dupla action-t?

**1d. dashboard.html (kimenet)**
- JS error: `grep -c "undefined\|null\|NaN"` a generált HTML-ben
- CSS: responsive breakpoints, layout törések, overflow
- Adat binding: minden `{{}}` placeholder kitöltve?
- Accessibility: contrast, label-ek, aria attribútumok

### PHASE 2: 📋 Megállapítások Kategorizálása

Minden találatot sorolj be:

| Kategória | Auto-Fix? | Példa |
|-----------|-----------|-------|
| 🔴 **BUG** — hibás működés | ⚠️ REVIEW előtt | rossz regex, missing null check → crash |
| 🟡 **CODE SMELL** — strukturális probléma | ❌ CSAK Proposal | túl nagy függvény, ismétlődő kód |
| 🟢 **STYLE** — olvashatóság | ✅ Auto-Fix (ha triviális) | rossz változónév, hiányzó komment |
| 🔵 **BEST PRACTICE** — konvenció | ❌ CSAK Proposal | error handling hiánya, debug log |
| 🟣 **ARCHITECTURE** — tervezési | ❌ CSAK Proposal | fájl szétbontás, plugin rendszer |

**🚨 AUTO-FIX SZABÁLY**: Csak olyat auto-fix-elj ami:
- Biztosan nem változtat viselkedést (pl. változónév átnevezés, komment hozzáadás, null check)
- 1-2 soros változtatás
- `generate.js`-t lefuttatva a kimenet azonos marad

MINDEN MÁS → Proposal Andrásnak.

### PHASE 3: 🔧 Auto-Fix (csak STYLE + triviális BUG)
- Változónév javítások
- Hiányzó kommentek a komplex részekhez
- Triviális null check-ek
- Konzisztens formázás

Minden fix után: `node projects/noema/generate.js` → ellenőrizd hogy nem tört-e el.

### PHASE 4: 🧪 Test
1. `node projects/noema/generate.js` — hibátlanul lefut?
2. `grep -c "undefined\|null\|NaN" projects/noema/dashboard.html` — NEM nőtt?
3. `grep -c "{{" projects/noema/dashboard.html` — 0 placeholder?
4. Kimeneti fájl mérete nem csökkent >5%-kal?
5. Minden szekció jelen van: Agents, Cron, Viktor, H1, Bills, OL, Research

### PHASE 5: 📊 Report

## 🚨 TELEGRAM OUTPUT
```
printf '🧪 Dashboard QA (03:00):\n\n🔍 Teljes review: <N> fájl, <M> KB\n\n📊 Találatok:\n  🔴 Bug: <N> (auto-fix: <n>, proposal: <m>)\n  🟡 Code Smell: <N>\n  🟢 Style: <N> (auto-fixed: <n>)\n  🔵 Best Practice: <N>\n  🟣 Architecture: <N>\n\n🔧 Auto-fixek:\n  - <fix1>\n  - <fix2>\n\n📋 Proposals (András review):\n  - <prop1>\n  - <prop2>\n\n🧪 Test: <PASS/FAIL>\n  - generate.js: <ok/error>\n  - undefined/null: <count>\n  - placeholder: <count>\n  - size: <before> → <after>' | scripts/cron-deliver.sh
```

## ⚠️ SZABÁLYOK
- **🚨 BUG-oknál: ELŐSZÖR REVIEW, utána fix** — ne ugorj egyből a javításra
- A review célja hogy András lássa MIÉRT történt a hiba és mit tanulhatunk belőle
- NE törölj fájlokat
- NE változtass API végpontokat vagy adatstruktúra formátumot
- Architecture változás → MINDIG proposal, SOHA ne implementáld
- Ha a generate.js eltört → azonnali rollback
- Ha nincs találat → rövid "✅ Minden rendben, no issues found" is elég
