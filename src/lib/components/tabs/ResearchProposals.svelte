<script lang="ts">
  import ImplementButton from "$lib/components/shared/ImplementButton.svelte";
  import ActionButtonGroup, {
    type ActionBtnState,
  } from "$lib/components/shared/ActionButtonGroup.svelte";
  import type {
    DashboardActionType,
    ImplementState,
    PkgState,
    ResearchData,
  } from "$lib/types";

  let {
    research,
    packageStates,
    getActionState,
    onAction,
    onImplement,
    onLogToggle,
  }: {
    research: ResearchData;
    packageStates: Record<string, PkgState>;
    getActionState: (
      itemId: string,
      action: DashboardActionType,
    ) => ActionBtnState;
    onAction: (
      action: DashboardActionType,
      id: string,
      description: string,
    ) => void;
    onImplement?: (pkgId: string, name: string) => void;
    onLogToggle?: (pkgId: string) => void;
  } = $props();

  function proposalPriorityColor(priority: string): string {
    if (priority.includes("🔴")) return "var(--red)";
    if (priority.includes("🟡")) return "var(--yellow)";
    return "var(--muted)";
  }
</script>

<h3 class="section-title">🧠 Noema Product Research</h3>
<div class="card research-card">
  {#if research.error}
    <p class="empty">Research unavailable — {research.error}</p>
  {:else if !research.latestDate}
    <p class="empty">⏳ Első futás holnap 01:00-kor. Még nincs adat.</p>
  {:else}
    <div class="research-header">
      <span class="research-date">{research.latestDate}</span>
      {#if research.autoFixCount > 0}
        <span class="badge badge-ok">🔧 {research.autoFixCount} AUTO-FIX</span
        >
      {/if}
      {#if research.proposeCount > 0}
        <span class="badge badge-warn"
          >📋 {research.proposeCount} PROPOSE</span
        >
      {/if}
    </div>
    {#if research.proposals.length === 0}
      <p class="empty">No proposals yet.</p>
    {:else}
      <div class="proposal-list">
        {#each research.proposals as proposal (proposal.id)}
          {@const state = packageStates[proposal.id] ?? {
            implementState: "idle" as ImplementState,
            showLogButton: false,
            logOpen: false,
            logContent: "",
            queueStatus: null,
          }}
          <div
            class="proposal-row"
            style:border-left-color={proposalPriorityColor(proposal.priority)}
          >
            <span class="proposal-text"
              >{proposal.priority} {proposal.finding}</span
            >
            {#if proposal.status === "done"}
              <span class="proposal-done">✅ Kész</span>
            {:else if proposal.status === "running"}
              <span class="proposal-running">⏳ Fut...</span>
            {:else if proposal.actions.length === 1 && proposal.actions[0] === "implement"}
              <ImplementButton
                buttonState={state.implementState}
                showLogButton={state.showLogButton}
                logOpen={state.logOpen}
                onImplement={() =>
                  onImplement?.(proposal.id, proposal.finding)}
                onLogToggle={() => onLogToggle?.(proposal.id)}
              />
            {:else}
              <ActionButtonGroup
                actions={proposal.actions}
                itemId={proposal.id}
                description={proposal.finding}
                getState={getActionState}
                onAction={(action, id, description) => {
                  if (action === "implement") {
                    onImplement?.(id, description);
                  } else {
                    onAction(action, id, description);
                  }
                }}
              />
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .section-title {
    font-size: 0.95em;
    color: var(--accent);
    margin: 4px 0 0;
  }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
  }

  .research-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .research-date {
    font-weight: 700;
    color: var(--accent);
  }

  .badge {
    font-size: 0.82em;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .badge-ok {
    background: rgba(63, 185, 80, 0.15);
    color: var(--green);
  }

  .badge-warn {
    background: rgba(210, 153, 34, 0.15);
    color: var(--yellow);
  }

  .proposal-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .proposal-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.88em;
    padding: 4px 8px;
    background: var(--bg);
    border-left: 3px solid var(--muted);
    border-radius: 3px;
    line-height: 1.5;
  }

  .proposal-text {
    flex: 1;
  }

  .proposal-done {
    color: var(--green);
    font-size: 0.82em;
    flex-shrink: 0;
  }

  .proposal-running {
    color: var(--yellow);
    font-size: 0.82em;
    flex-shrink: 0;
  }

  .empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9em;
    margin: 0;
  }
</style>
