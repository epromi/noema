<script lang="ts">
  import type { AgentEntry } from "$lib/types";

  let {
    agent = null,
    open = false,
    onClose,
  }: {
    agent?: AgentEntry | null;
    open?: boolean;
    onClose?: () => void;
  } = $props();

  function statusClass(status: AgentEntry["status"]): string {
    if (status === "green") return "status-green";
    if (status === "yellow") return "status-yellow";
    return "status-red";
  }

  function logLevelClass(level: string | undefined): string {
    if (level === "ERROR") return "log-error";
    if (level === "WARN") return "log-warn";
    return "log-info";
  }
</script>

{#if open && agent}
  <aside
    class="agent-detail-panel open"
    aria-label="Agent details for {agent.name}"
  >
    <div class="panel-header">
      <h2>{agent.emoji} {agent.name}</h2>
      <button
        type="button"
        class="close-btn"
        aria-label="Close agent details"
        onclick={() => onClose?.()}
      >
        ✕
      </button>
    </div>

    <div class="agent-meta">
      <div class="meta-row">
        <span class="meta-label">Status</span>
        <span class="status {statusClass(agent.status)}">{agent.statusText}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Session</span>
        <span>{agent.sessionStatus}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Role</span>
        <span>{agent.role}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Schedule</span>
        <span>{agent.schedule}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Last run</span>
        <span>{agent.lastRun}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Last active</span>
        <span>{agent.lastActive}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Stale level</span>
        <span>{agent.staleLevel}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Sessions</span>
        <span
          >{agent.sessionsActive} active / {agent.sessionsIdle} idle / {agent.sessionsStuck}
          stuck</span
        >
      </div>
      <div class="meta-row">
        <span class="meta-label">Uptime</span>
        <span>{agent.uptime}</span>
      </div>

      {#if agent.extra}
        <div class="agent-extra">{agent.extra}</div>
      {/if}

      {#if agent.memory}
        <div class="section-block">
          <h3>Memory (status.md)</h3>
          <pre class="memory-block">{agent.memory}</pre>
        </div>
      {/if}

      {#if agent.recentLogs && agent.recentLogs.length > 0}
        <div class="section-block">
          <h3>Recent logs</h3>
          <ul class="log-list">
            {#each agent.recentLogs as log, i (i)}
              <li class={logLevelClass(log.level)}>
                {#if log.timestamp}
                  <span class="log-ts">{log.timestamp}</span>
                {/if}
                {log.message}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </aside>
{:else if open}
  <aside class="agent-detail-panel empty open" aria-label="Agent details">
    <button
      type="button"
      class="close-btn"
      aria-label="Close agent details"
      onclick={() => onClose?.()}
    >
      ✕
    </button>
    <p>Válassz egy agent-et a részletek megtekintéséhez</p>
  </aside>
{/if}

<style>
  .agent-detail-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: min(420px, 100vw);
    height: 100vh;
    background: var(--card);
    border-left: 1px solid var(--border);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.35);
    z-index: 200;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    overflow-y: auto;
    padding: 16px 18px 24px;
  }

  .agent-detail-panel.open {
    transform: translateX(0);
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.15em;
    color: var(--text);
  }

  .close-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--muted);
    border-radius: 6px;
    width: 32px;
    height: 32px;
    cursor: pointer;
    flex-shrink: 0;
    font-size: 1em;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--text);
    border-color: var(--accent);
  }

  .agent-meta {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 0.9em;
  }

  .meta-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .meta-label {
    color: var(--muted);
    font-size: 0.82em;
  }

  .status-green {
    color: var(--green);
  }

  .status-yellow {
    color: var(--yellow);
  }

  .status-red {
    color: var(--red);
  }

  .agent-extra {
    margin-top: 8px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    font-size: 0.88em;
  }

  .section-block {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .section-block h3 {
    margin: 0 0 8px;
    font-size: 0.88em;
    color: var(--accent);
  }

  .memory-block {
    margin: 0;
    padding: 10px;
    background: #0a0e14;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.78em;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--muted);
    max-height: 240px;
    overflow-y: auto;
  }

  .log-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .log-list li {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.76em;
    padding: 6px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.03);
    word-break: break-word;
  }

  .log-ts {
    display: block;
    color: var(--muted);
    margin-bottom: 2px;
  }

  .log-error {
    border-left: 3px solid var(--red);
  }

  .log-warn {
    border-left: 3px solid var(--yellow);
  }

  .log-info {
    border-left: 3px solid var(--green);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    color: var(--muted);
    font-size: 0.9em;
  }

  .empty p {
    margin: 0;
  }

  @media (max-width: 768px) {
    .agent-detail-panel {
      width: 100vw;
      border-left: none;
    }
  }
</style>
