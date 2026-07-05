<script lang="ts">
  import type { H1Data, H1Program } from "$lib/types";

  let { h1 }: { h1: H1Data } = $props();

  function na(value: string | number | undefined | null): string {
    if (value == null || value === "" || value === "unknown") return "N/A";
    return String(value);
  }

  function signalClass(signal: string): string {
    const n = parseFloat(signal);
    if (Number.isNaN(n)) return "";
    return n >= 0 ? "ok" : "error";
  }

  function programStatus(program: H1Program): string {
    return program.submissionState.replace(/_/g, " ");
  }

  function sortedPrograms(programs: H1Program[]): H1Program[] {
    return [...programs].sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  const programs = $derived(sortedPrograms(h1.programList));
  const hasEarnings = $derived(
    !h1.error && h1.balance !== "unknown" && h1.balanceAmount > 0,
  );
</script>

<section class="h1-tab">
  <h3 class="section-title">🏴 HackerOne</h3>

  {#if h1.error}
    <p class="empty">No H1 data — {h1.error}</p>
  {/if}

  <div class="metrics-bar">
    <div class="metric-card">
      <div class="metric-value">{h1.error ? "N/A" : na(h1.stats.open)}</div>
      <div class="metric-label">Open reports</div>
    </div>

    <div class="metric-card {signalClass(h1.stats.signal)}">
      <div class="metric-value">{h1.error ? "N/A" : na(h1.stats.signal)}</div>
      <div class="metric-label">Signal</div>
    </div>

    <div class="metric-card">
      <div class="metric-value">
        {h1.error ? "N/A" : na(h1.stats.reputation)}
      </div>
      <div class="metric-label">Reputation</div>
    </div>

    <div class="metric-card">
      <div class="metric-value">{h1.error ? "N/A" : na(h1.stats.trial)}</div>
      <div class="metric-label">Trial count</div>
    </div>
  </div>

  <h4 class="subsection-title">Programs</h4>
  {#if programs.length === 0}
    <p class="empty">{h1.error ? "No programs loaded." : h1.programs}</p>
  {:else}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Program</th>
            <th>Handle</th>
            <th>BBP/Non-BBP</th>
            <th>Scope</th>
            <th>Bounty</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {#each programs as program (program.id)}
            <tr class:primary-row={program.primary}>
              <td class="col-name">
                {#if program.primary}<span class="primary-badge"
                    >⭐ PRIMARY</span
                  >{/if}
                {program.name}
              </td>
              <td class="mono">{program.handle}</td>
              <td
                >{program.programType ??
                  (program.offersBounties ? "BBP" : "Non-BBP")}</td
              >
              <td class="muted">{program.scopeType ?? "—"}</td>
              <td
                >{program.bountyRange ??
                  (program.offersBounties ? "BBP" : "Non-BBP")}</td
              >
              <td>{programStatus(program)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if hasEarnings}
    <h4 class="subsection-title">Earnings</h4>
    <div class="earnings-card">
      <div class="earnings-row">
        <span class="lbl">Total earnings</span>
        <span class="val ok-text">{na(h1.balance)}</span>
      </div>
      <div class="earnings-row muted">
        <span class="lbl">Resolved reports</span>
        <span class="val">{h1.stats.resolved}</span>
      </div>
    </div>
  {/if}
</section>

<style>
  .h1-tab {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-title {
    font-size: 0.95em;
    color: var(--accent);
    margin: 0;
  }

  .subsection-title {
    font-size: 0.88em;
    color: var(--muted);
    margin: 4px 0 0;
    font-weight: 500;
  }

  .metrics-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .metric-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    text-align: center;
  }

  .metric-card.ok {
    border-color: var(--green);
    background: var(--g-bg);
  }

  .metric-card.error {
    border-color: var(--red);
    background: var(--r-bg);
  }

  .metric-value {
    font-size: 1.4em;
    font-weight: 600;
    color: var(--text);
  }

  .metric-label {
    font-size: 0.85em;
    color: var(--muted);
    margin-top: 4px;
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
    vertical-align: middle;
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

  .primary-row {
    border-left: 3px solid var(--yellow);
    background: var(--y-bg);
  }

  .primary-badge {
    display: inline-block;
    font-size: 0.78em;
    color: var(--yellow);
    margin-right: 6px;
  }

  .col-name {
    font-weight: 500;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.92em;
  }

  .muted {
    color: var(--muted);
  }

  .earnings-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
  }

  .earnings-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 0.88em;
  }

  .lbl {
    color: var(--muted);
  }

  .val {
    color: var(--text);
    font-weight: 500;
  }

  .ok-text {
    color: var(--green);
  }

  .empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9em;
  }

  @media (max-width: 768px) {
    .metrics-bar {
      grid-template-columns: repeat(2, 1fr);
    }

    .data-table {
      font-size: 0.82em;
    }

    .data-table th,
    .data-table td {
      padding: 8px;
    }
  }
</style>
