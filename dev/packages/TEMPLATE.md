# PKG-XXX: <cím>

> Státusz: 🔴 Tervezett | 🟡 Folyamatban | 🟢 Kész
> Méret: S | M | L
> Kezdve: YYYY-MM-DD
> Befejezve: YYYY-MM-DD

## Spec

**Mit**: <1-2 mondat>

**Miért**: <1 mondat — milyen roadmap ID-t / felhasználói igényt elégít ki>

**Scope**: <pontos fájlok, amiket érint>

**Out of scope**: <amit NEM csinálunk meg ebben a csomagban>

## Plan

**F0 — Spec** (~15 perc)
- [ ] spec.md megírva
- [ ] plan.md megírva
- [ ] phases.md becslésekkel
- [ ] Scope ellenőrzés: nincs XL, max 5 fájl/fázis

**F1 — Core** (~30-90 perc)
- [ ] Típusdefiníciók (types/index.ts)
- [ ] Core modul(ok) (lib/core/...ts)
- [ ] Unit tesztek (tests/core/...test.ts)
- [ ] pnpm check ZÖLD

**F2 — UI** (~30-90 perc)
- [ ] Svelte komponens(ek) (lib/components/...svelte)
- [ ] Szülő komponens / page frissítése
- [ ] pnpm check ZÖLD

**F3 — Integráció** (~15-30 perc)
- [ ] collector.ts regisztrálás
- [ ] index.ts frissítés
- [ ] API route ha kell
- [ ] pnpm check ZÖLD

**F4 — Teszt** (~15-30 perc)
- [ ] pnpm test ZÖLD
- [ ] pnpm build ZÖLD
- [ ] Manuális ellenőrzés (böngésző)

**F5 — Merge** (~10 perc)
- [ ] Git commit
- [ ] Push
- [ ] Csomag lezárva → státusz 🟢

## Log

| Idő | Fázis | Mi történt |
|-----|-------|------------|
| | | |
