<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { fade } from "svelte/transition";
  import ImplementButton from "$lib/components/shared/ImplementButton.svelte";
  import {
    DEFAULT_RELAY_URL,
    getDevJobStatus,
  } from "$lib/core/noema-devjob";
  import type {
    ActionQueueData,
    ActionQueueItem,
    CronData,
    CronEntry,
    CronGroup,
    DashboardActionType,
    DevJobStatus,
    ImplementState,
    OttoRunEntry,
    ResearchData,
  } from "$lib/types";
  import {
    computeNextRun,
    cronPeriod,
    formatClock,
    formatCountdown,
    formatTimeLabel,
    isSpanningSched,
    parseDisplayMinutes,
  } from "../../../../lib/cron-schedule.cjs";

  const RELAY_URL = DEFAULT_RELAY_URL;
  const POLL_MS = 5000;

  let {
    crons,
    research,
    actionQueue,
    packageStates,
    onImplement,
    onLogToggle,
  }: {
    crons: CronData;
    research: ResearchData;
    actionQueue: ActionQueueData;
    packageStates: Record<
      string,
      {
        implementState: ImplementState;
        showLogButton: boolean;
        logOpen: boolean;
        logContent: string;
      }
    >;
    onImplement?: (pkgId: string, name: string) => void;
    onLogToggle?: (pkgId: string) => void;
  } = $props();

  const GROUP_LABELS: Record<CronGroup, string> = {
    NIGHT: "🌙 ÉJSZAKA (00:00–06:00)",
    MORNING: "🌅 REGGEL (06:00–08:00)",
    DAYTIME: "☀️ NAPPAL (08:00–18:00)",
    EVENING: "🌆 ESTE (18:00–24:00)",
    SPANNING: "🔄 AUTOMATIKUS (nincs fix idő)",
  };

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

  const ACTION_LABELS: Record<DashboardActionType, string> = {
    implement: "▶ Mehet",
    done: "✅ Done",
    escalate: "🔥 Escalate",
    restart: "🔄 Restart",
    trigger: "⚡ Trigger",
    investigate: "🔍 Investigate",
    activate: "🚀 Activate",
    paid: "💰 Paid",
  };

  type ActionBtnState = "idle" | "loading" | "ok" | "error" | "offline";
  type ProcessorState = "idle" | "running" | "queued" | "offline";
  type TimelineSection =
    | "night"
    | "morning"
    | "spanning"
    | "day"
    | "evening"
    | "auto";

  interface EnrichedCron extends CronEntry {
    displayMin: number;
    nextMs: number | null;
    section: TimelineSection;
    sortScore: number;
  }

  type TimelineRow =
    | { kind: "hour"; label: string; key: string }
    | { kind: "section"; label: string; count: number; key: string }
    | {
        kind: "now";
        clock: string;
        timeLabel: string;
        key: string;
      }
    | {
        kind: "cron";
        cron: EnrichedCron;
        timeLabel: string;
        countdown: string;
        icon: string;
        statusClass: string;
        isPast: boolean;
        isNext: boolean;
        key: string;
      };

  const SECTION_LABELS: Record<TimelineSection, string> = {
    night: GROUP_LABELS.NIGHT,
    morning: GROUP_LABELS.MORNING,
    spanning: "🌐 EGÉSZ NAP (több időpont / range)",
    day: GROUP_LABELS.DAYTIME,
    evening: GROUP_LABELS.EVENING,
    auto: GROUP_LABELS.SPANNING,
  };

  let actionBtnStates = $state<Record<string, ActionBtnState>>({});
  let nowMs = $state(Date.now());
  let processorStatus = $state<DevJobStatus>({
    nextMs: 0,
    queue: 0,
    running: null,
    updatedAt: 0,
  });
  let timelineScrollEl = $state<HTMLDivElement | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let paintTimer: ReturnType<typeof setInterval> | undefined;

  const processorState = $derived.by((): ProcessorState => {
    if (processorStatus.error) return "offline";
    if (processorStatus.running) return "running";
    if (processorStatus.queue > 0) return "queued";
    return "idle";
  });

  const processorMainText = $derived.by(() => {
    if (processorState === "running") {
      return `🖊️ Cursor: ${processorStatus.running} — folyamatban…`;
    }
    if (processorState === "queued") {
      return `⚡ Processor: ${processorStatus.queue} elem a sorban — most indul`;
    }
    if (processorState === "offline") {
      return "❓ Processor: timer offline";
    }
    return `⏳ Processor: idle — következő ellenőrzés ${formatProcessorCountdown(processorStatus.nextMs, nowMs)} múlva`;
  });

  const processorSubText = $derived.by(() => {
    if (processorState !== "idle" || processorStatus.nextMs <= 0) return "";
    return `következő trigger: ${formatProcessorCountdown(processorStatus.nextMs, nowMs)}`;
  });

  const enrichedCrons = $derived.by((): EnrichedCron[] => {
    const nowDate = new Date(nowMs);
    return crons.crons.map((cron) => {
      const displayMin = parseDisplayMinutes(cron.schedule);
      const lastRun = formatLastRunForSchedule(cron.lastRunAtMs);
      const nextMs =
        cron.nextRunAtMs ??
        computeNextRun(cron.schedule, lastRun, nowDate) ??
        null;
      const sortScore = cronSortScore(cron.schedule, displayMin);
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
      | { type: "cron"; sort: number; cron: EnrichedCron }
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
        const count = enrichedCrons.filter((c) => c.section === cron.section)
          .length;
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
        countdown: cronCountdownLabel(cron, nowMs),
        icon: cronIcon(cron),
        statusClass: cronStatusClass(cron.lastResult),
        isPast,
        isNext,
        key: cron.id,
      });
    }

    return rows;
  });

  function cronSortScore(schedule: string, displayMin: number | null): number {
    if (isSpanningSched(schedule)) return 400;
    if (displayMin == null) return 9999;
    return displayMin;
  }

  function cronSectionFor(
    schedule: string,
    displayMin: number | null,
  ): TimelineSection {
    if (isSpanningSched(schedule)) return "spanning";
    const mins = displayMin ?? 9999;
    if (mins >= 9999) return "auto";
    return cronPeriod(mins) as TimelineSection;
  }

  function formatLastRunForSchedule(ms: number | undefined): string | null {
    if (ms == null) return null;
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function cronCountdownLabel(cron: EnrichedCron, atMs: number): string {
    if (isSpanningSched(cron.schedule)) {
      return cron.nextMs
        ? formatCountdown(cron.nextMs, atMs)
        : "hourly";
    }
    if (cron.schedule === "auto") return "auto";
    return cron.nextMs ? formatCountdown(cron.nextMs, atMs) : "—";
  }

  function cronIcon(cron: CronEntry): string {
    return AGENT_ICONS[cron.agentId] ?? "🤖";
  }

  function cronStatusClass(lastResult: string): string {
    if (lastResult === "ok") return "ct-status-g";
    if (lastResult === "error") return "ct-status-r";
    return "ct-status-y";
  }

  function formatProcessorCountdown(nextMs: number, atMs: number): string {
    const diff = nextMs - atMs;
    if (nextMs <= 0 || diff <= 0) return "most";
    const secs = Math.ceil(diff / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return rem ? `${mins}m ${rem}s` : `${mins}m`;
  }

  async function pollProcessor(): Promise<void> {
    processorStatus = await getDevJobStatus(RELAY_URL);
  }

  function scrollToNow(): void {
    timelineScrollEl
      ?.querySelector("#ct-now-marker")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  onMount(() => {
    void pollProcessor();
    paintTimer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
    pollTimer = setInterval(() => {
      void pollProcessor();
    }, POLL_MS);
  });

  onDestroy(() => {
    if (paintTimer) clearInterval(paintTimer);
    if (pollTimer) clearInterval(pollTimer);
  });

  function ottoIcon(status: OttoRunEntry["status"]): string {
    if (status === "ok") return "✅";
    if (status === "warn") return "⚠️";
    return "❌";
  }

  function actionKey(itemId: string, action: DashboardActionType): string {
    return `${itemId}:${action}`;
  }

  function getActionState(
    itemId: string,
    action: DashboardActionType,
  ): ActionBtnState {
    return actionBtnStates[actionKey(itemId, action)] ?? "idle";
  }

  async function sendAction(
    action: DashboardActionType,
    id: string,
    description: string,
  ): Promise<void> {
    const key = actionKey(id, action);
    actionBtnStates = { ...actionBtnStates, [key]: "loading" };

    try {
      // ⚠️ window.fetch → bypass SvelteKit auto-invalidation on POST
      const res = await window.fetch(`${RELAY_URL}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, description }),
      });
      const body = await res.json();
      actionBtnStates = {
        ...actionBtnStates,
        [key]: body.ok ? "ok" : "error",
      };
      if (body.ok) {
        setTimeout(() => {
          actionBtnStates = { ...actionBtnStates, [key]: "idle" };
        }, 3000);
      } else {
        setTimeout(() => {
          actionBtnStates = { ...actionBtnStates, [key]: "idle" };
        }, 2000);
      }
    } catch {
      actionBtnStates = { ...actionBtnStates, [key]: "offline" };
      setTimeout(() => {
        actionBtnStates = { ...actionBtnStates, [key]: "idle" };
      }, 2000);
    }
  }

  function proposalPriorityColor(priority: string): string {
    if (priority.includes("🔴")) return "var(--red)";
    if (priority.includes("🟡")) return "var(--yellow)";
    return "var(--muted)";
  }

  function kanbanColumns(): {
    key: keyof ActionQueueData;
    title: string;
    items: ActionQueueItem[];
  }[] {
    return [
      { key: "auto", title: "⚡ Auto-resolved", items: actionQueue.auto },
      { key: "alfred", title: "👔 Alfred", items: actionQueue.alfred },
      { key: "andras", title: "🧑 András", items: actionQueue.andras },
    ];
  }
</script>

<section class="orchestrator-tab">
  <!-- F1: Otto Timeline -->
  <h3 class="section-title">⚡ Otto Nightly Runs</h3>
  <div class="card timeline-card">
    {#if research.ottoRuns.length === 0}
      <p class="empty">No timeline data</p>
    {:else}
      <div class="timeline">
        {#each research.ottoRuns as run (run.date)}
          <div
            class="tl-item"
            class:tl-warn={run.status === "warn"}
            class:tl-err={run.status === "err"}
          >
            <div class="tl-head">
              {ottoIcon(run.status)}
              {run.title}
              <span class="tl-date">{run.date}</span>
            </div>
            {#if run.summary}
              <div class="tl-body">{run.summary}</div>
            {/if}
            {#each run.steps as step (`${run.date}-${step.label}`)}
              <div class="tl-sub">
                {step.status === "ok" ? "✅" : "⬜"}
                {step.label}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- F2: Action Queue Kanban -->
  <h3 class="section-title">📋 Action Queue</h3>
  {#if actionQueue.error}
    <p class="empty">Action queue unavailable — {actionQueue.error}</p>
  {:else}
    <div class="kanban">
      {#each kanbanColumns() as col (col.key)}
        <div class="kb-col">
          <h4>{col.title}</h4>
          {#if col.items.length === 0}
            <p class="empty">—</p>
          {:else}
            {#each col.items as item (item.id)}
              <div class="kb-item">
                <div class="kb-id">{item.id}</div>
                <div class="kb-desc">{item.desc}</div>
                <div class="kb-meta">
                  <span>{item.meta}</span>
                  {#if item.actions.length > 0}
                    <div class="action-group">
                      {#each item.actions as action (action)}
                        {@const state = getActionState(item.id, action)}
                        <button
                          type="button"
                          class="action-btn"
                          class:loading={state === "loading"}
                          class:ok={state === "ok"}
                          class:error={state === "error" || state === "offline"}
                          disabled={state === "loading"}
                          title={item.desc}
                          onclick={() => sendAction(action, item.id, item.desc)}
                        >
                          {state === "loading"
                            ? "⏳"
                            : state === "ok"
                              ? "✅"
                              : state === "error"
                                ? "❌"
                                : state === "offline"
                                  ? "🔌"
                                  : ACTION_LABELS[action]}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- F3: Cron Timeline (vertical 24h) -->
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
                <span class="ct-now-line"
                  >▐▐▐▐ NOW {row.clock} ▐▐▐▐</span
                >
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

  <!-- Processor Timer -->
  <div
    class="processor-timer-bar"
    class:pt-idle={processorState === "idle"}
    class:pt-queue={processorState === "queued"}
    class:pt-running={processorState === "running"}
    class:pt-offline={processorState === "offline"}
    transition:fade={{ duration: 150 }}
  >
    <span class="pt-main">{processorMainText}</span>
    {#if processorSubText}
      <span class="pt-sub" transition:fade={{ duration: 150 }}
        >{processorSubText}</span
      >
    {/if}
  </div>

  <!-- F4: Research Proposals -->
  <h3 class="section-title">🧠 Noema Product Research</h3>
  <div class="card research-card">
    {#if research.error}
      <p class="empty">Research unavailable — {research.error}</p>
    {:else if !research.latestDate}
      <p class="empty">⏳ Első futás holnap 01:00-kor. Még nincs adat.</p>
    {:else}
      <div class="research-header">
        <span class="research-date">{research.latestDate}</span>
        {#if research.autoFixCount > 0}
          <span class="badge badge-ok">🔧 {research.autoFixCount} AUTO-FIX</span
          >
        {/if}
        {#if research.proposeCount > 0}
          <span class="badge badge-warn"
            >📋 {research.proposeCount} PROPOSE</span
          >
        {/if}
      </div>
      {#if research.proposals.length === 0}
        <p class="empty">No proposals yet.</p>
      {:else}
        <div class="proposal-list">
          {#each research.proposals as proposal (proposal.id)}
            {@const state = packageStates[proposal.id] ?? {
              implementState: "idle" as ImplementState,
              showLogButton: false,
              logOpen: false,
              logContent: "",
            }}
            <div
              class="proposal-row"
              style:border-left-color={proposalPriorityColor(proposal.priority)}
            >
              <span class="proposal-text"
                >{proposal.priority} {proposal.finding}</span
              >
              {#if proposal.status === "done"}
                <span class="proposal-done">✅ Kész</span>
              {:else if proposal.status === "running"}
                <span class="proposal-running">⏳ Fut...</span>
              {:else}
                <ImplementButton
                  buttonState={state.implementState}
                  showLogButton={state.showLogButton}
                  logOpen={state.logOpen}
                  onImplement={() =>
                    onImplement?.(proposal.id, proposal.finding)}
                  onLogToggle={() => onLogToggle?.(proposal.id)}
                />
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</section>

<style>
  .orchestrator-tab {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-title {
    font-size: 0.95em;
    color: var(--accent);
    margin: 4px 0 0;
  }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
  }

  .timeline-card {
    max-height: 500px;
    overflow-y: auto;
  }

  .timeline {
    position: relative;
    padding-left: 20px;
  }

  .timeline::before {
    content: "";
    position: absolute;
    left: 7px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--border);
  }

  .tl-item {
    position: relative;
    margin-bottom: 14px;
    padding-left: 8px;
  }

  .tl-item::before {
    content: "";
    position: absolute;
    left: -17px;
    top: 4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--green);
    border: 2px solid var(--card);
  }

  .tl-item.tl-warn::before {
    background: var(--yellow);
  }

  .tl-item.tl-err::before {
    background: var(--red);
  }

  .tl-head {
    font-size: 0.9em;
    margin-bottom: 3px;
  }

  .tl-date {
    color: var(--muted);
    margin-left: 6px;
  }

  .tl-body {
    font-size: 0.9em;
    line-height: 1.5;
  }

  .tl-sub {
    font-size: 0.88em;
    color: var(--muted);
    margin-left: 12px;
    padding: 2px 0;
  }

  .kanban {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .kb-col {
    background: rgba(48, 54, 61, 0.3);
    border-radius: 8px;
    padding: 10px;
  }

  .kb-col h4 {
    font-size: 0.9em;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin: 0 0 8px;
  }

  .kb-item {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 6px;
    font-size: 0.92em;
  }

  .kb-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--accent);
    font-size: 0.92em;
  }

  .kb-desc {
    margin: 2px 0;
  }

  .kb-meta {
    color: var(--muted);
    font-size: 0.9em;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
  }

  .action-group {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .action-btn {
    cursor: pointer;
    background: var(--green);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 0.78em;
    font-weight: 700;
    white-space: nowrap;
    opacity: 0.85;
  }

  .action-btn:disabled {
    cursor: default;
  }

  .action-btn.loading {
    background: var(--yellow);
  }

  .action-btn.ok {
    background: var(--accent);
  }

  .action-btn.error {
    background: var(--red);
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

  .processor-timer-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--card);
    font-size: 0.9em;
    flex-wrap: wrap;
  }

  .processor-timer-bar.pt-idle {
    border-color: var(--border);
    color: var(--muted);
  }

  .processor-timer-bar.pt-queue {
    border-color: var(--green);
    color: var(--green);
  }

  .processor-timer-bar.pt-running {
    border-color: var(--accent);
    color: var(--accent);
  }

  .processor-timer-bar.pt-offline {
    border-color: var(--red);
    color: var(--red);
  }

  .pt-main {
    font-weight: 700;
    flex: 1;
    min-width: 180px;
  }

  .pt-sub {
    font-size: 0.86em;
    opacity: 0.85;
    white-space: nowrap;
  }

  .research-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .research-date {
    font-weight: 700;
    color: var(--accent);
  }

  .badge {
    font-size: 0.82em;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .badge-ok {
    background: rgba(63, 185, 80, 0.15);
    color: var(--green);
  }

  .badge-warn {
    background: rgba(210, 153, 34, 0.15);
    color: var(--yellow);
  }

  .proposal-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .proposal-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.88em;
    padding: 4px 8px;
    background: var(--bg);
    border-left: 3px solid var(--muted);
    border-radius: 3px;
    line-height: 1.5;
  }

  .proposal-text {
    flex: 1;
  }

  .proposal-done {
    color: var(--green);
    font-size: 0.82em;
    flex-shrink: 0;
  }

  .proposal-running {
    color: var(--yellow);
    font-size: 0.82em;
    flex-shrink: 0;
  }

  .empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9em;
    margin: 0;
  }

  @media (max-width: 768px) {
    .kanban {
      grid-template-columns: 1fr;
    }

    .ct-row {
      flex-wrap: wrap;
      padding-right: 8px;
    }

    .ct-countdown {
      width: 100%;
      text-align: right;
      padding-left: 54px;
    }

    .processor-timer-bar {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
