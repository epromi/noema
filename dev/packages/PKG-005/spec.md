# PKG-005: Core — HackerOne Data Module

> Státusz: 📋 Spec kész | Méret: M | 
> Dependencia: PKG-002 (core utils)

## Spec

**Mit**: `lib/core/h1.ts` — HackerOne API adatok (programs, reports, earnings, balance).

**Scope**:
- `src/lib/types/index.ts`: H1Program, H1Report, H1Data
- `src/lib/core/h1.ts`: getH1Data()
- `tests/core/h1.test.ts`

## Fázisok

### F0 — Spec (~5 perc)
- [ ] Mintát követi

### F1 — Core (~60 perc)
- [ ] `src/lib/types/index.ts`: H1Program, H1Report, H1Data, H1Stats típusok
- [ ] `src/lib/core/h1.ts`:
  - `getH1Balance()` → `h1.sh balance` parse
  - `getH1Programs()` → `h1.sh programs --json` cache + parse
  - `getH1Reports()` → `h1.sh my-reports` parse
  - `getH1Signal()` → signal + rep calculate-olása
  - `getH1ViktorStatus()` → Viktor state.json parse
  - `getH1Stats()` → összesített: total reports, resolved, duplicates, pending
  - Cache: 1 óra TTL (H1 API rate limit)
- [ ] `tests/core/h1.test.ts`: parse + cache teszt
- [ ] `pnpm check` ZÖLD

### F2 — Teszt (~15 perc)
- [ ] `pnpm test` ZÖLD
- [ ] `pnpm build` ZÖLD
- [ ] Manuális: valós API hívás működik (token megvan)

### F3 — Merge (~5 perc)
- [ ] Git commit: "🧠 feat: HackerOne data module (PKG-005)"
- [ ] Push
