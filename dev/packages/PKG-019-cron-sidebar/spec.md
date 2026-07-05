# PKG-019: Cron Sidebar — Mindig látható oldalsáv

**🚨 TARGET: SvelteKit — `src/lib/components/layout/CronSidebar.svelte` + `src/routes/+layout.svelte`**

> ⛔ TILOS az `archive/v4.html`-hez vagy `dashboard.html`-hez nyúlni!
> A dashboard SvelteKit (adapter-node), nem statikus HTML.
> Komponens: `src/lib/components/layout/CronSidebar.svelte` (ÚJ fájl)
> Integráció: `src/routes/+layout.svelte` — sidebar a `<slot />` mellett
> Stílus: Svelte `<style>` blokkban, scoped CSS

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** spec
**Depends on:** PKG-017 (Cron Timeline) ⏸️ | **Spec date:** 2026-07-05 | **Retry:** 3 (2 korábbi kísérlet LEGACY HTML-be ment)

## 🎯 Mit

A cron pipeline timeline **fix oldalsávban**, mindig látható — bármelyik tab-on vagy. A SvelteKit layout átalakítása: fő tartalom + jobb oldali sidebar.

### F1: Layout átalakítás — sidebar hozzáadása

`+layout.svelte` módosítása: kétoszlopos layout, a `<slot />` mellett a `<CronSidebar />`:

```
┌─────────────────────────────────────────┬──────────────┐
│  🧠 Noema                               │ ⏰ Cronok    │
│  [Tab1] [Tab2] [Tab3] ...               │              │
├─────────────────────────────────────────┤  16:57 ════  │
│                                          │              │
│  [<slot /> — kiválasztott tab]          │  17:00 📋 FS  │
│                                          │     in 3m    │
│                                          │  ...         │
└─────────────────────────────────────────┴──────────────┘
```

### F2: CronSidebar Svelte komponens

Új fájl: `src/lib/components/layout/CronSidebar.svelte`

- **Props**: `cronJobs: CronJob[]` (a layout load-ból jön)
- **Fejléc**: "⏰ Cronok" + mostani idő (reaktívan frissül 30 mp-enként `onMount`/`onDestroy`)
- **NOW vonal**: piros pulzáló indikátor az aktuális időnél
- **Következő 12-24 óra cron-jai**, időrendben
- **Minden sor**: időpont, emoji, rövid név, countdown ("in 3m", "in 1h 15m")
- **Színkód**: OK (zöld bal border), Error (piros), Warning (sárga)
- **Múltbeli**: opacity 0.45
- **Épp következő**: kiemelt (kék glow)

### F3: Reszponzív viselkedés

- **Asztali (>900px)**: sidebar fix 280px
- **Tablet (600-900px)**: sidebar 220px
- **Mobil (<600px)**: sidebar eltűnik, tab-navigációba kerül

### F4: Sidebar toggle

- ◀/▶ gomb — összecsukás/kinyitás
- Összecsukott: 40px, csak ikonok
- Állapot `localStorage`-ban

## 📐 Scope

### Mit érint
- `src/lib/components/layout/CronSidebar.svelte` — **ÚJ** Svelte komponens
- `src/routes/+layout.svelte` — layout: flex container + `<CronSidebar />` a `<slot />` mellett
- `src/routes/+layout.server.ts` — cron data (ha nincs layout load, akkor a page load-ból)

### Mit NEM érint
- ⛔ `archive/v4.html` — TILOS!
- ⛔ `dashboard.html` — TILOS!
- ⛔ `generate.cjs` — TILOS!
- `src/lib/core/` — cron típust használhat, de nem változtat

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | `CronSidebar.svelte` — komponens váz: HTML struktúra + script (props: cronJobs) | `src/lib/components/layout/CronSidebar.svelte` |
| **Phase 2** | CronSidebar — lista render: cron-ok időrendben, countdown, NOW marker, színkódok | `src/lib/components/layout/CronSidebar.svelte` |
| **Phase 3** | CronSidebar — toggle collapse/expand, localStorage persist, auto-refresh 30s | `src/lib/components/layout/CronSidebar.svelte` |
| **Phase 4** | `+layout.svelte` — flex layout + `<CronSidebar>` integrálás, reszponzív | `src/routes/+layout.svelte` |
| **Phase 5** | Reszponzív: mobil tab, tablet 220px | `src/lib/components/layout/CronSidebar.svelte` |
| **Phase 6** | `pnpm check` + `pnpm test` + manuális böngésző teszt | — |

## 🎨 Design

### Svelte komponens
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { CronJob } from '$lib/core/noema';

  export let cronJobs: CronJob[] = [];

  let collapsed = false;
  let now = new Date();
  let interval: ReturnType<typeof setInterval>;

  $: sorted = [...cronJobs].sort((a, b) => (a.nextRun || '').localeCompare(b.nextRun || ''));
  $: upcoming = sorted.filter(c => /* következő 24 óra */);

  onMount(() => {
    collapsed = localStorage.getItem('cron-sidebar') === 'true';
    interval = setInterval(() => now = new Date(), 30000);
  });
  onDestroy(() => clearInterval(interval));

  function toggle() {
    collapsed = !collapsed;
    localStorage.setItem('cron-sidebar', String(collapsed));
  }
</script>
```

### Scoped CSS
```css
.cron-sidebar { width: 280px; min-width: 280px; position: sticky; top: 0; height: 100vh; overflow-y: auto; border-left: 1px solid var(--border); }
.cron-sidebar.collapsed { width: 40px; min-width: 40px; }
.cr-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-left: 2px solid transparent; font-size: 0.82em; }
.cr-item.ok { border-left-color: var(--green); }
.cr-item.error { border-left-color: var(--red); }
.cr-item.warning { border-left-color: var(--orange); }
.cr-item.past { opacity: 0.45; }
.cr-item.next-up { box-shadow: inset 0 0 0 1px var(--blue); }
.now-marker { border-top: 2px solid var(--red); background: rgba(255,80,60,0.08); }
```

### Sidebar cron item
```
┌──────────────────────────────────┐
│ 17:00  📋  Daytime Fact Sync     │ ← border-left: green
│             in 3m                │ ← countdown
│ ─── NOW 16:57 ───               │ ← piros pulzáló
│ 20:00  📚  Hugo Repo Prep        │
│             in 3h 3m             │
└──────────────────────────────────┘
```

## ✅ Acceptance Criteria

1. Sidebar látható minden tab-on (`+layout.svelte`-ben, `<slot />` mellett)
2. CronSidebar Svelte komponens, scoped CSS-sel
3. NOW vonal aktuális időnél, 30 mp-enként frissül
4. Minden cron sor: idő + emoji + név + countdown
5. Toggle működik, localStorage persist
6. Reszponzív: asztali 280px, tablet 220px, mobil tab
7. `pnpm check` ✅, `pnpm test` ✅
8. ⛔ `archive/v4.html`-hez NEM nyúltunk
