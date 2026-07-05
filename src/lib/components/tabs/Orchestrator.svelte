<script lang="ts">
  import ImplementButton from "$lib/components/shared/ImplementButton.svelte";
  import type {
    ActionQueueData,
    ActionQueueItem,
    CronData,
    CronEntry,
    CronGroup,
    DashboardActionType,
    ImplementState,
    OttoRunEntry,
    ResearchData,
  } from "$lib/types";

  const RELAY_URL = "/api";

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

  const CRON_DESCRIPTIONS: Record<string, string> = {
    "Autoresearch Orchestrator":
      "Viktor benchmark loop — blind repo audits, recall stats",
    "Nightly Hacker Intel":
      "Albert — CVE/exploit intelligence, H1 program scanning",
    "Autoexecutor A (02:00)":
      "Action tracker AUTOEXECUTE items (Flash) — off-peak 00-03",
    "Otto Core Analysis": "Memory audit + agent status + KG consistency check",
    "Cortex Pipeline Optimizer":
      "System optimization proposals for Viktor pipeline",
    "Edwin Morning Study": "Capability research: news, self-improvement",
    "Otto Compilation": "Nightly review → Telegram (bilingual metrics)",
    "Nightly Staff Review (Core)":
      "Memory audit + agent status + KG consistency check",
    "Nightly Staff Review (Compile)":
      "Nightly review → Telegram (bilingual metrics)",
    "Porter Hourly Triage":
      "Gmail scan: categorize, bill detection → calendar+tasks",
    "Autoexecutor B (07:00)":
      "Action tracker AUTOEXECUTE items (Flash) — off-peak 06-08",
    "Morning Backup": "Workspace snapshot backup (rsync)",
    "Edwin CCM (7-23)": "Cross-domain pattern detection — silence by default",
    "Daytime Fact Sync": "Fact consolidation from daily logs into SSOT files",
    "Stand-up Prep (Friday)": "Friday scrum stand-up preparation",
    "Stand-up Prep (Tuesday)": "Tuesday scrum stand-up preparation",
    "Week in Review (Friday)": "Weekly review + metrics compilation",
    "Alíz zsebpénz emlékeztető": "Alíz weekly pocket money reminder",
    "Hugo Repo Prep": "Advisory → answer key preparation for Viktor audits",
    "KG Extractor": "Knowledge graph extraction from daily logs",
    "Brainstorming Trigger": "Research-backed action item generation (Flash)",
    "Idle Brainstorming Trigger":
      "Research-backed action item generation (Flash)",
    "Dashboard Refresh (2h)": "Dashboard HTML regeneration from live data",
    "Dashboard Research & Auto-Fix":
      "Dashboard analysis + web research + auto-fix",
    "Nightly Backup": "File-level backup (rsync to dated folder)",
    "KG Weekly Validation": "Knowledge graph weekly audit + dedup",
    "Weekly Strategic Brief": "Edwin weekly strategy briefing",
    "Proactive Compaction": "Session context compaction (automatic trigger)",
    "Mid-day Proactive Compact": "Mid-day session compaction",
    "Proactive Evening Compact": "Evening session compaction",
    "Hourly Email Triage": "Gmail scan: categorize, bill detection",
    "Edwin — Continuous Context Monitor": "Cross-domain pattern detection",
  };

  const GROUP_LABELS: Record<CronGroup, string> = {
    NIGHT: "🌙 ÉJSZAKA (00:00–06:00)",
    MORNING: "🌅 REGGEL (06:00–08:00)",
    DAYTIME: "☀️ NAPPAL (08:00–18:00)",
    EVENING: "🌆 ESTE (18:00–24:00)",
    SPANNING: "🔄 AUTOMATIKUS (nincs fix idő)",
  };

  const GROUP_ORDER: CronGroup[] = [
    "NIGHT",
    "MORNING",
    "SPANNING",
    "DAYTIME",
    "EVENING",
  ];

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

  let actionBtnStates = $state<Record<string, ActionBtnState>>({});

  const nowMinutes = $derived.by(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const nowPercent = $derived((nowMinutes / 1440) * 100);

  const timelineDots = $derived(
    crons.crons
      .map((cron) => {
        const minutes = parseScheduleMinutes(cron.schedule);
        if (minutes == null) return null;
        return {
          cron,
          left: (minutes / 1440) * 100,
          isNight: minutes < 360 || minutes > 1320,
          color:
            cron.lastResult === "ok"
              ? "var(--green)"
              : cron.lastResult === "error"
                ? "var(--red)"
                : "var(--yellow)",
        };
      })
      .filter((d): d is NonNullable<typeof d> => d != null),
  );

  const groupedCrons = $derived.by(() => {
    const groups = new Map<CronGroup, CronEntry[]>();
    for (const group of GROUP_ORDER) {
      const items = crons.crons.filter((c) => c.group === group);
      if (items.length > 0) groups.set(group, items);
    }
    return groups;
  });

  function ottoIcon(status: OttoRunEntry["status"]): string {
    if (status === "ok") return "✅";
    if (status === "warn") return "⚠️";
    return "❌";
  }

  function cronDescription(cron: CronEntry): string {
    return CRON_DESCRIPTIONS[cron.name] ?? "—";
  }

  function parseScheduleMinutes(sched: string): number | null {
    if (!sched || sched === "—" || sched === "auto" || sched === "unknown")
      return null;
    const hm = sched.match(/(\d{1,2}):(\d{2})/);
    if (hm) return parseInt(hm[1] ?? "0", 10) * 60 + parseInt(hm[2] ?? "0", 10);
    const range = sched.match(/^(\d{1,2})-/);
    if (range) return parseInt(range[1] ?? "0", 10) * 60;
    const comma = sched.match(/^(\d{1,2}),/);
    if (comma) return parseInt(comma[1] ?? "0", 10) * 60;
    return null;
  }

  function formatLastRun(ms: number | undefined): string {
    if (ms == null) return "—";
    const delta = Math.max(0, Date.now() - ms);
    const mins = Math.floor(delta / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
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
      const res = await fetch(`${RELAY_URL}/action`, {
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

  <!-- F3: Cron Pipeline -->
  <h3 class="section-title">⏰ Cron Pipeline (24h)</h3>
  {#if crons.error}
    <p class="empty">No cron data — {crons.error}</p>
  {:else}
    <div class="cron-timeline">
      {#each Array.from({ length: 13 }) as _, i (i)}
        {@const hour = i * 2}
        {@const left = (hour / 24) * 100}
        <div class="tl-tick" style:left="{left}%"></div>
        <div class="tl-label" style:left="{left}%">
          {String(hour).padStart(2, "0")}:00
        </div>
      {/each}
      <div class="tl-track"></div>
      <div class="tl-now" style:left="{nowPercent}%"></div>
      {#each timelineDots as dot (dot.cron.id)}
        <div
          class="tl-dot"
          class:night={dot.isNight}
          style:left="{dot.left}%; background: {dot.color}"
          title="{dot.cron.name}: {dot.cron.schedule}"
        ></div>
      {/each}
    </div>

    <div class="table-wrap">
      <table class="pipeline-table">
        <thead>
          <tr>
            <th>⏱️</th>
            <th>Cron</th>
            <th>Agent</th>
            <th>Leírás</th>
            <th>Utolsó</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each GROUP_ORDER as group (group)}
            {@const items = groupedCrons.get(group)}
            {#if items && items.length > 0}
              <tr class="group-hdr">
                <td colspan="6">{GROUP_LABELS[group]} ({items.length})</td>
              </tr>
              {#each items as cron (cron.id)}
                <tr class:disabled={!cron.enabled}>
                  <td class="cr-time">{cron.schedule}</td>
                  <td>{cron.name}</td>
                  <td>{AGENT_ICONS[cron.agentId] ?? "🤖"} {cron.agentId}</td>
                  <td class="cr-desc">{cronDescription(cron)}</td>
                  <td class="mono">{formatLastRun(cron.lastRunAtMs)}</td>
                  <td class="cr-status">
                    <span
                      class="cr-dot"
                      style:background={cron.lastResult === "ok"
                        ? "var(--green)"
                        : cron.lastResult === "error"
                          ? "var(--red)"
                          : "var(--yellow)"}
                    ></span>
                  </td>
                </tr>
              {/each}
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

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

  .cron-timeline {
    position: relative;
    height: 42px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .tl-track {
    position: absolute;
    top: 50%;
    left: 30px;
    right: 10px;
    height: 2px;
    background: var(--border);
    transform: translateY(-50%);
  }

  .tl-tick {
    position: absolute;
    top: 0;
    height: 100%;
    width: 1px;
    background: var(--border);
    opacity: 0.5;
  }

  .tl-label {
    position: absolute;
    top: 2px;
    font-size: 0.75em;
    color: var(--muted);
    transform: translateX(-50%);
  }

  .tl-dot {
    position: absolute;
    top: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    cursor: pointer;
    z-index: 2;
  }

  .tl-dot.night {
    filter: brightness(0.7);
  }

  .tl-now {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--red);
    opacity: 0.85;
    transform: translateX(-50%);
    z-index: 3;
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    max-height: 500px;
    overflow-y: auto;
  }

  .pipeline-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88em;
  }

  .pipeline-table th,
  .pipeline-table td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }

  .pipeline-table th {
    position: sticky;
    top: 0;
    background: var(--card);
    color: var(--muted);
    font-weight: 600;
    font-size: 0.82em;
    z-index: 2;
  }

  .group-hdr td {
    background: var(--card);
    color: var(--accent);
    font-weight: 700;
    font-size: 0.9em;
    padding: 8px 8px 4px;
    border-bottom: 2px solid var(--accent);
  }

  .cr-time {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--accent);
    font-weight: 600;
    white-space: nowrap;
  }

  .cr-desc {
    color: var(--muted);
    font-size: 0.92em;
    max-width: 280px;
  }

  .cr-status {
    text-align: center;
    width: 30px;
  }

  .cr-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.92em;
    white-space: nowrap;
    color: var(--muted);
  }

  .pipeline-table tbody tr.disabled {
    opacity: 0.55;
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

    .cr-desc {
      max-width: 160px;
    }
  }
</style>
