<script lang="ts">
  import { getContext } from "svelte";
  import type { CronData, CronEntry } from "$lib/types";

  let { crons }: { crons: CronData } = $props();

  const agentContext = getContext<{
    selectAgent: (id: string) => void;
  }>("noema-selected-agent");

  function handleAgentSelect(agentId: string, event: MouseEvent) {
    event.stopPropagation();
    agentContext?.selectAgent(agentId);
  }

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

  const sortedCrons = $derived(
    [...crons.crons].sort((a, b) => a.name.localeCompare(b.name)),
  );

  function cronDescription(cron: CronEntry): string {
    return CRON_DESCRIPTIONS[cron.name] ?? "—";
  }

  function formatLastRun(ms: number | undefined): string {
    if (ms == null) return "—";
    const delta = Math.max(0, Date.now() - ms);
    const mins = Math.floor(delta / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function isOk(result: string): boolean {
    return result === "ok";
  }

  function resultLabel(result: string): string {
    return isOk(result) ? "OK" : "Error";
  }

  function resultDotClass(result: string): string {
    return isOk(result) ? "dot-ok" : "dot-error";
  }
</script>

<section class="crons-tab">
  <h3 class="section-title">⏰ Crons</h3>

  {#if crons.error}
    <p class="empty">No cron data — {crons.error}</p>
  {:else if sortedCrons.length === 0}
    <p class="empty">No crons loaded.</p>
  {:else}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Cron</th>
            <th scope="col">Agent</th>
            <th scope="col">Schedule</th>
            <th scope="col">Description</th>
            <th scope="col">Last run</th>
            <th scope="col" class="col-result">Result</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedCrons as cron (cron.id)}
            <tr class:disabled={!cron.enabled}>
              <td class="col-name">{cron.name}</td>
              <td class="col-agent">
                <button
                  type="button"
                  class="agent-link"
                  onclick={(e) => handleAgentSelect(cron.agentId, e)}
                >
                  {cron.agentId}
                </button>
              </td>
              <td class="mono">{cron.schedule}</td>
              <td class="col-desc">{cronDescription(cron)}</td>
              <td class="mono">{formatLastRun(cron.lastRunAtMs)}</td>
              <td class="col-result">
                <span class="status-dot {resultDotClass(cron.lastResult)}"
                ></span>
                {resultLabel(cron.lastResult)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <p class="summary">
      {crons.healthy}/{crons.total} healthy
    </p>
  {/if}
</section>

<style>
  .crons-tab {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-title {
    font-size: 0.95em;
    color: var(--accent);
    margin: 0;
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88em;
  }

  .data-table th,
  .data-table td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }

  .data-table th {
    color: var(--muted);
    font-weight: 500;
    font-size: 0.82em;
    background: rgba(255, 255, 255, 0.02);
  }

  .data-table tbody tr:last-child td {
    border-bottom: none;
  }

  .data-table tbody tr.disabled {
    opacity: 0.55;
  }

  .col-name {
    font-weight: 500;
    white-space: nowrap;
  }

  .col-agent {
    white-space: nowrap;
  }

  .agent-link {
    background: none;
    border: none;
    padding: 0;
    color: var(--accent);
    cursor: pointer;
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .agent-link:hover {
    color: var(--text);
  }

  .col-desc {
    color: var(--muted);
    font-size: 0.92em;
    max-width: 320px;
  }

  .col-result {
    width: 88px;
    white-space: nowrap;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.92em;
    white-space: nowrap;
  }

  .status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
  }

  .dot-ok {
    background: var(--green);
  }

  .dot-error {
    background: var(--red);
  }

  .summary {
    font-size: 0.85em;
    color: var(--muted);
  }

  .empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9em;
  }

  @media (max-width: 768px) {
    .data-table {
      font-size: 0.82em;
    }

    .data-table th,
    .data-table td {
      padding: 8px;
    }

    .col-desc {
      max-width: 180px;
    }
  }
</style>
