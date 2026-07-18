<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { fade } from "svelte/transition";
  import type { DevJobStatus } from "$lib/types";

  export type ProcessorState = "idle" | "running" | "queued" | "offline";

  let { processorStatus }: { processorStatus: DevJobStatus } = $props();

  let nowMs = $state(Date.now());
  let paintTimer: ReturnType<typeof setInterval> | undefined;

  const processorState = $derived.by((): ProcessorState => {
    if (processorStatus.error) return "offline";
    if (processorStatus.running) return "running";
    if (processorStatus.queue > 0) return "queued";
    return "idle";
  });

  const mainText = $derived.by(() => {
    if (processorState === "running") {
      return `🖊️ Cursor: ${processorStatus.running} — folyamatban…`;
    }
    if (processorState === "queued") {
      return `⚡ Processor: ${processorStatus.queue} elem a sorban — most indul`;
    }
    if (processorState === "offline") {
      return "❓ Processor: timer offline";
    }
    return `⏳ Processor: idle — következő ellenőrzés ${formatProcessorCountdown(processorStatus.nextMs, nowMs)} múlva`;
  });

  const subText = $derived.by(() => {
    if (processorState !== "idle" || processorStatus.nextMs <= 0) return "";
    return `következő trigger: ${formatProcessorCountdown(processorStatus.nextMs, nowMs)}`;
  });

  function formatProcessorCountdown(nextMs: number, atMs: number): string {
    const diff = nextMs - atMs;
    if (nextMs <= 0 || diff <= 0) return "most";
    const secs = Math.ceil(diff / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return rem ? `${mins}m ${rem}s` : `${mins}m`;
  }

  onMount(() => {
    paintTimer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    if (paintTimer) clearInterval(paintTimer);
  });
</script>

<div
  class="processor-timer-bar"
  class:pt-idle={processorState === "idle"}
  class:pt-queue={processorState === "queued"}
  class:pt-running={processorState === "running"}
  class:pt-offline={processorState === "offline"}
  transition:fade={{ duration: 150 }}
  role="status"
  aria-live="polite"
>
  <span class="pt-main">{mainText}</span>
  {#if subText}
    <span class="pt-sub" transition:fade={{ duration: 150 }}>{subText}</span>
  {/if}
</div>

<style>
  .processor-timer-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--card);
    font-size: 0.9em;
    flex-wrap: wrap;
  }

  .processor-timer-bar.pt-idle {
    border-color: var(--border);
    color: var(--muted);
  }

  .processor-timer-bar.pt-queue {
    border-color: var(--green);
    color: var(--green);
  }

  .processor-timer-bar.pt-running {
    border-color: var(--accent);
    color: var(--accent);
  }

  .processor-timer-bar.pt-offline {
    border-color: var(--red);
    color: var(--red);
  }

  .pt-main {
    font-weight: 700;
    flex: 1;
    min-width: 180px;
  }

  .pt-sub {
    font-size: 0.86em;
    opacity: 0.85;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .processor-timer-bar {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
