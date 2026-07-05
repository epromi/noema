# PKG-001: SvelteKit Scaffold & Project Setup

> Státusz: 📋 Spec kész | Méret: L | 
> Forrás: Architecture v2 Plan

## Spec

**Mit**: SvelteKit projekt létrehozása, TypeScript konfiguráció, könyvtárstruktúra, dark theme CSS variables, build pipeline. A v2 fejlesztés alapja.

**Scope**:
- `noema-v2/` project root (vagy a meglévő `projects/noema` alatt új struktúra)
- `package.json`, `tsconfig.json`, `svelte.config.js`, `vite.config.ts`
- `src/app.css` — CSS variables, dark theme
- `src/routes/+layout.svelte` — tab navigáció, fejléc
- `src/routes/+page.svelte` — üres dashboard konténer
- `src/routes/+page.ts` — SSR data loading placeholder
- CI frissítése: SvelteKit check + build

**Out of scope**:
- Nincsenek benne core modulok (azok PKG-002..005)
- Nincsenek tab komponensek (későbbi PKG-k)
- Nincs SSE, nincs collector (későbbi PKG-k)

## Fázisok

### F0 — Spec (~10 perc)
- [ ] Végleges döntés: külön `noema-v2/` vagy meglévő `projects/noema` alatt
- [ ] `pnpm create svelte` vagy manuális scaffold

### F1 — Projekt létrehozása (~30 perc)
- [ ] `pnpm create svelte@latest noema-v2` (vagy megfelelő)
- [ ] package.json: SvelteKit + TypeScript + vitest
- [ ] tsconfig.json: strict, noUncheckedIndexedAccess
- [ ] svelte.config.js: adapter-static (SPA mode? vagy SSR? döntés)
- [ ] vite.config.ts: alap konfig
- [ ] `pnpm install && pnpm check` ZÖLD

### F2 — Alap struktúra (~30 perc)
- [ ] Könyvtárstruktúra: `src/lib/core/`, `src/lib/components/`, `src/lib/types/`
- [ ] `src/app.css`: CSS variables dark theme
- [ ] `src/routes/+layout.svelte`: alap layout tab nav-val (placeholder tab-ok)
- [ ] `src/routes/+page.svelte`: üres konténer "Noema 🧠" címmel
- [ ] `pnpm dev` → localhost:5173 működik
- [ ] `pnpm build` ZÖLD

### F3 — CI frissítése (~15 perc)
- [ ] `.github/workflows/ci.yml`: `pnpm check && pnpm build && pnpm test`
- [ ] `.gitignore`: node_modules, build, .svelte-kit
- [ ] `pnpm check` ZÖLD

### F4 — Teszt (~15 perc)
- [ ] `pnpm test` (üres teszt, de fut)
- [ ] `pnpm build` ZÖLD
- [ ] Manuális: localhost:5173 → "Noema 🧠" látszik

### F5 — Merge (~10 perc)
- [ ] Git commit: "🧠 feat: SvelteKit scaffold (PKG-001)"
- [ ] Push
- [ ] PKG-002..005 most már építhető erre
