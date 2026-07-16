# PKG-058: Dev-Loop + Review — Spec Teljesség Védőháló

**Státusz**: 📋 F0 (specifikáció kész)  
**Méret**: M  
**Becsült idő**: 1h  
**Függőség**: PKG-054 (dev-packages.ts változások), PKG-056 (race fix hogy működjön a queue)  
**Dátum**: 2026-07-16

## Probléma

PKG-054-nél a subagent a spec 3 követelményéből 2-t kihagyott (`relay.cjs` queue filter + POST validáció). A review "Nothing needed fixing"-et mondott. Két rendszerszintű hiba:

### 1. File extraction regex túl szűk

```bash
# dev-loop.sh line 158 — JELENLEGI
EXPECTED_FILES=$(grep -oP '`(lib|tests|src)/[^`]+\.(ts|svelte|js|html)`' "$SPEC_FILE" | ...)
```

**Hiányzó esetek**:
- Projekt gyökér fájlok: `relay.cjs`, `action-processor.cjs`, `generate.cjs`
- `.cjs` kiterjesztés: `relay.cjs`, `action-processor.cjs`
- Config fájlok: `.github/workflows/ci.yml`, `dev-loop.conf.ts`
- Egyéb: `.gitignore`, `.env.example`, stb.

**PKG-054 konkrét példa**: a spec "Érintett fájlok" táblája: `relay.cjs` + `src/lib/core/dev-packages.ts`. A regex csak a `dev-packages.ts`-t fogta be. A `PKG_FILES_PLACEHOLDER` üres volt a relay.cjs-re.

### 2. Deep review nem ellenőriz spec teljességet

A Phase 5 DEEP REVIEW jelenleg:
- ✅ Lint + format
- ✅ Tesztek (pass/fail + coverage)
- ✅ Architecture flag-ek
- ❌ **Spec teljesség**: nincs ellenőrzés hogy a spec "Érintett fájlok" listája = git diff fájljai

## Megoldás

### 1. File extraction regex — bővítés

```bash
# dev-loop.sh — ÚJ regex
EXPECTED_FILES=$(
  grep -oP '`([a-z_.-]+/)*[^`]+\.(ts|svelte|js|html|cjs|yml|gitignore|json)`' "$SPEC_FILE" | 
  sed 's/`//g' | sort -u || true
)
```

Változások:
- `(lib|tests|src)/` → `([a-z_.-]+/)*` (bármilyen path prefix, 0 vagy több szint)
- `(ts|svelte|js|html)` → `(ts|svelte|js|html|cjs|yml|gitignore|json)` (bővített lista)

### 2. Deep review — spec completeness check

```bash
# deep-review.sh — ÚJ step a Phase 5-ben
# 5a: Lint + Format
# 5b: Tests
# 5c: Architecture
# 🆕 5d: Spec completeness

SPEC_FILES=$(grep -oP '`([a-z_.-]+/)*[^`]+\.(ts|svelte|js|html|cjs|yml|gitignore|json)`' \
  "$PROJECT_DIR/dev/packages/$PKG_ID/spec.md" | sed 's/`//g' | sort -u)

DIFF_FILES=$(git diff --name-only HEAD~1 -- '*.ts' '*.svelte' '*.js' '*.html' '*.cjs' '*.yml' | sort -u)

MISSING=$(comm -23 <(echo "$SPEC_FILES") <(echo "$DIFF_FILES"))
EXTRA=$(comm -13 <(echo "$SPEC_FILES") <(echo "$DIFF_FILES"))

if [ -n "$MISSING" ]; then
  echo "❌ SPEC COMPLETENESS FAILED: Missing files from spec:"
  echo "$MISSING"
  exit 1
fi
```

`spec-review-agent.cjs` bővítése ugyanezzel a check-kel.

### 3. Review output — include spec completeness

Az Albert review summary-ben új sor: **Spec Completeness**: ✅ All files present / ❌ Missing: ...

## Érintett fájlok

| Fájl | Művelet |
|------|---------|
| `scripts/dev-loop.sh` | `EXPECTED_FILES` regex bővítése + spec completeness step hozzáadása |
| `scripts/spec-review-agent.cjs` | Spec completeness check bővítés |
| `prompts/cursor-implement.txt` | DONE lista kiegészítése: explicit file-by-file checklist |

## Teszt

1. PKG-054 spec fájlokra futtatva: `EXPECTED_FILES` listában benne van `relay.cjs` ✅
2. PKG-054 diff-re futtatva: spec completeness FAIL → MISSING: `relay.cjs`
3. Jövőbeli PKG: ha missing file van, a deep review FAIL-el és a subagent is látja a hiányt
4. `git diff --name-only` nem ütközik más fájlokkal (csak a PKG fájljait nézi)
