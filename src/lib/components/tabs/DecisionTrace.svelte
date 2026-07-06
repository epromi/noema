<script lang="ts">
  import type { DecisionStep, DecisionTraceData } from "$lib/types";

  let { decisionTrace }: { decisionTrace: DecisionTraceData } = $props();

  let selectedSession = $state<string | null>(null);
  let selectedStepId = $state<string | null>(null);

  const activeSessionKey = $derived(
    selectedSession ?? decisionTrace.defaultSessionKey,
  );

  const activeTrace = $derived(
    decisionTrace.traces[activeSessionKey] ?? {
      sessionKey: activeSessionKey,
      steps: [],
      loops: [],
      bottlenecks: [],
      updatedAt: decisionTrace.updatedAt,
    },
  );

  const selectedStep = $derived(
    activeTrace.steps.find((step) => step.id === selectedStepId) ??
      activeTrace.steps[0] ??
      null,
  );

  function selectSession(key: string) {
    selectedSession = key;
    selectedStepId = null;
  }

  function selectStep(step: DecisionStep) {
    selectedStepId = step.id;
  }

  function formatTime(ms: number): string {
    return new Date(ms).toLocaleString();
  }

  function formatLatency(ms: number | undefined): string {
    if (ms == null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function stepClass(step: DecisionStep): string {
    const classes = ["tree-node"];
    if (step.isLoop) classes.push("loop");
    if (step.isBottleneck) classes.push("bottleneck");
    if (selectedStep?.id === step.id) classes.push("selected");
    return classes.join(" ");
  }
</script>

<section class="trace-tab">
  <h3 class="section-title">🌳 Agent Decision Trace</h3>
  <p class="subtitle">
    Tool call decision chain — what ran, in what order, and what triggered the
    next step
  </p>

  {#if decisionTrace.error}
    <p class="empty">No trace data — {decisionTrace.error}</p>
  {:else if decisionTrace.sessions.length === 0}
    <p class="empty">No agent sessions available.</p>
  {:else}
    <div class="session-bar">
      <label class="session-select">
        <span>Session</span>
        <select
          value={activeSessionKey}
          onchange={(event) =>
            selectSession((event.currentTarget as HTMLSelectElement).value)}
        >
          {#each decisionTrace.sessions as session (session.key)}
            <option value={session.key}>{session.label}</option>
          {/each}
        </select>
      </label>

      <div class="session-meta">
        {#if activeTrace.agentId}
          <span class="pill">{activeTrace.agentId}</span>
        {/if}
        <span>{activeTrace.steps.length} tool calls</span>
        {#if activeTrace.loops.length > 0}
          <span class="pill warn">{activeTrace.loops.length} loop(s)</span>
        {/if}
        {#if activeTrace.bottlenecks.length > 0}
          <span class="pill error">{activeTrace.bottlenecks.length} slow</span>
        {/if}
      </div>
    </div>

    {#if activeTrace.error}
      <p class="empty">Could not load trace — {activeTrace.error}</p>
    {:else if activeTrace.steps.length === 0}
      <p class="empty">No tool calls in this session.</p>
    {:else}
      <div class="trace-layout">
        <div class="tree-panel">
          <h4>Decision chain</h4>
          <ol class="decision-tree">
            {#each activeTrace.steps as step (step.id)}
              <li>
                <button
                  type="button"
                  class={stepClass(step)}
                  onclick={() => selectStep(step)}
                >
                  <span class="step-index">#{step.index + 1}</span>
                  <span class="step-tool">{step.toolName}</span>
                  <span class="step-preview">{step.argumentsPreview}</span>
                  {#if step.isLoop}
                    <span class="flag loop-flag">loop</span>
                  {/if}
                  {#if step.isBottleneck}
                    <span class="flag slow-flag">slow</span>
                  {/if}
                </button>
              </li>
            {/each}
          </ol>
        </div>

        <div class="detail-panel">
          <h4>Step details</h4>
          {#if selectedStep}
            <article
              class="step-card"
              class:loop={selectedStep.isLoop}
              class:bottleneck={selectedStep.isBottleneck}
            >
              <header class="card-head">
                <strong>{selectedStep.toolName}</strong>
                <span class="latency"
                  >{formatLatency(selectedStep.latencyMs)}</span
                >
              </header>

              <p class="meta-line">
                <time
                  datetime={new Date(selectedStep.timestampMs).toISOString()}
                >
                  {formatTime(selectedStep.timestampMs)}
                </time>
                {#if selectedStep.triggeredBy}
                  <span>triggered by {selectedStep.triggeredBy}</span>
                {/if}
                {#if selectedStep.isError}
                  <span class="error-tag">error</span>
                {/if}
              </p>

              <div class="field">
                <span class="field-label">Arguments</span>
                <pre>{JSON.stringify(selectedStep.arguments, null, 2)}</pre>
              </div>

              <div class="field">
                <span class="field-label">Output preview</span>
                <pre>{selectedStep.outputPreview}</pre>
              </div>
            </article>
          {:else}
            <p class="empty">Select a step from the chain.</p>
          {/if}

          {#if activeTrace.loops.length > 0}
            <div class="loops-block">
              <h5>Detected loops</h5>
              <ul>
                {#each activeTrace.loops as loop (loop.signature)}
                  <li>
                    <strong>{loop.toolName}</strong> ×{loop.count}
                    <span class="muted">{loop.signature}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <p class="footer-meta">
      {decisionTrace.sessions.length} sessions · updated {new Date(
        decisionTrace.updatedAt,
      ).toLocaleTimeString()}
    </p>
  {/if}
</section>

<style>
  .trace-tab {
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
    margin-bottom: 12px;
  }

  .session-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 14px;
  }

  .session-select {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.78em;
    color: var(--muted);
  }

  .session-select select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 0.92em;
    min-width: 260px;
    padding: 6px 8px;
  }

  .session-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 0.82em;
  }

  .pill {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 0.85em;
    padding: 2px 8px;
  }

  .pill.warn {
    border-color: var(--warn);
    color: var(--warn);
  }

  .pill.error {
    border-color: var(--error);
    color: var(--error);
  }

  .trace-layout {
    display: grid;
    grid-template-columns: minmax(240px, 340px) 1fr;
    gap: 14px;
  }

  .tree-panel,
  .detail-panel {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    min-height: 320px;
  }

  .tree-panel h4,
  .detail-panel h4 {
    font-size: 0.9em;
    margin: 0 0 10px;
  }

  .decision-tree {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .decision-tree li + li {
    margin-top: 6px;
  }

  .tree-node {
    width: 100%;
    text-align: left;
    background: var(--card);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
    display: grid;
    gap: 4px;
    padding: 8px 10px;
  }

  .tree-node.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }

  .tree-node.loop {
    border-color: var(--error);
    border-left-color: var(--error);
  }

  .tree-node.bottleneck {
    outline: 1px dashed var(--warn);
  }

  .step-index {
    color: var(--muted);
    font-size: 0.72em;
    font-weight: 600;
  }

  .step-tool {
    font-weight: 600;
  }

  .step-preview {
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.74em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .flag {
    font-size: 0.68em;
    font-weight: 700;
    justify-self: start;
    padding: 1px 6px;
    text-transform: uppercase;
  }

  .loop-flag {
    background: color-mix(in srgb, var(--error) 15%, transparent);
    border: 1px solid var(--error);
    border-radius: 4px;
    color: var(--error);
  }

  .slow-flag {
    background: color-mix(in srgb, var(--warn) 15%, transparent);
    border: 1px solid var(--warn);
    border-radius: 4px;
    color: var(--warn);
  }

  .step-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: 8px;
    padding: 12px;
  }

  .step-card.loop {
    border-color: var(--error);
    border-left-color: var(--error);
  }

  .step-card.bottleneck {
    outline: 1px dashed var(--warn);
  }

  .card-head {
    align-items: center;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .latency {
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.82em;
  }

  .meta-line {
    color: var(--muted);
    display: flex;
    flex-wrap: wrap;
    font-size: 0.78em;
    gap: 10px;
    margin: 8px 0 12px;
  }

  .error-tag {
    color: var(--error);
    font-weight: 600;
  }

  .field {
    margin-top: 10px;
  }

  .field-label {
    color: var(--muted);
    display: block;
    font-size: 0.72em;
    font-weight: 600;
    margin-bottom: 4px;
    text-transform: uppercase;
  }

  pre {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78em;
    margin: 0;
    max-height: 220px;
    overflow: auto;
    padding: 8px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .loops-block {
    margin-top: 16px;
  }

  .loops-block h5 {
    font-size: 0.82em;
    margin: 0 0 8px;
  }

  .loops-block ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .loops-block li {
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 0;
  }

  .loops-block li:last-child {
    border-bottom: none;
  }

  .muted {
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.72em;
  }

  .empty,
  .footer-meta {
    color: var(--muted);
    font-size: 0.88em;
  }

  .footer-meta {
    margin-top: 10px;
  }

  @media (max-width: 768px) {
    .trace-layout {
      grid-template-columns: 1fr;
    }

    .session-select select {
      min-width: 180px;
    }
  }
</style>
