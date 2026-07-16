<script lang="ts">
  import type { CronGanttBlock, CronGanttData } from "$lib/types";

  let { timeline }: { timeline: CronGanttData } = $props();

  const windowMs = $derived(
    Math.max(1, timeline.windowEndMs - timeline.windowStartMs),
  );

  function blockLeft(block: CronGanttBlock): string {
    const offset = block.startMs - timeline.windowStartMs;
    return `${Math.max(0, (offset / windowMs) * 100)}%`;
  }

  function blockWidth(block: CronGanttBlock): string {
    const width = block.endMs - block.startMs;
    return `${Math.max(0.5, (width / windowMs) * 100)}%`;
  }

  function formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<div class="cron-timeline">
  <h3 class="section-title">📊 Cron Health Timeline (24h)</h3>

  {#if timeline.error}
    <p class="empty">No timeline data — {timeline.error}</p>
  {:else if timeline.rows.length === 0}
    <p class="empty">No crons to display.</p>
  {:else}
    <div class="timeline-legend">
      <span class="legend-item"><span class="dot dot-ok"></span> OK</span>
      <span class="legend-item"><span class="dot dot-error"></span> Error</span>
      <span class="legend-item"><span class="dot dot-skipped"></span> Skipped</span>
      <span class="legend-item"><span class="dot dot-unknown"></span> Unknown</span>
    </div>

    <div class="timeline-axis">
      <span>{formatTime(timeline.windowStartMs)}</span>
      <span>{formatTime(timeline.windowEndMs)}</span>
    </div>

    <ul class="timeline-rows">
      {#each timeline.rows as row (row.id)}
        <li class="timeline-row">
          <span class="row-name" title={`${row.name} — ${row.schedule}`}>
            {row.name}
          </span>
          <div class="row-track">
            {#each row.blocks as block (block.startMs)}
              <span
                class="row-block block-{block.status}"
                style:left={blockLeft(block)}
                style:width={blockWidth(block)}
                title={block.label}
              ></span>
            {/each}
            {#if row.blocks.length === 0}
              <span class="row-empty">no runs in window</span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .cron-timeline {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-title {
    font-size: 0.95em;
    color: var(--accent);
    margin: 0;
  }

  .timeline-legend {
    display: flex;
    gap: 14px;
    font-size: 0.82em;
    color: var(--muted);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot-ok,
  .block-ok {
    background: var(--ok);
  }

  .dot-error,
  .block-error {
    background: var(--error);
  }

  .dot-skipped,
  .block-skipped {
    background: var(--muted);
  }

  .dot-unknown,
  .block-unknown {
    background: var(--warn);
  }

  .timeline-axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.78em;
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .timeline-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .timeline-row {
    display: grid;
    grid-template-columns: 160px 1fr;
    align-items: center;
    gap: 10px;
  }

  .row-name {
    font-size: 0.85em;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-track {
    position: relative;
    height: 14px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }

  .row-block {
    position: absolute;
    top: 0;
    height: 100%;
    border-radius: 2px;
    min-width: 2px;
  }

  .row-empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    padding-left: 6px;
    font-size: 0.72em;
    color: var(--muted);
    font-style: italic;
  }

  .empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9em;
    margin: 0;
  }

  @media (max-width: 768px) {
    .timeline-row {
      grid-template-columns: 100px 1fr;
    }

    .row-name {
      font-size: 0.8em;
    }
  }
</style>
