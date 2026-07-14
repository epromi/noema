<script lang="ts">
  import type { ResearchData } from "$lib/types";

  let { research }: { research: ResearchData } = $props();

  const recentOttoRuns = $derived(research.ottoRuns.slice(0, 3));

  function ottoIcon(
    status: ResearchData["ottoRuns"][number]["status"],
  ): string {
    if (status === "ok") return "✅";
    if (status === "warn") return "⚠️";
    return "❌";
  }

  function proposalColor(priority: string): string {
    if (priority.includes("🔴")) return "var(--red)";
    if (priority.includes("🟡")) return "var(--yellow)";
    return "var(--muted)";
  }
</script>

<section class="research-tab" aria-label="Dashboard research">
  <h3 class="section-title">🧠 Dashboard Research</h3>

  {#if research.error}
    <p class="empty">Research data unavailable — {research.error}</p>
  {:else}
    <div class="card research-summary">
      <div class="badges">
        {#if research.latestDate}
          <span class="date-badge">{research.latestDate}</span>
        {/if}
        <span class="badge badge-ok">🔧 {research.autoFixCount} AUTO-FIX</span>
        <span class="badge badge-warn">📋 {research.proposeCount} PROPOSE</span>
        <span class="badge badge-purple"
          >💡 {Math.max(0, research.totalFiles - research.recentFiles)} corpus</span
        >
      </div>

      {#if research.proposals.length === 0}
        <p class="empty-inline">
          No proposals yet — Research cron generates them at 01:00.
        </p>
      {:else}
        <div class="proposals">
          {#each research.proposals as proposal (proposal.id)}
            <div
              class="proposal-row"
              style:border-left-color={proposalColor(proposal.priority)}
            >
              <span class="proposal-id">{proposal.id}</span>
              <span class="proposal-text"
                >{proposal.priority} {proposal.finding}</span
              >
              {#if proposal.status}
                <span class="proposal-status">{proposal.status}</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <h3 class="section-title">🧪 Otto Nightly QA</h3>
  <div class="card">
    {#if recentOttoRuns.length === 0}
      <p class="empty">No Otto nightly runs yet</p>
    {:else}
      <div class="otto-list">
        {#each recentOttoRuns as run (run.date)}
          <div
            class="otto-item"
            class:otto-warn={run.status === "warn"}
            class:otto-err={run.status === "err"}
          >
            <div class="otto-head">
              {ottoIcon(run.status)}
              {run.title}
              <span class="otto-date">{run.date}</span>
            </div>
            {#if run.summary}
              <p class="otto-summary">{run.summary}</p>
            {/if}
            {#each run.steps as step (`${run.date}-${step.label}`)}
              <div class="otto-step">
                {step.status === "ok" ? "✅" : "⬜"}
                {step.label}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <h3 class="section-title">📂 Research Corpus</h3>
  <div class="card corpus-card">
    <div class="corpus-stat">
      <span class="corpus-value">{research.totalFiles}</span>
      <span class="corpus-label">total files</span>
    </div>
    <div class="corpus-stat">
      <span class="corpus-value">{research.recentFiles}</span>
      <span class="corpus-label">last 7 days</span>
    </div>
    <div class="corpus-stat">
      <span class="corpus-value">{research.latestDate || "—"}</span>
      <span class="corpus-label">latest noema run</span>
    </div>
  </div>
</section>

<style>
  .research-tab {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-title {
    font-size: 0.95em;
    color: var(--accent);
    font-weight: 600;
  }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  .date-badge {
    font-weight: 700;
    color: var(--accent);
  }

  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 0.85em;
  }

  .badge-ok {
    background: var(--g-bg);
    color: var(--green);
  }

  .badge-warn {
    background: var(--y-bg);
    color: var(--yellow);
  }

  .badge-purple {
    background: color-mix(in srgb, var(--purple) 15%, transparent);
    color: var(--purple);
  }

  .proposals {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .proposal-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 10px;
    background: var(--bg);
    border-left: 3px solid var(--muted);
    border-radius: 4px;
    font-size: 0.88em;
    line-height: 1.5;
  }

  .proposal-id {
    font-family: monospace;
    color: var(--accent);
    flex-shrink: 0;
  }

  .proposal-text {
    flex: 1;
  }

  .proposal-status {
    color: var(--muted);
    font-size: 0.85em;
    flex-shrink: 0;
  }

  .otto-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .otto-item {
    padding: 10px;
    border-radius: 6px;
    background: var(--bg);
    border: 1px solid var(--border);
  }

  .otto-warn {
    border-color: var(--yellow);
  }

  .otto-err {
    border-color: var(--red);
  }

  .otto-head {
    font-weight: 600;
    font-size: 0.92em;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .otto-date {
    color: var(--muted);
    font-size: 0.88em;
    font-weight: 400;
  }

  .otto-summary {
    margin-top: 6px;
    color: var(--muted);
    font-size: 0.88em;
  }

  .otto-step {
    font-size: 0.85em;
    color: var(--muted);
    margin-top: 4px;
    padding-left: 4px;
  }

  .corpus-card {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .corpus-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 8px;
  }

  .corpus-value {
    font-size: 1.3em;
    font-weight: 700;
    color: var(--accent);
  }

  .corpus-label {
    font-size: 0.82em;
    color: var(--muted);
    margin-top: 4px;
  }

  .empty,
  .empty-inline {
    color: var(--muted);
    font-size: 0.92em;
  }

  @media (max-width: 768px) {
    .corpus-card {
      grid-template-columns: 1fr;
    }
  }
</style>
