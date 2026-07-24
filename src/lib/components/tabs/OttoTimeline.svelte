<script lang="ts">
  import type { OttoRunEntry } from "$lib/types";

  let { ottoRuns }: { ottoRuns: OttoRunEntry[] } = $props();

  function ottoIcon(status: OttoRunEntry["status"]): string {
    if (status === "ok") return "✅";
    if (status === "warn") return "⚠️";
    return "❌";
  }
</script>

<h3 class="section-title"><span aria-hidden="true">⚡</span> Otto Nightly Runs</h3>
<div class="card timeline-card">
  {#if ottoRuns.length === 0}
    <p class="empty">No timeline data</p>
  {:else}
    <div class="timeline">
      {#each ottoRuns as run (run.date)}
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
              <span aria-hidden="true">{step.status === "ok" ? "✅" : "⬜"}</span>
              {step.label}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
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

  .empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9em;
    margin: 0;
  }
</style>
