<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy } from "svelte";

  const POLL_MS = 5000;
  const SCROLL_THRESHOLD = 50;
  const STORAGE_KEY = "log-reversed";

  let {
    open = false,
    content = "",
    pkgId = "",
  }: {
    open?: boolean;
    content?: string;
    pkgId?: string;
  } = $props();

  let scrollEl = $state<HTMLDivElement | null>(null);
  let liveContent = $state("");
  let contentHash = $state("");
  let reversed = $state(false);
  let fetchError = $state<string | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let firstOpenScroll = $state(false);

  const displayContent = $derived(
    reversed ? liveContent.split("\n").reverse().join("\n") : liveContent,
  );

  const showEmpty = $derived(!displayContent.trim() && !fetchError);

  function readReversed(): boolean {
    if (!browser) return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  }

  function toggleReversed(): void {
    reversed = !reversed;
    if (browser) {
      localStorage.setItem(STORAGE_KEY, reversed ? "1" : "0");
    }
    requestAnimationFrame(() => scrollToNewest());
  }

  function scrollToNewest(): void {
    const el = scrollEl;
    if (!el) return;
    if (reversed) {
      el.scrollTop = 0;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }

  function isNearNewestEnd(el: HTMLElement): boolean {
    if (reversed) {
      return el.scrollTop <= SCROLL_THRESHOLD;
    }
    return (
      el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD
    );
  }

  async function fetchLog(): Promise<void> {
    if (!pkgId) return;

    const el = scrollEl;
    const shouldAutoScroll =
      el != null && (isNearNewestEnd(el) || !firstOpenScroll);

    try {
      const res = await fetch(`/api/log/${encodeURIComponent(pkgId)}`);
      const body = (await res.json()) as {
        content?: string;
        error?: string;
      };
      const next = body.content ?? "";
      if (next === contentHash) return;

      contentHash = next;
      liveContent = next;
      fetchError = body.error ?? null;

      if (shouldAutoScroll) {
        firstOpenScroll = true;
        requestAnimationFrame(() => scrollToNewest());
      }
    } catch (err) {
      fetchError = String(err);
      if (!liveContent) {
        liveContent = "";
      }
    }
  }

  function stopPoll(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  function startPoll(): void {
    stopPoll();
    void fetchLog();
    pollTimer = setInterval(() => {
      void fetchLog();
    }, POLL_MS);
  }

  $effect(() => {
    reversed = readReversed();
  });

  $effect(() => {
    if (!open || !pkgId) {
      stopPoll();
      if (!open) {
        firstOpenScroll = false;
      }
      return;
    }

    if (content && !liveContent) {
      liveContent = content;
      contentHash = content;
    }

    startPoll();
    requestAnimationFrame(() => scrollToNewest());

    return () => {
      stopPoll();
    };
  });

  $effect(() => {
    if (!open || !content || content === contentHash) return;

    const el = scrollEl;
    const shouldAutoScroll = el != null && isNearNewestEnd(el);

    contentHash = content;
    liveContent = content;

    if (shouldAutoScroll) {
      requestAnimationFrame(() => scrollToNewest());
    }
  });

  onDestroy(() => {
    stopPoll();
  });
</script>

{#if open}
  <div class="log-panel-wrap">
    <div class="log-panel-toolbar">
      <button
        type="button"
        class="reverse-btn"
        title={reversed ? "Legújabb felül (↑)" : "Legrégebbi felül (↓)"}
        aria-label={reversed ? "Show newest entries first" : "Show oldest entries first"}
        aria-pressed={reversed}
        onclick={toggleReversed}
      >
        {reversed ? "↑" : "↓"}
      </button>
    </div>
    <div
      class="log-panel"
      bind:this={scrollEl}
      role="region"
      aria-label="Cursor log for {pkgId}"
    >
      {#if fetchError && !liveContent.trim()}
        <p class="log-empty">No log data — {fetchError}</p>
      {:else if showEmpty}
        <p class="log-empty">No log data</p>
      {:else}
        <pre>{displayContent}</pre>
      {/if}
    </div>
  </div>
{/if}

<style>
  .log-panel-wrap {
    margin-top: 6px;
  }

  .log-panel-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 4px;
  }

  .reverse-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--muted);
    cursor: pointer;
    font-size: 0.85em;
    line-height: 1;
    padding: 2px 8px;
  }

  .reverse-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .log-panel {
    padding: 8px;
    background: #0a0e14;
    border: 1px solid var(--border);
    border-radius: 6px;
    max-height: 320px;
    overflow-y: auto;
  }

  .log-panel pre {
    font-family: "Fira Code", "Cascadia Code", monospace;
    font-size: 0.78em;
    color: var(--muted);
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.5;
    margin: 0;
  }

  .log-empty {
    color: var(--muted);
    font-size: 0.85em;
    font-style: italic;
    margin: 0;
  }
</style>
