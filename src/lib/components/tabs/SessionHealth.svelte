<script lang="ts">
  import type {
    AgentHealthReportData,
    AgentHealthSummary,
    ScoreTrendDirection,
  } from "$lib/types";

  let { report }: { report: AgentHealthReportData } = $props();

  function scoreClass(score: number): "ok" | "warn" | "error" {
    if (score < 40) return "error";
    if (score < 70) return "warn";
    return "ok";
  }

  function scoreEmoji(score: number): string {
    if (score < 40) return "🔴";
    if (score < 70) return "🟡";
    return "🟢";
  }

  function trendIcon(direction: ScoreTrendDirection): string {
    if (direction === "improving") return "↗";
    if (direction === "declining") return "↘";
    return "→";
  }

  function trendLabel(agent: AgentHealthSummary): string {
    if (agent.alert) return "Declining 3+ sessions";
    if (agent.trend === "improving") return "Improving";
    if (agent.trend === "declining") return "Declining";
    return "Stable";
  }

  const sortedAgents = $derived(
    [...report.agents].sort((a, b) => a.averageScore - b.averageScore),
  );
</script>

<section class="health-tab" aria-label="Agent session health scoring">
  <h3 class="section-title">🩺 Agent Session Health</h3>
  <p class="subtitle">
    Rule-based 0–100 score per session — completion, efficiency, error rate,
    loop penalty. No LLM grading.
  </p>

  {#if report.error}
    <p class="empty">No session health data — {report.error}</p>
  {:else if sortedAgents.length === 0}
    <p class="empty">No agent sessions available.</p>
  {:else}
    <div class="agent-grid">
      {#each sortedAgents as agent (agent.agentId)}
        <article
          class="agent-card {scoreClass(agent.averageScore)}"
          class:alert={agent.alert}
          aria-label={`${agent.agentId} health score ${agent.averageScore}`}
        >
          <header class="card-head">
            <span class="agent-id">{agent.agentId}</span>
            <span class="score-pill {scoreClass(agent.averageScore)}">
              {scoreEmoji(agent.averageScore)} {agent.averageScore}
            </span>
          </header>

          <p class="card-meta">
            <span>{agent.sessionCount} session{agent.sessionCount === 1 ? "" : "s"}</span>
            <span class="trend" class:declining={agent.trend === "declining"}>
              {trendIcon(agent.trend)} {trendLabel(agent)}
            </span>
          </p>

          {#if agent.alert}
            <p class="alert-banner" role="alert">
              ⚠️ Score declined 3+ consecutive sessions
            </p>
          {/if}

          {#if agent.latest}
            <ul class="breakdown">
              <li>
                <span>Completion</span>
                <span class={scoreClass(agent.latest.breakdown.completion)}
                  >{agent.latest.breakdown.completion}</span
                >
              </li>
              <li>
                <span>Efficiency</span>
                <span class={scoreClass(agent.latest.breakdown.efficiency)}
                  >{agent.latest.breakdown.efficiency}</span
                >
              </li>
              <li>
                <span>Error rate</span>
                <span class={scoreClass(agent.latest.breakdown.errorRate)}
                  >{agent.latest.breakdown.errorRate}</span
                >
              </li>
              <li>
                <span>Loop penalty</span>
                <span class={scoreClass(agent.latest.breakdown.loopPenalty)}
                  >{agent.latest.breakdown.loopPenalty}</span
                >
              </li>
            </ul>
          {/if}
        </article>
      {/each}
    </div>

    <p class="footer-meta">
      {sortedAgents.length} agent{sortedAgents.length === 1 ? "" : "s"} · updated
      {new Date(report.updatedAt).toLocaleTimeString()}
    </p>
  {/if}
</section>

<style>
  .health-tab {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }

  .section-title {
    font-size: 1.05em;
    margin-bottom: 4px;
  }

  .subtitle {
    color: var(--muted);
    font-size: 0.85em;
    margin-bottom: 14px;
  }

  .agent-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }

  .agent-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-left: 3px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
  }

  .agent-card.ok {
    border-left-color: var(--ok);
  }

  .agent-card.warn {
    border-left-color: var(--warn);
  }

  .agent-card.error {
    border-left-color: var(--error);
  }

  .agent-card.alert {
    outline: 1px dashed var(--error);
  }

  .card-head {
    align-items: center;
    display: flex;
    justify-content: space-between;
  }

  .agent-id {
    font-weight: 600;
    text-transform: capitalize;
  }

  .score-pill {
    border-radius: 999px;
    font-size: 0.85em;
    font-weight: 700;
    padding: 2px 8px;
  }

  .score-pill.ok {
    background: color-mix(in srgb, var(--ok) 15%, transparent);
    color: var(--ok);
  }

  .score-pill.warn {
    background: color-mix(in srgb, var(--warn) 15%, transparent);
    color: var(--warn);
  }

  .score-pill.error {
    background: color-mix(in srgb, var(--error) 15%, transparent);
    color: var(--error);
  }

  .card-meta {
    color: var(--muted);
    display: flex;
    font-size: 0.8em;
    gap: 10px;
    justify-content: space-between;
    margin: 8px 0 0;
  }

  .trend.declining {
    color: var(--error);
    font-weight: 600;
  }

  .alert-banner {
    background: color-mix(in srgb, var(--error) 12%, transparent);
    border: 1px solid var(--error);
    border-radius: 6px;
    color: var(--error);
    font-size: 0.78em;
    margin: 8px 0 0;
    padding: 4px 8px;
  }

  .breakdown {
    display: grid;
    gap: 4px;
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
  }

  .breakdown li {
    display: flex;
    font-size: 0.78em;
    justify-content: space-between;
  }

  .breakdown li span:first-child {
    color: var(--muted);
  }

  .breakdown .ok {
    color: var(--ok);
  }

  .breakdown .warn {
    color: var(--warn);
  }

  .breakdown .error {
    color: var(--error);
  }

  .empty,
  .footer-meta {
    color: var(--muted);
    font-size: 0.88em;
  }

  .footer-meta {
    margin-top: 12px;
  }

  @media (max-width: 768px) {
    .agent-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
