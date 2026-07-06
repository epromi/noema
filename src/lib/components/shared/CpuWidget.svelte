<script lang="ts">
  import type { CpuData } from "$lib/types";

  let {
    cpu,
    part = "both",
  }: {
    cpu?: CpuData;
    part?: "bar" | "list" | "both";
  } = $props();

  function loadClass(data: CpuData): string {
    const { load1, coreCount } = data;
    if (coreCount <= 0) return "ok";
    if (load1 > coreCount) return "error";
    if (load1 > coreCount * 0.7) return "warn";
    return "ok";
  }

  function formatLoad(data: CpuData): string {
    return `${data.load1.toFixed(2)} ${data.load5.toFixed(2)} ${data.load15.toFixed(2)}`;
  }

  function procLabel(count: number): string {
    return count === 1 ? "1 proc" : `${count} procs`;
  }

  function barWidth(cpuPercent: number, maxCpu: number): string {
    if (maxCpu <= 0) return "0%";
    return `${Math.min(100, (cpuPercent / maxCpu) * 100)}%`;
  }

  const maxCpu = $derived(
    cpu?.topProcesses.reduce((max, p) => Math.max(max, p.cpuPercent), 0) ?? 0,
  );
</script>

{#if cpu && (part === "bar" || part === "both")}
  <span class="sys-item cpu-load {loadClass(cpu)}">
    CPU: {formatLoad(cpu)}
  </span>
  <span class="sys-item">Procs: {cpu.totalProcs}</span>
{/if}

{#if cpu && (part === "list" || part === "both")}
  <div class="cpu-top-card">
    <h3 class="section-title">🔥 Top CPU</h3>
    {#if cpu.topProcesses.length === 0}
      <p class="empty">No processes above 1% CPU.</p>
    {:else}
      <ul class="cpu-list">
        {#each cpu.topProcesses as proc (proc.name)}
          <li class="cpu-row">
            <span class="proc-name" title={proc.name}>{proc.name}</span>
            <span class="proc-meta">
              <span class="proc-cpu">{proc.cpuPercent.toFixed(1)}%</span>
              <span class="proc-count">({procLabel(proc.count)})</span>
              <span class="cpu-bar-track">
                <span
                  class="cpu-bar-fill"
                  style:width={barWidth(proc.cpuPercent, maxCpu)}
                ></span>
              </span>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .cpu-load.ok {
    color: var(--ok);
  }

  .cpu-load.warn {
    color: var(--warn);
  }

  .cpu-load.error {
    color: var(--error);
  }

  .cpu-top-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
  }

  .section-title {
    font-size: 0.95em;
    color: var(--accent);
    margin: 0 0 8px;
  }

  .cpu-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cpu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.88em;
  }

  .proc-name {
    color: var(--text);
    font-weight: 500;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .proc-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .proc-cpu {
    color: var(--text);
    font-variant-numeric: tabular-nums;
    min-width: 3.5em;
    text-align: right;
  }

  .proc-count {
    color: var(--muted);
    font-size: 0.9em;
    min-width: 4.5em;
  }

  .cpu-bar-track {
    display: inline-block;
    width: 48px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .cpu-bar-fill {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
  }

  .empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9em;
    margin: 0;
  }
</style>
