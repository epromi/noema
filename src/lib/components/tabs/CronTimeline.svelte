<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { CronData, CronEntry, CronGroup, CronTimelineEntry } from "$lib/types";
  import {
    computeCronSortScore,
    computeNextRun,
    cronCountdownLabel,
    cronSectionFor,
    cronStatusClass,
    formatClock,
    formatLastRunForSchedule,
    formatTimeLabel,
    isSpanningSched,
    parseDisplayMinutes,
  } from "$lib/core/cron-utils";
  import { AGENT_ICONS } from "$lib/components/shared/agent-icons";

  const GROUP_LABELS: Record<CronGroup, string> = {
    NIGHT: "🌙 ÉJSZAKA (00:00–06:00)",
    MORNING: "🌅 REGGEL (06:00–08:00)",
    DAYTIME: "☀️ NAPPAL (08:00–18:00)",
    EVENING: "🌆 ESTE (18:00–24:00)",
    SPANNING: "🔄 AUTOMATIKUS (nincs fix idő)",
  };

  const SECTION_LABELS: Record<CronTimelineEntry["section"], string> = {
    night: GROUP_LABELS.NIGHT,
    morning: GROUP_LABELS.MORNING,
    spanning: "🌐 EGÉSZ NAP (több időpont / range)",
    day: GROUP_LABELS.DAYTIME,
    evening: GROUP_LABELS.EVENING,
    auto: GROUP_LABELS.SPANNING,
  };

  type TimelineRow =
    | { kind: "hour"; label: string; key: string }
    | { kind: "section"; label: string; count: number; key: string }
    | { kind: "now"; clock: string; timeLabel: string; key: string }
    | {
        kind: "cron";
        cron: CronTimelineEntry;
        timeLabel: string;
        countdown: string;
        icon: string;
        statusClass: string;
        isPast: boolean;
        isNext: boolean;
        key: string;
      };

  let { crons }: { crons: CronData } = $props();

  let nowMs = $state(Date.now());
  let timelineScrollEl = $state<HTMLDivElement | null>(null);
  let paintTimer: ReturnType<typeof setInterval> | undefined;

  const enrichedCrons = $derived.by((): CronTimelineEntry[] => {
    const nowDate = new Date(nowMs);
    return crons.crons.map((cron) => {
      const displayMin = parseDisplayMinutes(cron.schedule);
      const lastRun = formatLastRunForSchedule(cron.lastRunAtMs);
      const nextMs =
        cron.nextRunAtMs ??
        computeNextRun(cron.schedule, lastRun, nowDate) ??
        null;
      const sortScore = computeCronSortScore(cron.schedule, displayMin);
      return {
        ...cron,
        displayMin: displayMin ?? sortScore,
        nextMs,
        section: cronSectionFor(cron.schedule, displayMin),
        sortScore,
      };
    });
  });

  const nextCronId = $derived.by(() => {
    let nextId: string | null = null;
    let soonest = Infinity;
    for (const cron of enrichedCrons) {
      if (cron.nextMs != null && cron.nextMs < soonest) {
        soonest = cron.nextMs;
        nextId = cron.id;
      }
    }
    return nextId;
  });

  const timelineRows = $derived.by((): TimelineRow[] => {
    if (crons.crons.length === 0) return [];

    const nowDate = new Date(nowMs);
    const nowMins =
      nowDate.getHours() * 60 +
      nowDate.getMinutes() +
      nowDate.getSeconds() / 60;
    const nowClock = formatClock(nowDate);

    type SortItem =
      | { type: "cron"; sort: number; cron: CronTimelineEntry }
      | { type: "now"; sort: number };

    const items: SortItem[] = enrichedCrons.map((cron) => ({
      type: "cron",
      sort: cron.sortScore,
      cron,
    }));
    items.push({ type: "now", sort: nowMins });
    items.sort(
      (a, b) =>
        a.sort - b.sort ||
        (a.type === "now" ? 1 : 0) - (b.type === "now" ? 1 : 0),
    );

    const rows: TimelineRow[] = [];
    let lastHour = -1;
    let lastSection = "";

    for (const item of items) {
      if (item.type === "now") {
        const hour = nowDate.getHours();
        if (hour !== lastHour) {
          rows.push({
            kind: "hour",
            label: `${String(hour).padStart(2, "0")}:00`,
            key: `hour-now-${hour}`,
          });
          lastHour = hour;
        }
        rows.push({
          kind: "now",
          clock: nowClock,
          timeLabel: `${String(nowDate.getHours()).padStart(2, "0")}:${String(nowDate.getMinutes()).padStart(2, "0")}`,
          key: "now-marker",
        });
        continue;
      }

      const cron = item.cron;
      const mins = cron.displayMin;
      const hour = Math.floor(mins / 60);
      if (hour !== lastHour && mins < 9999) {
        rows.push({
          kind: "hour",
          label: formatTimeLabel(mins),
          key: `hour-${hour}-${cron.id}`,
        });
        lastHour = hour;
      }

      if (cron.section !== lastSection) {
        const count = enrichedCrons.filter(
          (c) => c.section === cron.section,
        ).length;
        rows.push({
          kind: "section",
          label: SECTION_LABELS[cron.section],
          count,
          key: `section-${cron.section}`,
        });
        lastSection = cron.section;
      }

      const isPast =
        !isSpanningSched(cron.schedule) &&
        cron.schedule !== "auto" &&
        mins < 9999 &&
        mins < nowMins;
      const isNext = cron.id === nextCronId;

      rows.push({
        kind: "cron",
        cron,
        timeLabel:
          mins < 9999 && !isSpanningSched(cron.schedule)
            ? formatTimeLabel(mins)
            : "",
        countdown: cronCountdownLabel(cron.schedule, cron.nextMs, nowMs),
        icon: cronIcon(cron),
        statusClass: cronStatusClass(cron.lastResult, "ct"),
        isPast,
        isNext,
        key: cron.id,
      });
    }

    return rows;
  });

  function cronIcon(cron: CronEntry): string {
    return AGENT_ICONS[cron.agentId] ?? "🤖";
  }

  function scrollToNow(): void {
    timelineScrollEl
      ?.querySelector("#ct-now-marker")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  onMount(() => {
    paintTimer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    if (paintTimer) clearInterval(paintTimer);
  });
</script>

<div class="cron-timeline-v-wrap">
  <div class="ct-header">
    <h3 class="section-title ct-title">⏰ Cron Timeline (24h)</h3>
    <button
      type="button"
      class="ct-now-btn"
      title="Scroll to current time"
      onclick={scrollToNow}
    >
      📍 NOW
    </button>
  </div>
  <div class="ct-legend">
    <span
      ><span class="ct-leg-dot" style:background="var(--green)"></span> OK</span
    >
    <span
      ><span class="ct-leg-dot" style:background="var(--red)"></span> Error</span
    >
    <span
      ><span class="ct-leg-dot" style:background="var(--yellow)"></span> Warning</span
    >
    <span>🔴 NOW vonal</span>
  </div>
  {#if crons.error}
    <p class="empty">No cron data — {crons.error}</p>
  {:else if crons.crons.length === 0}
    <p class="empty">No scheduled crons</p>
  {:else}
    <div class="cron-timeline-v" bind:this={timelineScrollEl}>
      <div class="ct-scroll">
        {#each timelineRows as row (row.key)}
          {#if row.kind === "hour"}
            <div class="ct-hour">{row.label}</div>
          {:else if row.kind === "section"}
            <div class="ct-section">
              {row.label} — {row.count} cron{row.count === 1 ? "" : "s"}
            </div>
          {:else if row.kind === "now"}
            <div class="ct-now" id="ct-now-marker">
              <span class="ct-time">{row.timeLabel}</span>
              <span class="ct-now-line">▐▐▐▐ NOW {row.clock} ▐▐▐▐</span>
            </div>
          {:else}
            <div
              class="ct-row {row.statusClass}"
              class:ct-past={row.isPast}
              class:ct-next-up={row.isNext}
              class:disabled={!row.cron.enabled}
              title={row.cron.name}
            >
              <span class="ct-time">{row.timeLabel}</span>
              <span class="ct-body">
                <span class="ct-icon">{row.icon}</span>
                <span class="ct-name">{row.cron.name}</span>
                <span class="ct-countdown">{row.countdown}</span>
              </span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .section-title {
    font-size: 0.95em;
    color: var(--accent);
    margin: 4px 0 0;
  }

  .cron-timeline-v-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ct-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .ct-title {
    margin: 0;
  }

  .ct-now-btn {
    cursor: pointer;
    background: var(--card);
    color: var(--accent);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 0.88em;
    font-weight: 700;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .ct-now-btn:hover {
    background: var(--bg);
    border-color: var(--accent);
  }

  .ct-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 0.82em;
    color: var(--muted);
  }

  .ct-legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .ct-leg-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .cron-timeline-v {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    max-height: 520px;
    overflow-y: auto;
    position: relative;
  }

  .ct-scroll {
    padding: 6px 0;
  }

  .ct-hour {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.82em;
    color: var(--muted);
    padding: 2px 10px 2px 12px;
    border-left: 2px solid transparent;
    opacity: 0.55;
  }

  .ct-section {
    padding: 8px 12px 4px;
    font-size: 0.82em;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.4px;
    border-top: 1px solid var(--border);
    background: rgba(88, 166, 255, 0.04);
  }

  .ct-section:first-child {
    border-top: none;
  }

  .ct-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px 6px 0;
    border-left: 3px solid var(--border);
    margin-left: 12px;
    transition:
      background 0.15s,
      opacity 0.15s;
    font-size: 0.9em;
  }

  .ct-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .ct-row.ct-past {
    opacity: 0.45;
  }

  .ct-row.ct-status-g {
    border-left-color: var(--green);
  }

  .ct-row.ct-status-y {
    border-left-color: var(--yellow);
  }

  .ct-row.ct-status-r {
    border-left-color: var(--red);
  }

  .ct-row.ct-next-up {
    border-left-color: var(--accent);
    box-shadow: inset 0 0 12px rgba(88, 166, 255, 0.12);
    background: rgba(88, 166, 255, 0.05);
  }

  .ct-row.disabled {
    opacity: 0.55;
  }

  .ct-time {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--accent);
    font-weight: 600;
    min-width: 46px;
    text-align: right;
    flex-shrink: 0;
    font-size: 0.88em;
  }

  .ct-body {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .ct-icon {
    flex-shrink: 0;
    font-size: 1em;
  }

  .ct-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ct-countdown {
    color: var(--muted);
    font-size: 0.86em;
    white-space: nowrap;
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .ct-now {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px 8px 0;
    margin: 4px 0 4px 12px;
    border-left: 3px solid var(--red);
    position: relative;
  }

  .ct-now-line {
    flex: 1;
    text-align: center;
    font-weight: 700;
    font-size: 0.88em;
    color: var(--red);
    background: linear-gradient(
      90deg,
      transparent,
      rgba(248, 81, 73, 0.15),
      transparent
    );
    padding: 4px 8px;
    border-radius: 4px;
    animation: ct-now-pulse 2s ease-in-out infinite;
  }

  @keyframes ct-now-pulse {
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

  .empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9em;
    margin: 0;
  }

  @media (max-width: 768px) {
    .ct-row {
      flex-wrap: wrap;
      padding-right: 8px;
    }

    .ct-countdown {
      width: 100%;
      text-align: right;
      padding-left: 54px;
    }
  }
</style>
