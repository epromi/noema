<script lang="ts">
  import type { DashboardActionType } from "$lib/types";

  export type ActionBtnState = "idle" | "loading" | "ok" | "error" | "offline";

  export const ACTION_LABELS: Record<DashboardActionType, string> = {
    implement: "▶ Mehet",
    done: "✅ Done",
    escalate: "🔥 Escalate",
    restart: "🔄 Restart",
    trigger: "⚡ Trigger",
    investigate: "🔍 Investigate",
    activate: "🚀 Activate",
    paid: "💰 Paid",
  };

  export const ACTION_TOOLTIPS: Record<DashboardActionType, string> = {
    implement: "Implementálás indítása (Cursor agent)",
    done: "Item lezárása — késznek jelölés",
    escalate: "Eszkalálás Albert-nek vagy más agent-nek",
    restart: "Agent vagy cron újraindítása",
    trigger: "Cron azonnali futtatása",
    investigate: "Kivizsgálás — API és fájl ellenőrzés",
    activate: "Brainstorming item aktiválása",
    paid: "Számla kifizetve — tasks.md frissítés",
  };

  type ActionStyle = "primary" | "warning" | "danger" | "secondary";

  const ACTION_STYLES: Record<DashboardActionType, ActionStyle> = {
    implement: "primary",
    done: "primary",
    escalate: "warning",
    restart: "secondary",
    trigger: "secondary",
    investigate: "secondary",
    activate: "primary",
    paid: "primary",
  };

  let {
    actions,
    itemId,
    description,
    getState,
    onAction,
  }: {
    actions: DashboardActionType[];
    itemId: string;
    description: string;
    getState: (itemId: string, action: DashboardActionType) => ActionBtnState;
    onAction: (
      action: DashboardActionType,
      itemId: string,
      description: string,
    ) => void;
  } = $props();

  function actionKey(id: string, action: DashboardActionType): string {
    return `${id}:${action}`;
  }

  function buttonLabel(
    action: DashboardActionType,
    state: ActionBtnState,
  ): string {
    if (state === "loading") return "⏳";
    if (state === "ok") return "✅";
    if (state === "error") return "❌";
    if (state === "offline") return "🔌";
    return ACTION_LABELS[action];
  }
</script>

<div class="action-group">
  {#each actions as action (actionKey(itemId, action))}
    {@const state = getState(itemId, action)}
    <button
      type="button"
      class="action-btn"
      class:primary={ACTION_STYLES[action] === "primary"}
      class:warning={ACTION_STYLES[action] === "warning"}
      class:danger={ACTION_STYLES[action] === "danger"}
      class:secondary={ACTION_STYLES[action] === "secondary"}
      class:loading={state === "loading"}
      class:ok={state === "ok"}
      class:error={state === "error" || state === "offline"}
      disabled={state === "loading"}
      title={ACTION_TOOLTIPS[action]}
      onclick={() => onAction(action, itemId, description)}
    >
      {buttonLabel(action, state)}
    </button>
  {/each}
</div>

<style>
  .action-group {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .action-btn {
    cursor: pointer;
    border: none;
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 0.78em;
    font-weight: 700;
    white-space: nowrap;
    opacity: 0.85;
  }

  .action-btn:disabled {
    cursor: default;
  }

  .action-btn.primary {
    background: var(--green);
    color: #fff;
  }

  .action-btn.warning {
    background: var(--yellow);
    color: #000;
  }

  .action-btn.danger {
    background: var(--red);
    color: #fff;
  }

  .action-btn.secondary {
    background: var(--border);
    color: var(--text);
  }

  .action-btn.loading {
    background: var(--yellow);
    color: #000;
  }

  .action-btn.ok {
    background: var(--accent);
    color: #fff;
  }

  .action-btn.error {
    background: var(--red);
    color: #fff;
  }

  .action-btn:not(:disabled):hover {
    opacity: 1;
    transform: scale(1.03);
  }
</style>
