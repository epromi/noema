<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { type ActionBtnState } from "$lib/components/shared/ActionButtonGroup.svelte";
  import { DEFAULT_RELAY_URL, getDevJobStatus } from "$lib/core/noema-devjob";
  import type {
    ActionQueueData,
    CronData,
    DashboardActionType,
    DevJobStatus,
    PkgState,
    ResearchData,
  } from "$lib/types";
  import CronTimeline from "$lib/components/tabs/CronTimeline.svelte";
  import KanbanBoard from "$lib/components/tabs/KanbanBoard.svelte";
  import OttoTimeline from "$lib/components/tabs/OttoTimeline.svelte";
  import ProcessorTimer from "$lib/components/tabs/ProcessorTimer.svelte";
  import ResearchProposals from "$lib/components/tabs/ResearchProposals.svelte";

  const RELAY_URL = DEFAULT_RELAY_URL;
  const POLL_MS = 5000;

  let {
    crons,
    research,
    actionQueue,
    packageStates,
    onImplement,
    onLogToggle,
  }: {
    crons: CronData;
    research: ResearchData;
    actionQueue: ActionQueueData;
    packageStates: Record<string, PkgState>;
    onImplement?: (pkgId: string, name: string) => void;
    onLogToggle?: (pkgId: string) => void;
  } = $props();

  let actionBtnStates = $state<Record<string, ActionBtnState>>({});
  let processorStatus = $state<DevJobStatus>({
    nextMs: 0,
    queue: 0,
    running: null,
    updatedAt: 0,
  });

  let pollTimer: ReturnType<typeof setInterval> | undefined;

  function actionKey(itemId: string, action: DashboardActionType): string {
    return `${itemId}:${action}`;
  }

  function getActionState(
    itemId: string,
    action: DashboardActionType,
  ): ActionBtnState {
    return actionBtnStates[actionKey(itemId, action)] ?? "idle";
  }

  async function sendAction(
    action: DashboardActionType,
    id: string,
    description: string,
  ): Promise<void> {
    const key = actionKey(id, action);
    actionBtnStates = { ...actionBtnStates, [key]: "loading" };

    try {
      // ⚠️ window.fetch → bypass SvelteKit auto-invalidation on POST
      const res = await window.fetch(`${RELAY_URL}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, description }),
      });
      const body = await res.json();
      actionBtnStates = {
        ...actionBtnStates,
        [key]: body.ok ? "ok" : "error",
      };
      if (body.ok) {
        setTimeout(() => {
          actionBtnStates = { ...actionBtnStates, [key]: "idle" };
        }, 3000);
      } else {
        setTimeout(() => {
          actionBtnStates = { ...actionBtnStates, [key]: "idle" };
        }, 2000);
      }
    } catch {
      actionBtnStates = { ...actionBtnStates, [key]: "offline" };
      setTimeout(() => {
        actionBtnStates = { ...actionBtnStates, [key]: "idle" };
      }, 2000);
    }
  }

  async function pollProcessor(): Promise<void> {
    processorStatus = await getDevJobStatus(RELAY_URL);
  }

  onMount(() => {
    void pollProcessor();
    pollTimer = setInterval(() => {
      void pollProcessor();
    }, POLL_MS);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });
</script>

<section class="orchestrator-tab">
  <OttoTimeline ottoRuns={research.ottoRuns} />

  <KanbanBoard {actionQueue} {getActionState} onAction={sendAction} />

  <CronTimeline {crons} />

  <ProcessorTimer {processorStatus} />

  <ResearchProposals
    {research}
    {packageStates}
    {getActionState}
    onAction={sendAction}
    {onImplement}
    {onLogToggle}
  />
</section>

<style>
  .orchestrator-tab {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
</style>
