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

  const buttonLabel = $derived(
    buttonState === "running"
      ? "⏳"
      : buttonState === "done"
        ? "✅"
        : buttonState === "error"
          ? "❌"
          : buttonState === "offline"
            ? "🔌"
            : label,
  );
</script>

<div class="implement-actions">
  <button
    type="button"
    class="implement-btn"
    class:running={buttonState === "running"}
    class:done={buttonState === "done"}
    class:error={buttonState === "error" || buttonState === "offline"}
    disabled={buttonState === "running" || buttonState === "done"}
    onclick={() => onImplement?.()}
  >
    {buttonLabel}
  </button>

  {#if showLogButton}
    <button
      type="button"
      class="log-btn"
      class:active={logOpen}
      title="Kattints a Cursor log megtekintéséhez"
      onclick={(e) => {
        e.stopPropagation();
        onLogToggle?.();
      }}
    >
      📋 Log
    </button>
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

  .implement-btn:disabled {
    cursor: default;
  }

  .implement-btn.running {
    background: var(--yellow);
    opacity: 0.7;
  }

  .implement-btn.done {
    background: var(--accent);
  }

  .implement-btn.error {
    background: var(--red);
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
