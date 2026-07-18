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
    description = undefined,
    files = undefined,
    phases = undefined,
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
    description?: string;
    files?: string;
    phases?: string;
    implementState?: ImplementState;
    showLogButton?: boolean;
    logOpen?: boolean;
    logContent?: string;
    queueStatus?: QueueStatus | null;
    onImplement?: () => void;
    onLogToggle?: () => void;
  } = $props();

  let detailOpen = $state(false);

  const hasDetail = $derived(Boolean(description || files || phases));

  function toggleDetail(): void {
    if (!hasDetail) return;
    detailOpen = !detailOpen;
  }

  /** Ignore clicks that originate from interactive children (buttons, log panel, detail text). */
  function onRowClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (target?.closest(".pkg-actions, .log-panel-wrap, .pkg-detail")) return;
    toggleDetail();
  }

  function onRowKeydown(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    const target = e.target as HTMLElement | null;
    if (target?.closest(".pkg-actions, .log-panel-wrap, .pkg-detail")) return;
    e.preventDefault();
    toggleDetail();
  }

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

<div
  class="pkg-row"
  class:done
  class:compact
  class:blocked
  class:expanded={detailOpen}
  class:has-detail={hasDetail && !compact}
  onclick={compact ? undefined : onRowClick}
  onkeydown={compact ? undefined : onRowKeydown}
  role="button"
  tabindex={compact ? -1 : 0}
  aria-expanded={detailOpen}
>
  <div class="pkg-main">
    {#if !compact}
      <span class="pkg-chevron" class:invisible={!hasDetail} aria-hidden="true"
        >{detailOpen ? "▾" : "▸"}</span
      >
    {/if}
    <span class="pkg-id">{pkgId}</span>
    {#if compact}
      <span class="pkg-name compact-name" title={name}>{displayName}</span>
      <span
        class="pkg-phase-icon"
        class:phase-running={displayPhase.className === "phase-running"}
        class:phase-queued={displayPhase.className === "phase-queued"}
        title={displayPhase.text}
        aria-hidden="true">{icon}</span
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
        <div class="pkg-actions">
          <ImplementButton
            buttonState={implementState}
            {showLogButton}
            {logOpen}
            {onImplement}
            {onLogToggle}
          />
        </div>
      {/if}
    {/if}
  </div>

  {#if !compact && detailOpen && hasDetail}
    <div class="pkg-detail">
      {#if description}
        <p class="detail-desc">{description}</p>
      {/if}
      {#if files}
        <div class="detail-files">
          <strong>📁 Fájlok:</strong>
          <pre>{files}</pre>
        </div>
      {/if}
      {#if phases}
        <div class="detail-phases">
          <strong>📋 Fázisok:</strong> {phases}
        </div>
      {/if}
    </div>
  {/if}

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

  .pkg-row.has-detail {
    cursor: pointer;
  }

  .pkg-row.has-detail:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .pkg-chevron {
    color: var(--muted);
    flex-shrink: 0;
    font-size: 0.8em;
    width: 1em;
    text-align: center;
  }

  .pkg-chevron.invisible {
    visibility: hidden;
  }

  .pkg-actions {
    display: contents;
  }

  .pkg-detail {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    cursor: default;
  }

  .detail-desc {
    margin: 0 0 6px;
    color: var(--text);
    font-size: 0.88em;
  }

  .detail-files,
  .detail-phases {
    font-size: 0.82em;
    color: var(--muted);
  }

  .detail-files pre {
    margin: 4px 0 0;
    font-family: inherit;
    white-space: pre-wrap;
    word-break: break-word;
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
