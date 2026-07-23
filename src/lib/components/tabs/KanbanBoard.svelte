<script lang="ts">
  import ActionButtonGroup, {
    type ActionBtnState,
  } from "$lib/components/shared/ActionButtonGroup.svelte";
  import type {
    ActionQueueData,
    ActionQueueItem,
    DashboardActionType,
  } from "$lib/types";

  let {
    actionQueue,
    getActionState,
    onAction,
  }: {
    actionQueue: ActionQueueData;
    getActionState: (
      itemId: string,
      action: DashboardActionType,
    ) => ActionBtnState;
    onAction: (
      action: DashboardActionType,
      id: string,
      description: string,
    ) => void;
  } = $props();

  const columns: {
    key: keyof ActionQueueData;
    title: string;
    items: ActionQueueItem[];
  }[] = $derived([
    { key: "auto", title: "⚡ Auto-resolved", items: actionQueue.auto },
    { key: "alfred", title: "👔 Alfred", items: actionQueue.alfred },
    { key: "andras", title: "🧑 András", items: actionQueue.andras },
  ]);
</script>

<h3 class="section-title"><span aria-hidden="true">📋</span> Action Queue</h3>
{#if actionQueue.error}
  <p class="empty">Action queue unavailable — {actionQueue.error}</p>
{:else}
  <div class="kanban">
    {#each columns as col (col.key)}
      <div class="kb-col">
        <h4>{col.title}</h4>
        {#if col.items.length === 0}
          <p class="empty">—</p>
        {:else}
          {#each col.items as item (item.id)}
            <div class="kb-item" role="article" aria-label="Action: {item.id} — {item.desc}">
              <div class="kb-id">{item.id}</div>
              <div class="kb-desc">{item.desc}</div>
              <div class="kb-meta">
                <span>{item.meta}</span>
                {#if item.actions.length > 0 || item.options.length > 0}
                  <ActionButtonGroup
                    actions={item.actions}
                    options={item.options}
                    itemId={item.id}
                    description={item.desc}
                    getState={getActionState}
                    {onAction}
                  />
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .section-title {
    font-size: 0.95em;
    color: var(--accent);
    margin: 4px 0 0;
  }

  .kanban {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .kb-col {
    background: rgba(48, 54, 61, 0.3);
    border-radius: 8px;
    padding: 10px;
  }

  .kb-col h4 {
    font-size: 0.9em;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin: 0 0 8px;
  }

  .kb-item {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 6px;
    font-size: 0.92em;
  }

  .kb-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--accent);
    font-size: 0.92em;
  }

  .kb-desc {
    margin: 2px 0;
  }

  .kb-meta {
    color: var(--muted);
    font-size: 0.9em;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
  }

  .empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9em;
    margin: 0;
  }

  @media (max-width: 768px) {
    .kanban {
      grid-template-columns: 1fr;
    }
  }
</style>
