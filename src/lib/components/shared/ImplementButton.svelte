<script lang="ts">
  import type { ImplementState } from "$lib/types";

  let {
    buttonState = "idle" as ImplementState,
    showLogButton = false,
    logOpen = false,
    label = "▶ Mehet",
    onImplement,
    onLogToggle,
  }: {
    buttonState?: ImplementState;
    showLogButton?: boolean;
    logOpen?: boolean;
    label?: string;
    onImplement?: () => void;
    onLogToggle?: () => void;
  } = $props();
</script>

<div class="implement-actions">
  {#if buttonState === "running"}
    <button
      type="button"
      class="log-btn"
      class:active={logOpen}
      title="Kattints a Cursor log megtekintéséhez"
      aria-label={logOpen ? "Hide Cursor log" : "Show Cursor log"}
      onclick={(e) => {
        e.stopPropagation();
        onLogToggle?.();
      }}
    >
      {logOpen ? "📋 Log ▲" : "📋 Log ▼"}
    </button>
  {:else if buttonState === "done"}
    <span class="done-badge" title="Kész">✅</span>
  {:else}
    <button
      type="button"
      class="implement-btn"
      class:error={buttonState === "error" || buttonState === "offline"}
      aria-label={buttonState === "error" ? "Implementation failed" : buttonState === "offline" ? "Toggle implementation" : "Implement dev package"}
      onclick={() => onImplement?.()}
    >
      {buttonState === "error"
        ? "❌"
        : buttonState === "offline"
          ? "🔌"
          : label}
    </button>
    {#if showLogButton}
      <button
        type="button"
        class="log-btn"
        class:active={logOpen}
        title="Kattints a Cursor log megtekintéséhez"
        aria-label={logOpen ? "Hide Cursor log" : "Show Cursor log"}
        onclick={(e) => {
          e.stopPropagation();
          onLogToggle?.();
        }}
      >
        {logOpen ? "📋 Log ▲" : "📋 Log ▼"}
      </button>
    {/if}
  {/if}
</div>

<style>
  .implement-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .implement-btn {
    cursor: pointer;
    background: var(--green);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 2px 10px;
    font-size: 0.82em;
    font-weight: 700;
    white-space: nowrap;
    opacity: 0.85;
  }

  .implement-btn.error {
    background: var(--red);
  }

  .done-badge {
    font-size: 0.95em;
    line-height: 1;
  }

  .log-btn {
    cursor: pointer;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 0.78em;
    font-weight: 700;
    flex-shrink: 0;
  }

  .log-btn:hover,
  .log-btn.active {
    opacity: 0.85;
  }
</style>
