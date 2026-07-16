<script lang="ts">
  import type { ActionOption, DashboardActionType } from "$lib/types";

  export type ActionBtnState = "idle" | "loading" | "ok" | "error" | "offline";

  export const ACTION_LABELS: Record<DashboardActionType, string> = {
    resolve: "✅ Resolve",
    delegate: "👔 To Alfred",
    investigate: "🔍 Investigate",
    option_a: "A",
    option_b: "B",
    option_c: "C",
    option_d: "D",
    option_e: "E",
    implement: "▶ Mehet",
    done: "✅ Done",
    escalate: "🔥 Escalate",
    restart: "🔄 Restart",
    trigger: "⚡ Trigger",
    activate: "🚀 Activate",
    paid: "💰 Paid",
  };

  export const ACTION_TOOLTIPS: Record<DashboardActionType, string> = {
    resolve: "Döntés megszületett / feladat kész — lezárás",
    delegate: "Átadás Alfred-nak végrehajtásra",
    investigate: "Kivizsgálás indítása (Albert/Scout agent spawn)",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    option_e: "",
    implement: "Implementálás indítása (Cursor agent)",
    done: "Item lezárása (legacy)",
    escalate: "Eszkalálás (legacy)",
    restart: "Agent vagy cron újraindítása",
    trigger: "Cron azonnali futtatása",
    activate: "Brainstorming item aktiválása",
    paid: "Számla kifizetve — tasks.md frissítés",
  };

  type ActionStyle = "primary" | "warning" | "danger" | "secondary";

  const ACTION_STYLES: Record<DashboardActionType, ActionStyle> = {
    resolve: "primary",
    delegate: "secondary",
    investigate: "secondary",
    option_a: "primary",
    option_b: "primary",
    option_c: "primary",
    option_d: "primary",
    option_e: "primary",
    implement: "primary",
    done: "primary",
    escalate: "warning",
    restart: "secondary",
    trigger: "secondary",
    activate: "primary",
    paid: "primary",
  };

  let {
    actions,
    options = [],
    itemId,
    description,
    getState,
    onAction,
  }: {
    actions: DashboardActionType[];
    options?: ActionOption[];
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

  function truncateLabel(label: string, maxLen = 40): string {
    if (label.length <= maxLen) return label;
    return `${label.slice(0, maxLen - 1)}…`;
  }

  function buttonLabel(
    actionOrLabel: DashboardActionType | string,
    state: ActionBtnState,
  ): string {
    if (state === "loading") return "⏳";
    if (state === "ok") return "✅";
    if (state === "error") return "❌";
    if (state === "offline") return "🔌";
    if (
      typeof actionOrLabel === "string" &&
      !(actionOrLabel in ACTION_LABELS)
    ) {
      return truncateLabel(actionOrLabel);
    }
    return ACTION_LABELS[actionOrLabel as DashboardActionType] ?? actionOrLabel;
  }
</script>

<div class="action-group">
  {#if options.length > 0}
    {#each options as opt (opt.key)}
      {@const state = getState(itemId, opt.key as DashboardActionType)}
      <button
        type="button"
        class="action-btn primary option-btn"
        class:loading={state === "loading"}
        class:ok={state === "ok"}
        class:error={state === "error" || state === "offline"}
        disabled={state === "loading"}
        title={opt.label}
        aria-label={opt.label}
        onclick={() =>
          onAction(opt.key as DashboardActionType, itemId, opt.label)}
      >
        {buttonLabel(opt.label, state)}
      </button>
    {/each}
  {:else}
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
        aria-label="{ACTION_LABELS[action]}: {state === 'offline' ? 'Offline' : state}"
        onclick={() => onAction(action, itemId, description)}
      >
        {buttonLabel(action, state)}
      </button>
    {/each}
  {/if}
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

  .action-btn.option-btn {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .action-btn:disabled {
    cursor: default;
  }

  .action-btn.primary {
    background: var(--green);
    color: #0d1117;
  }

  .action-btn.warning {
    background: var(--yellow);
    color: #000;
  }

  .action-btn.danger {
    background: var(--red);
    color: #0d1117;
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
