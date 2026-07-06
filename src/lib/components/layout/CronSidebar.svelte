<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";
  import type { CronData, CronEntry } from "$lib/types";
  import {
    computeNextRun,
    formatClock,
    formatCountdown,
    formatTimeLabel,
    isSpanningSched,
    parseDisplayMinutes,
  } from "../../../../lib/cron-schedule.cjs";

  const SIDEBAR_WINDOW_MS = 24 * 60 * 60 * 1000;
  const REFRESH_MS = 30_000;
  const STORAGE_KEY = "cron-sidebar";

  const AGENT_ICONS: Record<string, string> = {
    alfred: "👔",
    porter: "🚪",
    edwin: "🚀",
    scout: "🏕️",
    viktor: "🛡️",
    otto: "🗄️",
    albert: "🔍",
    cortex: "🧠",
    hugo: "📚",
    main: "🏠",
    system: "🤖",
  };

  interface EnrichedCron extends CronEntry {
    displayMin: number;
    nextMs: number | null;
    sortKey: number;
  }

  type SidebarRow =
    | { kind: "now"; key: string; clock: string }
    | {
        kind: "cron";
        key: string;
        cron: EnrichedCron;
        timeLabel: string;
        countdown: string;
        icon: string;
        statusClass: string;
        isPast: boolean;
        isNext: boolean;
      };

  let {
    crons,
    mobile = false,
  }: {
    crons: CronData;
    mobile?: boolean;
  } = $props();

  let collapsed = $state(false);
  let nowMs = $state(Date.now());
  let refreshTimer: ReturnType<typeof setInterval> | undefined;

  const clockLabel = $derived(formatClock(new Date(nowMs)));

  const enrichedCrons = $derived.by((): EnrichedCron[] => {
    const nowDate = new Date(nowMs);
    return crons.crons.map((cron) => {
      const parsed = parseDisplayMinutes(cron.schedule);
      const displayMin = parsed ?? cronSortScore(cron.schedule);
      const lastRun = formatLastRunForSchedule(cron.lastRunAtMs);
      const nextMs =
        cron.nextRunAtMs ??
        computeNextRun(cron.schedule, lastRun, nowDate) ??
        null;
      return {
        ...cron,
        displayMin,
        nextMs,
        sortKey: sidebarSortKey(displayMin, nextMs, cron.schedule, nowMs),
      };
    });
  });

  const nextCronId = $derived.by(() => {
    let nextId: string | null = null;
    let soonest = Infinity;
    for (const cron of enrichedCrons) {
      if (
        cron.nextMs != null &&
        cron.nextMs >= nowMs &&
        cron.nextMs < soonest
      ) {
        soonest = cron.nextMs;
        nextId = cron.id;
      }
    }
    return nextId;
  });

  const sidebarRows = $derived.by((): SidebarRow[] => {
    if (crons.crons.length === 0) return [];

    const nowDate = new Date(nowMs);
    const nowMins =
      nowDate.getHours() * 60 +
      nowDate.getMinutes() +
      nowDate.getSeconds() / 60;

    const inWindow = enrichedCrons.filter((cron) => {
      if (
        cron.nextMs &&
        cron.nextMs >= nowMs &&
        cron.nextMs - nowMs <= SIDEBAR_WINDOW_MS
      ) {
        return true;
      }
      if (
        cron.displayMin < 9999 &&
        !isSpanningSched(cron.schedule) &&
        cron.schedule !== "auto"
      ) {
        if (cron.displayMin >= nowMins - 120) return true;
        if (cron.displayMin < nowMins) return true;
      }
      return false;
    });

    type SortItem =
      | { type: "cron"; sort: number; cron: EnrichedCron }
      | { type: "now"; sort: number };

    const items: SortItem[] = inWindow.map((cron) => ({
      type: "cron",
      sort: cron.sortKey,
      cron,
    }));
    items.push({ type: "now", sort: nowMins });
    items.sort(
      (a, b) =>
        a.sort - b.sort ||
        (a.type === "now" ? 1 : 0) - (b.type === "now" ? 1 : 0),
    );

    const rows: SidebarRow[] = [];

    for (const item of items) {
      if (item.type === "now") {
        rows.push({
          kind: "now",
          key: "now-marker",
          clock: formatClock(nowDate),
        });
        continue;
      }

      const cron = item.cron;
      const isPast =
        !isSpanningSched(cron.schedule) &&
        cron.schedule !== "auto" &&
        cron.displayMin < 9999 &&
        cron.displayMin < nowMins &&
        (!cron.nextMs || cron.nextMs > nowMs + 60_000);

      rows.push({
        kind: "cron",
        key: cron.id,
        cron,
        timeLabel: sidebarTimeLabel(cron),
        countdown: sidebarCountdown(cron, nowMs),
        icon: cronIcon(cron),
        statusClass: cronStatusClass(cron.lastResult),
        isPast,
        isNext: cron.id === nextCronId,
      });
    }

    return rows;
  });

  const collapsedIcons = $derived.by(() => {
    return enrichedCrons
      .filter(
        (cron) =>
          cron.nextMs &&
          cron.nextMs >= nowMs &&
          cron.nextMs - nowMs <= SIDEBAR_WINDOW_MS,
      )
      .sort((a, b) => (a.nextMs ?? 0) - (b.nextMs ?? 0))
      .slice(0, 12);
  });

  function cronSortScore(schedule: string): number {
    if (isSpanningSched(schedule)) return 400;
    if (schedule === "auto") return 9999;
    return 9999;
  }

  function sidebarSortKey(
    displayMin: number,
    nextMs: number | null,
    schedule: string,
    atMs: number,
  ): number {
    if (nextMs && nextMs > atMs && nextMs - atMs <= SIDEBAR_WINDOW_MS) {
      return nextMs;
    }
    if (
      displayMin < 9999 &&
      !isSpanningSched(schedule) &&
      schedule !== "auto"
    ) {
      return displayMin;
    }
    if (nextMs) return nextMs;
    return 999_999;
  }

  function formatLastRunForSchedule(ms: number | undefined): string | null {
    if (ms == null) return null;
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function sidebarTimeLabel(cron: EnrichedCron): string {
    if (
      cron.nextMs &&
      (isSpanningSched(cron.schedule) ||
        cron.schedule === "auto" ||
        cron.displayMin >= 9999)
    ) {
      const d = new Date(cron.nextMs);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    if (cron.displayMin < 9999 && !isSpanningSched(cron.schedule)) {
      return formatTimeLabel(cron.displayMin);
    }
    return "—";
  }

  function sidebarCountdown(cron: EnrichedCron, atMs: number): string {
    if (isSpanningSched(cron.schedule)) {
      return cron.nextMs ? formatCountdown(cron.nextMs, atMs) : "hourly";
    }
    if (cron.schedule === "auto") return "auto";
    return cron.nextMs ? formatCountdown(cron.nextMs, atMs) : "—";
  }

  function cronIcon(cron: CronEntry): string {
    return AGENT_ICONS[cron.agentId] ?? "🤖";
  }

  function cronStatusClass(lastResult: string): string {
    if (lastResult === "ok") return "cr-status-g";
    if (lastResult === "error") return "cr-status-r";
    return "cr-status-y";
  }

  function toggleCollapsed(): void {
    collapsed = !collapsed;
    if (browser) {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    }
  }

  onMount(() => {
    if (browser) {
      collapsed = localStorage.getItem(STORAGE_KEY) === "true";
    }
    refreshTimer = setInterval(() => {
      nowMs = Date.now();
    }, REFRESH_MS);
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
  });
</script>

<aside
  class="cron-sidebar"
  class:collapsed
  class:mobile
  aria-label="Cron pipeline sidebar"
>
  <div class="cs-header">
    {#if !mobile}
      <button
        type="button"
        class="cs-toggle"
        title={collapsed ? "Sidebar kinyitása" : "Sidebar összecsukása"}
        onclick={toggleCollapsed}
      >
        {collapsed ? "▶" : "◀"}
      </button>
    {/if}
    <span class="cs-title">⏰ Cronok</span>
    <span class="cs-clock">{clockLabel}</span>
  </div>

  <div class="cs-scroll">
    {#if crons.error}
      <p class="cs-empty">No cron data — {crons.error}</p>
    {:else if sidebarRows.length === 0}
      <p class="cs-empty">No upcoming crons</p>
    {:else}
      {#each sidebarRows as row (row.key)}
        {#if row.kind === "now"}
          <div class="cr-item now-marker">
            <div class="cr-now-line">▐▐ NOW {row.clock} ▐▐</div>
          </div>
        {:else}
          <div
            class="cr-item {row.statusClass}"
            class:cr-past={row.isPast}
            class:cr-next={row.isNext}
            class:disabled={!row.cron.enabled}
            title={row.cron.name}
          >
            <div class="cr-row">
              <span class="cr-time">{row.timeLabel}</span>
              <span class="cr-icon">{row.icon}</span>
              <span class="cr-name">{row.cron.name}</span>
            </div>
            <div class="cr-countdown">{row.countdown}</div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  {#if !mobile}
    <div class="cs-collapsed-icons">
      {#each collapsedIcons as cron (cron.id)}
        <button type="button" class="cs-icon-btn" title={cron.name}>
          {cronIcon(cron)}
        </button>
      {/each}
    </div>
  {/if}
</aside>

<style>
  .cron-sidebar {
    --blue: var(--accent);
    width: 280px;
    min-width: 280px;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-left: 1px solid var(--border);
    flex-shrink: 0;
    transition:
      width 0.2s,
      min-width 0.2s;
  }

  .cron-sidebar.collapsed {
    width: 40px;
    min-width: 40px;
  }

  .cron-sidebar.mobile {
    position: static;
    width: 100%;
    min-width: 0;
    height: auto;
    max-height: none;
    border-left: none;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .cs-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 8px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.15);
  }

  .cs-toggle {
    cursor: pointer;
    background: var(--bg);
    color: var(--accent);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.75em;
    line-height: 1.2;
    flex-shrink: 0;
  }

  .cs-toggle:hover {
    border-color: var(--accent);
  }

  .cs-title {
    font-weight: 700;
    font-size: 0.88em;
    color: var(--accent);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cs-clock {
    font-family: monospace;
    font-size: 0.72em;
    color: var(--muted);
    white-space: nowrap;
  }

  .cron-sidebar.collapsed .cs-title,
  .cron-sidebar.collapsed .cs-clock {
    display: none;
  }

  .cron-sidebar.collapsed .cs-header {
    justify-content: center;
    padding: 10px 4px;
  }

  .cs-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
  }

  .cron-sidebar.collapsed .cs-scroll {
    display: none;
  }

  .cs-empty {
    padding: 12px;
    color: var(--muted);
    font-size: 0.85em;
  }

  .cs-collapsed-icons {
    display: none;
    flex: 1;
    overflow-y: auto;
    padding: 6px 2px;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .cron-sidebar.collapsed .cs-collapsed-icons {
    display: flex;
  }

  .cs-icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1em;
    padding: 4px;
    line-height: 1;
    border-radius: 4px;
  }

  .cs-icon-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .cr-item {
    padding: 4px 8px 4px 6px;
    border-left: 2px solid transparent;
    margin: 1px 0;
    font-size: 0.82em;
    transition:
      background 0.15s,
      opacity 0.15s;
  }

  .cr-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .cr-item.cr-status-g {
    border-left-color: var(--green);
  }

  .cr-item.cr-status-r {
    border-left-color: var(--red);
  }

  .cr-item.cr-status-y {
    border-left-color: var(--yellow);
  }

  .cr-item.cr-past {
    opacity: 0.45;
  }

  .cr-item.cr-next {
    border-left-color: var(--blue);
    box-shadow: inset 0 0 10px rgba(88, 166, 255, 0.12);
    background: rgba(88, 166, 255, 0.05);
  }

  .cr-item.disabled {
    opacity: 0.55;
  }

  .cr-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .cr-time {
    font-family: monospace;
    color: var(--accent);
    font-weight: 600;
    min-width: 42px;
    flex-shrink: 0;
    font-size: 0.92em;
  }

  .cr-icon {
    flex-shrink: 0;
  }

  .cr-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cr-countdown {
    color: var(--muted);
    font-size: 0.88em;
    padding-left: 48px;
    font-family: monospace;
  }

  .cr-item.now-marker {
    border-top: 2px solid var(--red);
    border-bottom: 2px solid var(--red);
    border-left-color: var(--red);
    background: rgba(248, 81, 73, 0.08);
    padding: 6px 8px;
    margin: 4px 0;
  }

  .cr-now-line {
    text-align: center;
    font-weight: 700;
    font-size: 0.82em;
    color: var(--red);
    animation: cs-now-pulse 2s ease-in-out infinite;
  }

  @keyframes cs-now-pulse {
    0%,
    100% {
      opacity: 1;
      box-shadow: 0 0 0 rgba(248, 81, 73, 0);
    }
    50% {
      opacity: 0.85;
      box-shadow: 0 0 14px rgba(248, 81, 73, 0.35);
    }
  }

  @media (max-width: 900px) {
    .cron-sidebar:not(.mobile) {
      width: 220px;
      min-width: 220px;
    }

    .cron-sidebar:not(.mobile).collapsed {
      width: 40px;
      min-width: 40px;
    }

    .cron-sidebar:not(.mobile) .cr-item {
      font-size: 0.78em;
    }

    .cron-sidebar:not(.mobile) .cr-time {
      min-width: 38px;
    }
  }

  @media (max-width: 599px) {
    .cron-sidebar:not(.mobile) {
      display: none !important;
    }
  }
</style>
