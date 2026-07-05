# PKG-017: Cron Timeline Vizuális + Processor Timer

**🚨 TARGET: SvelteKit — `src/lib/components/tabs/Orchestrator.svelte` + `relay.cjs`**

> ⛔ TILOS az `archive/v4.html`-hez nyúlni!
> A dashboard SvelteKit (adapter-node). Az orchestrator tab már létezik: `src/lib/components/tabs/Orchestrator.svelte`
> A relay `relay.cjs` (nem SvelteKit, ez backend) — ehhez szabad nyúlni az F3-hoz
> Stílus: Svelte `<style>` blokkban, scoped CSS

**Size:** M | **Effort:** 1-2h | **Priority:** P1 | **Status:** spec
**Depends on:** PKG-013 (Provider) ✅ | **Spec date:** 2026-07-05 | **Retry:** 2 (első kísérlet legacy HTML-be ment)

## 🎯 Mit

Két dashboard feature egy csomagban:

### F1: ⏰ Cron Timeline Vizuális (24h)

Az orchestrator tabon a jelenlegi táblázatos cron pipeline helyett **függőleges vizuális timeline**:

- **24 órás skála**, fentről lefelé kronologikus sorrendben
- **NOW indikátor** — jól látható, piros pulzáló vonal az aktuális időnél
- **Minden cron egy sor**, mutatva: időpont, emoji/ikon, név, következő futás countdown ("in 43m", "in 2h 15m")
- **Státusz színkód**: zöld (OK) / sárga (warning) / piros (error) bal oldali border
- **Auto-scroll NOW gomb** — egy kattintással a jelenlegi időhöz ugrik
- **Section headerek**: ÉJSZAKA / REGGEL / NAPPAL / ESTE
- **Múltbeli crons** halványítva (opacity 0.45), **jövőbeliek** normál
- **Next-to-run cron** kiemelve (kék border, subtle glow)
- **Hover effekt** a sorokon
- **5 mp-enként auto-frissül** (csak a countdown-ok) — Svelte `onMount`/`onDestroy` + `setInterval`
- **Reszponzív** mobil nézetben is

### F2: ⏱️ Processor Timer

A "📦 Development Packages" kártya **felett** egy jól látható státuszsáv:

- **Épp futó Cursor** → "🖊️ Cursor: PKG-XXX — folyamatban…" (kék)
- **Queue-ban vár** → "⚡ Processor: N elem a sorban — most indul" (zöld)
- **Idle** → "⏳ Processor: idle — következő ellenőrzés Xs múlva" (szürke)
- **Offline** → "❓ Processor: timer offline" (piros)
- 5 mp-enként poll-olja a relay `/next-trigger` és `/running` endpointjait
- Svelte-ben: reaktív store vagy `setInterval` az `onMount`-ban

### F3: Relay `/next-trigger` endpoint (F2-höz szükséges)

A `relay.cjs`-ben új GET endpoint ami visszaadja:
- `next`: a processor következő trigger ideje (ISO timestamp)
- `nextMs`: epoch ms
- `queue`: hány elem van a sorban
- `lastTrigger`: utolsó trigger ideje
- `now`: szerver aktuális ideje

## 📐 Scope

### Mit érint
- `src/lib/components/tabs/Orchestrator.svelte` — Cron Timeline vizuális + Processor Timer sáv
- `relay.cjs` — `/next-trigger` endpoint (ha még nincs)

### Mit NEM érint
- ⛔ `archive/v4.html` — TILOS!
- ⛔ `dashboard.html` — TILOS!
- ⛔ `generate.cjs` — TILOS!
- `src/lib/core/` — semmi

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | CronTimeline komponens — HTML struktúra + CSS + Svelte reaktív cron lista | `src/lib/components/tabs/Orchestrator.svelte` (új szekció) |
| **Phase 2** | CronTimeline — NOW marker, auto-scroll, section headers, színkódok, countdown | `src/lib/components/tabs/Orchestrator.svelte` |
| **Phase 3** | ProcessorTimer sáv — státusz poll, reaktív state, Svelte transition-ök | `src/lib/components/tabs/Orchestrator.svelte` |
| **Phase 4** | Relay `/next-trigger` endpoint (ha még nincs) | `relay.cjs` |
| **Phase 5** | Reszponzív + hover + auto-refresh (5s interval onMount/onDestroy) | `src/lib/components/tabs/Orchestrator.svelte` |
| **Phase 6** | `pnpm check` + `pnpm test` | — |

## 🎨 Design

### Svelte reaktív adat (Orchestrator tab)
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let cronJobs: CronJob[] = [];

  let now = new Date();
  let processorState: 'idle' | 'running' | 'queued' | 'offline' = 'idle';
  let timerInfo: { next?: string; queue?: number } = {};
  let interval: ReturnType<typeof setInterval>;

  $: sortedCrons = /* időrend + szekciók szerint */;
  $: nextCron = /* első jövőbeli cron */;

  onMount(() => {
    interval = setInterval(() => { now = new Date(); pollProcessor(); }, 5000);
  });
  onDestroy(() => clearInterval(interval));

  async function pollProcessor() {
    /* fetch /api/running + /api/next-trigger */
  }
</script>
```

## ✅ Acceptance Criteria

1. Cron Timeline vizuális a jelenlegi táblázat HELYETT az orchestrator tabon
2. NOW vonal piros pulzáló, auto-scroll NOW gomb
3. Section headerek (ÉJSZAKA/REGGEL/NAPPAL/ESTE)
4. Processor Timer sáv élő státusszal (5 mp poll)
5. Relay `/next-trigger` endpoint válaszol
6. `pnpm check` ✅, `pnpm test` ✅
7. ⛔ `archive/v4.html`-hez NEM nyúltunk
