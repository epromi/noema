<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";
  import type { LogData, LogEntry, LogFilter } from "$lib/types";

  const POLL_MS = 10_000;
  const STORAGE_KEY = "log-reversed";

  let { logs }: { logs: LogData } = $props();

  let liveLogs = $state<LogData | null>(null);
  let activeFilter = $state<LogFilter>("all");
  let reversed = $state(false);
  let logViewerEl = $state<HTMLDivElement | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const resolvedLogs = $derived(liveLogs ?? logs);

  const filteredEntries = $derived(
    activeFilter === "all"
      ? resolvedLogs.entries
      : activeFilter === "errors"
        ? resolvedLogs.entries.filter((entry) => entry.level === "ERROR")
        : resolvedLogs.entries.filter((entry) => entry.level === "WARN"),
  );

  /** Inverted vs LogPanel so default (reversed=false / localStorage "0") shows newest first. */
  const displayEntries = $derived(
    reversed ? filteredEntries : [...filteredEntries].reverse(),
  );

  const FILTERS: { id: LogFilter; label: string; count: number }[] = $derived([
    { id: "all", label: "All", count: resolvedLogs.total },
    { id: "errors", label: "Errors", count: resolvedLogs.counts.error },
    { id: "warnings", label: "Warnings", count: resolvedLogs.counts.warn },
  ]);

  function readReversed(): boolean {
    if (!browser) return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  }

  function toggleReversed(): void {
    reversed = !reversed;
    if (browser) {
      localStorage.setItem(STORAGE_KEY, reversed ? "1" : "0");
    }
  }

  function entriesSignature(entries: LogEntry[]): string {
    if (entries.length === 0) return "";
    const last = entries[entries.length - 1];
    return `${entries.length}:${last?.lineNum ?? 0}:${last?.raw ?? ""}`;
  }

  async function refreshLogs(): Promise<void> {
    const el = logViewerEl;
    const scrollTop = el?.scrollTop ?? 0;
    const scrollHeight = el?.scrollHeight ?? 0;

    try {
      const res = await fetch("/api/logs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = (await res.json()) as LogData;

      const prevSig = entriesSignature(resolvedLogs.entries);
      const nextSig = entriesSignature(next.entries);

      if (prevSig === nextSig && next.error === resolvedLogs.error) return;

      liveLogs = next;

      requestAnimationFrame(() => {
        if (!el) return;
        const delta = el.scrollHeight - scrollHeight;
        el.scrollTop = scrollTop + delta;
      });
    } catch (err) {
      liveLogs = {
        ...resolvedLogs,
        error: String(err),
        updatedAt: Date.now(),
      };
    }
  }

  function levelClass(level: LogEntry["level"]): string {
    switch (level) {
      case "ERROR":
        return "level-error";
      case "WARN":
        return "level-warn";
      case "INFO":
        return "level-info";
      case "DEBUG":
        return "level-debug";
      default:
        return "level-other";
    }
  }

  $effect(() => {
    const incoming = logs;
    if (
      liveLogs == null ||
      entriesSignature(incoming.entries) !== entriesSignature(liveLogs.entries)
    ) {
      liveLogs = incoming;
    }
  });

  onMount(() => {
    reversed = readReversed();
    void refreshLogs();
    pollTimer = setInterval(() => {
      void refreshLogs();
    }, POLL_MS);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });
</script>

<section class="logs-tab">
  <h3 class="section-title">📋 Logs</h3>
  <p class="subtitle">Last 500 lines from ~/.openclaw/logs/</p>

  {#if resolvedLogs.error && resolvedLogs.entries.length === 0}
    <p class="empty">No log data — {resolvedLogs.error}</p>
  {:else}
    <div class="filter-bar" role="toolbar" aria-label="Log filters">
      {#each FILTERS as filter (filter.id)}
        <button
          type="button"
          class="filter-btn"
          class:active={activeFilter === filter.id}
          onclick={() => (activeFilter = filter.id)}
        >
          {filter.label}
          <span class="count">{filter.count}</span>
        </button>
      {/each}
      <button
        type="button"
        class="filter-btn reverse-btn"
        title={reversed ? "Legújabb felül (↑)" : "Legrégebbi felül (↓)"}
        aria-label={reversed ? "Show newest entries first" : "Show oldest entries first"}
        aria-pressed={reversed}
        onclick={toggleReversed}
      >
        {reversed ? "↑" : "↓"}
      </button>
    </div>

    {#if filteredEntries.length === 0}
      <p class="empty">No lines match this filter.</p>
    {:else}
      <div
        class="log-viewer"
        bind:this={logViewerEl}
        role="log"
        aria-live="polite"
      >
        {#each displayEntries as entry (entry.lineNum + entry.raw)}
          <div class="log-line {levelClass(entry.level)}">
            <span class="line-num">{entry.lineNum}</span>
            {#if entry.timestamp}
              <span class="timestamp">{entry.timestamp}</span>
            {/if}
            <span class="level-tag">{entry.level}</span>
            <span class="message">{entry.message}</span>
          </div>
        {/each}
      </div>
    {/if}

    <p class="meta">
      {filteredEntries.length} / {resolvedLogs.total} lines · updated {new Date(
        resolvedLogs.updatedAt,
      ).toLocaleTimeString()}
      {#if resolvedLogs.error}
        · {resolvedLogs.error}
      {/if}
    </p>
  {/if}
</section>

<style>
  .logs-tab {
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
    gap: 8px;
    margin-bottom: 12px;
  }

  .filter-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
    font-size: 0.88em;
    padding: 6px 12px;
  }

  .filter-btn.active {
    border-color: var(--accent);
    color: var(--accent);
  }

  .filter-btn .count {
    color: var(--muted);
    margin-left: 6px;
  }

  .reverse-btn {
    margin-left: auto;
    min-width: 2.5em;
  }

  .log-viewer {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78em;
    max-height: 70vh;
    overflow: auto;
    padding: 8px 0;
  }

  .log-line {
    display: grid;
    grid-template-columns: 48px minmax(80px, auto) 56px 1fr;
    gap: 8px;
    line-height: 1.45;
    padding: 2px 12px;
    word-break: break-word;
  }

  .line-num {
    color: var(--muted);
    text-align: right;
  }

  .timestamp {
    color: var(--muted);
    white-space: nowrap;
  }

  .level-tag {
    font-weight: 600;
    text-transform: uppercase;
  }

  .message {
    white-space: pre-wrap;
  }

  .level-error {
    background: var(--r-bg);
    color: var(--error);
  }

  .level-warn {
    background: var(--y-bg);
    color: var(--warn);
  }

  .level-info {
    color: var(--accent);
  }

  .level-debug,
  .level-other {
    color: var(--muted);
  }

  .empty,
  .meta {
    color: var(--muted);
    font-size: 0.88em;
  }

  .meta {
    margin-top: 10px;
  }

  @media (max-width: 768px) {
    .log-line {
      grid-template-columns: 36px 1fr;
    }

    .timestamp,
    .level-tag {
      display: none;
    }
  }
</style>
