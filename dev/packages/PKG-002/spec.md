# PKG-002: Core — Cron Data Module

> Státusz: 📋 Spec kész | Méret: S | 
> Dependencia: PKG-001 (SvelteKit scaffold)

## Spec

**Mit**: `lib/core/crons.ts` — openclaw cron list adatok lekérése, parse-olása, klasszifikációja.
Első core modul. Minden további modul ezt a mintát követi.

**Scope**:
- `src/lib/types/index.ts`: CronEntry, CronData
- `src/lib/core/utils.ts`: exec() helper
- `src/lib/core/crons.ts`: getCrons()
- `tests/core/crons.test.ts`

## Fázisok

### F0 — Spec (~5 perc)
- [ ] Mintának számít → formátum már definiált

### F1 — Core (~45 perc)
- [ ] `src/lib/core/utils.ts`: async exec() wrapper
- [ ] `src/lib/types/index.ts`: CronEntry, CronData, CronGroup típusok
- [ ] `src/lib/core/crons.ts`:
  - `getCrons()` → `exec('openclaw cron list --json')` → parse → classify
  - `classifyCronGroup(schedule)` → NIGHT | MORNING | DAYTIME | EVENING | SPANNING
  - Group statisztika: healthy, total, by group
- [ ] `tests/core/crons.test.ts`: parse teszt, classify teszt
- [ ] `pnpm check` ZÖLD

### F2 — Teszt (~10 perc)
- [ ] `pnpm test` ZÖLD
- [ ] `pnpm build` ZÖLD

### F3 — Merge (~5 perc)
- [ ] Git commit: "🧠 feat: Cron data module (PKG-002)"
- [ ] Push
