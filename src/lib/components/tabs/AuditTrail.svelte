<script lang="ts">
  import type {
    AuditEvent,
    AuditEventFilter,
    AuditEventType,
    AuditTimeRange,
    AuditTrailData,
  } from "$lib/types";

  let { auditTrail }: { auditTrail: AuditTrailData } = $props();

  let sessionFilter = $state("all");
  let agentFilter = $state("all");
  let eventFilter = $state<AuditEventFilter>("all");
  let timeRange = $state<AuditTimeRange>("7d");

  const MS_24H = 24 * 60 * 60 * 1000;
  const MS_7D = 7 * MS_24H;

  function filterEvents(events: AuditEvent[]): AuditEvent[] {
    let result = events;

    if (sessionFilter !== "all") {
      result = result.filter((event) => event.sessionKey === sessionFilter);
    }

    if (agentFilter !== "all") {
      result = result.filter((event) => event.agentId === agentFilter);
    }

    if (eventFilter !== "all") {
      result = result.filter((event) => event.type === eventFilter);
    }

    const now = auditTrail.updatedAt;
    if (timeRange === "24h") {
      const cutoff = now - MS_24H;
      result = result.filter((event) => event.timestampMs >= cutoff);
    } else if (timeRange === "7d") {
      const cutoff = now - MS_7D;
      result = result.filter((event) => event.timestampMs >= cutoff);
    }

    return result;
  }

  const filteredEvents = $derived(filterEvents(auditTrail.events));

  const EVENT_TYPES: { id: AuditEventFilter; label: string }[] = [
    { id: "all", label: "All types" },
    { id: "SESSION_START", label: "Session" },
    { id: "AGENT_SPAWN", label: "Spawn" },
    { id: "CRON_TRIGGER", label: "Cron start" },
    { id: "CRON_COMPLETE", label: "Cron done" },
    { id: "ERROR", label: "Error" },
    { id: "ACTION", label: "Action" },
  ];

  const TIME_RANGES: { id: AuditTimeRange; label: string }[] = [
    { id: "24h", label: "24h" },
    { id: "7d", label: "7d" },
    { id: "all", label: "All" },
  ];

  function typeLabel(type: AuditEventType): string {
    return EVENT_TYPES.find((entry) => entry.id === type)?.label ?? type;
  }

  function eventClass(event: AuditEvent): string {
    return `severity-${event.severity}`;
  }

  function formatTime(ms: number): string {
    return new Date(ms).toLocaleString();
  }
</script>

<section class="audit-tab">
  <h3 class="section-title">📜 Audit Trail</h3>
  <p class="subtitle">
    Chronological activity — sessions, spawns, crons, errors, dashboard actions
  </p>

  {#if auditTrail.error}
    <p class="empty">No audit data — {auditTrail.error}</p>
  {:else}
    <div class="filter-bar" role="toolbar" aria-label="Audit trail filters">
      <label class="filter-group">
        <span>Session</span>
        <select bind:value={sessionFilter}>
          <option value="all">All sessions</option>
          {#each auditTrail.sessions as session (session)}
            <option value={session}>{session}</option>
          {/each}
        </select>
      </label>

      <label class="filter-group">
        <span>Agent</span>
        <select bind:value={agentFilter}>
          <option value="all">All agents</option>
          {#each auditTrail.agents as agent (agent)}
            <option value={agent}>{agent}</option>
          {/each}
        </select>
      </label>

      <label class="filter-group">
        <span>Type</span>
        <select bind:value={eventFilter}>
          {#each EVENT_TYPES as type (type.id)}
            <option value={type.id}>{type.label}</option>
          {/each}
        </select>
      </label>

      <div class="range-group" role="group" aria-label="Time range">
        {#each TIME_RANGES as range (range.id)}
          <button
            type="button"
            class="range-btn"
            class:active={timeRange === range.id}
            onclick={() => (timeRange = range.id)}
          >
            {range.label}
          </button>
        {/each}
      </div>
    </div>

    {#if filteredEvents.length === 0}
      <p class="empty">No events match these filters.</p>
    {:else}
      <ol class="timeline">
        {#each filteredEvents as event (event.id)}
          <li class="timeline-item {eventClass(event)}">
            <time
              class="timestamp"
              datetime={new Date(event.timestampMs).toISOString()}
            >
              {formatTime(event.timestampMs)}
            </time>
            <div class="event-card">
              <div class="event-head">
                <span class="type-tag">{typeLabel(event.type)}</span>
                <strong>{event.title}</strong>
              </div>
              {#if event.detail}
                <p class="detail">{event.detail}</p>
              {/if}
              {#if event.agentId || event.sessionKey}
                <p class="meta-line">
                  {#if event.agentId}
                    <span>{event.agentId}</span>
                  {/if}
                  {#if event.sessionKey}
                    <span>{event.sessionKey}</span>
                  {/if}
                </p>
              {/if}
            </div>
          </li>
        {/each}
      </ol>
    {/if}

    <p class="footer-meta">
      {filteredEvents.length} / {auditTrail.total} events · updated {new Date(
        auditTrail.updatedAt,
      ).toLocaleTimeString()}
    </p>
  {/if}
</section>

<style>
  .audit-tab {
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

  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.78em;
    color: var(--muted);
  }

  .filter-group select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 0.92em;
    min-width: 160px;
    padding: 6px 8px;
  }

  .range-group {
    display: flex;
    align-items: flex-end;
    gap: 6px;
  }

  .range-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
    font-size: 0.88em;
    padding: 7px 12px;
  }

  .range-btn.active {
    border-color: var(--accent);
    color: var(--accent);
  }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .timeline-item {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  .timeline-item:last-child {
    border-bottom: none;
  }

  .timestamp {
    color: var(--muted);
    font-size: 0.78em;
    line-height: 1.4;
    white-space: nowrap;
  }

  .event-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: 6px;
    padding: 10px 12px;
  }

  .severity-error .event-card {
    border-left-color: var(--error);
  }

  .severity-warn .event-card {
    border-left-color: var(--warn);
  }

  .event-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .type-tag {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--muted);
    font-size: 0.72em;
    font-weight: 600;
    padding: 2px 6px;
    text-transform: uppercase;
  }

  .detail {
    color: var(--text);
    font-size: 0.88em;
    margin: 6px 0 0;
    word-break: break-word;
  }

  .meta-line {
    color: var(--muted);
    display: flex;
    flex-wrap: wrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.74em;
    gap: 10px;
    margin: 6px 0 0;
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
    .timeline-item {
      grid-template-columns: 1fr;
    }

    .filter-group select {
      min-width: 120px;
    }
  }
</style>
