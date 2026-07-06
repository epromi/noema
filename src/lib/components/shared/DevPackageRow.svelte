<script lang="ts">
  import LogPanel from "./LogPanel.svelte";
  import ImplementButton from "./ImplementButton.svelte";
  import {
    isBlockedPackage,
    phaseIcon,
    truncateName,
  } from "$lib/core/dev-packages";
  import type { ImplementState, QueueStatus } from "$lib/types";

  let {
    pkgId,
    name,
    phase,
    done = false,
    compact = false,
    implementState = "idle" as ImplementState,
    showLogButton = false,
    logOpen = false,
    logContent = "",
    queueStatus = null,
    onImplement,
    onLogToggle,
  }: {
    pkgId: string;
    name: string;
    phase: string;
    done?: boolean;
    compact?: boolean;
    implementState?: ImplementState;
    showLogButton?: boolean;
    logOpen?: boolean;
    logContent?: string;
    queueStatus?: QueueStatus | null;
    onImplement?: () => void;
    onLogToggle?: () => void;
  } = $props();

  const blocked = $derived(isBlockedPackage({ id: pkgId, name, phase, done }));
  const displayName = $derived(compact ? truncateName(name) : name);
  const icon = $derived(phaseIcon(phase));

  const displayPhase = $derived.by(() => {
    if (queueStatus?.running === pkgId) {
      return { text: "🔄 Fut…", className: "phase-running" };
    }
    if (
      implementState === "running" &&
      queueStatus?.running &&
      queueStatus.running !== pkgId
    ) {
      const pos =
        queueStatus.queuePosition != null
          ? ` (${queueStatus.queuePosition}.)`
          : "";
      return { text: `⏳ Sorban${pos}`, className: "phase-queued" };
    }
    if (implementState === "running" && !queueStatus?.running) {
      return { text: "⏳ Sorban áll", className: "phase-queued" };
    }
    return { text: phase, className: "" };
  });
</script>

<div class="pkg-row" class:done class:compact class:blocked>
  <div class="pkg-main">
    <span class="pkg-id">{pkgId}</span>
    {#if compact}
      <span class="pkg-name compact-name" title={name}>{displayName}</span>
      <span
        class="pkg-phase-icon"
        class:phase-running={displayPhase.className === "phase-running"}
        class:phase-queued={displayPhase.className === "phase-queued"}
        title={displayPhase.text}>{icon}</span
      >
    {:else}
      <span class="pkg-name">{displayName}</span>
      <span
        class="pkg-phase"
        class:phase-running={displayPhase.className === "phase-running"}
        class:phase-queued={displayPhase.className === "phase-queued"}
      >
        {displayPhase.text}
      </span>
      {#if !done}
        <ImplementButton
          buttonState={implementState}
          {showLogButton}
          {logOpen}
          {onImplement}
          {onLogToggle}
        />
      {/if}
    {/if}
  </div>
  {#if !compact}
    <LogPanel open={logOpen} content={logContent} {pkgId} />
  {/if}
</div>

<style>
  .pkg-row {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    background: var(--card);
  }

  .pkg-row.compact {
    padding: 4px 8px;
  }

  .pkg-row.done {
    opacity: 0.7;
  }

  .pkg-row.blocked {
    border-color: var(--orange);
  }

  .pkg-row.blocked .pkg-phase,
  .pkg-row.blocked .pkg-phase-icon {
    color: var(--orange);
  }

  .pkg-main {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .pkg-row.compact .pkg-main {
    gap: 8px;
    flex-wrap: nowrap;
  }

  .pkg-id {
    font-family: monospace;
    font-size: 0.85em;
    color: var(--accent);
    flex-shrink: 0;
  }

  .pkg-name {
    flex: 1;
    min-width: 120px;
    word-break: break-word;
  }

  .compact-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pkg-phase {
    font-size: 0.82em;
    color: var(--muted);
  }

  .pkg-phase.phase-running,
  .pkg-phase-icon.phase-running {
    color: var(--accent);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .pkg-phase.phase-queued,
  .pkg-phase-icon.phase-queued {
    color: var(--yellow);
  }

  .pkg-phase-icon {
    font-size: 0.9em;
    flex-shrink: 0;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }
</style>
