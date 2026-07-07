<script lang="ts">
  import { browser } from "$app/environment";
  import { getContext, onDestroy, onMount } from "svelte";
  import type { DashboardData, DevPackageEntry, PkgState, QueueStatus, AgentEntry } from "$lib/types";
  import type { PageData } from "./$types";
  import { DEFAULT_RELAY_URL, getDevJobStatus } from "$lib/core/noema-devjob";
  import Overview from "$lib/components/tabs/Overview.svelte";
  import Agents from "$lib/components/tabs/Agents.svelte";
  import Crons from "$lib/components/tabs/Crons.svelte";
  import Orchestrator from "$lib/components/tabs/Orchestrator.svelte";
  import Noema from "$lib/components/tabs/Noema.svelte";
  import Brainstorm from "$lib/components/tabs/Brainstorm.svelte";
  import Bills from "$lib/components/tabs/Bills.svelte";
  import Research from "$lib/components/tabs/Research.svelte";
  import LogsViewer from "$lib/components/tabs/LogsViewer.svelte";
  import AuditTrail from "$lib/components/tabs/AuditTrail.svelte";
  import DecisionTrace from "$lib/components/tabs/DecisionTrace.svelte";
  import H1 from "$lib/components/tabs/H1.svelte";
  import Viktor from "$lib/components/tabs/Viktor.svelte";
  import AgentDetailPanel from "$lib/components/shared/AgentDetailPanel.svelte";

  const RELAY_URL = DEFAULT_RELAY_URL;
  const LOG_POLL_MS = 3000;
  const QUEUE_POLL_MS = 10_000;

  let { data: serverData }: { data: PageData } = $props();

  let sseData = $state<DashboardData | null>(null);

  const data = $derived(sseData ? { ...serverData, ...sseData } : serverData);

  $effect(() => {
    serverData;
    sseData = null;
  });

  onMount(() => {
    if (!browser) return;

    const es = new EventSource("/api/events");

    es.onmessage = (event) => {
      if (!event.data || event.data.startsWith(":")) return;
      try {
        sseData = JSON.parse(event.data) as DashboardData;
      } catch {
        /* ignore malformed SSE payloads */
      }
    };

    void refreshQueueStatus();
    const queueTimer = setInterval(() => {
      void refreshQueueStatus();
    }, QUEUE_POLL_MS);

    return () => {
      es.close();
      clearInterval(queueTimer);
    };
  });

  const tabContext = getContext<{ current: string }>("noema-active-tab");
  const agentContext = getContext<{
    agentId: string | null;
    selectAgent: (id: string) => void;
    closeAgent: () => void;
  }>("noema-selected-agent");

  let packageStates = $state<Record<string, PkgState>>({});
  const pollers = new Map<string, ReturnType<typeof setInterval>>();

  function defaultState(): PkgState {
    return {
      implementState: "idle",
      showLogButton: false,
      logOpen: false,
      logContent: "",
      queueStatus: null,
    };
  }

  function getState(pkgId: string): PkgState {
    return packageStates[pkgId] ?? defaultState();
  }

  function setState(pkgId: string, patch: Partial<PkgState>) {
    packageStates[pkgId] = { ...getState(pkgId), ...patch };
  }

  function pkgMatchesRunning(pkgId: string, running: string | null): boolean {
    if (!running) return false;
    return running === pkgId || running.startsWith(`${pkgId}-`);
  }

  async function refreshQueueStatus() {
    try {
      const status = await getDevJobStatus(RELAY_URL);
      const runningId = status.running;
      const queueSize = status.queue;

      const trackedIds = new Set([
        ...Object.keys(packageStates),
        ...data.devPackages.packages.map((p: DevPackageEntry) => p.id),
      ]);

      for (const pkgId of trackedIds) {
        const state = getState(pkgId);
        let queueStatus: QueueStatus | null = null;
        let implementState = state.implementState;

        if (runningId && pkgMatchesRunning(pkgId, runningId)) {
          queueStatus = {
            running: runningId,
            queueSize,
            queuePosition: null,
          };
          implementState = "running";
        } else if (state.implementState === "running") {
          queueStatus = {
            running: runningId,
            queueSize,
            queuePosition: queueSize > 0 ? queueSize : null,
          };
        }

        setState(pkgId, { queueStatus, implementState });
      }
    } catch {
      /* relay unavailable */
    }
  }

  async function fetchLog(pkgId: string) {
    try {
      const res = await fetch(`/api/log/${encodeURIComponent(pkgId)}`);
      const body = await res.json();
      setState(pkgId, { logContent: body.content ?? "" });
    } catch (err) {
      setState(pkgId, { logContent: `❌ Hiba: ${String(err)}` });
    }
  }

  function startLogPoll(pkgId: string) {
    stopLogPoll(pkgId);
    void fetchLog(pkgId);
    pollers.set(
      pkgId,
      setInterval(() => {
        void fetchLog(pkgId);
      }, LOG_POLL_MS),
    );
  }

  function stopLogPoll(pkgId: string) {
    const timer = pollers.get(pkgId);
    if (timer) {
      clearInterval(timer);
      pollers.delete(pkgId);
    }
  }

  async function handleImplement(pkgId: string, name: string) {
    setState(pkgId, {
      implementState: "running",
      showLogButton: true,
      logOpen: true,
    });
    startLogPoll(pkgId);

    const pkg = data.devPackages.packages.find(
      (p: DevPackageEntry) => p.id === pkgId,
    );
    const estimatedMs = (pkg?.estimatedMinutes ?? 10) * 60_000;

    try {
      await fetch(`/api/log/${encodeURIComponent(pkgId)}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedMs }),
      });
      void fetchLog(pkgId);
    } catch {
      /* non-critical */
    }

    try {
      const res = await window.fetch(`${RELAY_URL}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "implement",
          id: pkgId,
          description: `${pkgId}: ${name}`,
        }),
      });
      const body = await res.json();

      if (body.ok) {
        setState(pkgId, {
          implementState: "running",
          showLogButton: true,
          logOpen: true,
        });
        void refreshQueueStatus();
      } else {
        setState(pkgId, { implementState: "error" });
        setTimeout(() => setState(pkgId, { implementState: "idle" }), 2000);
      }
    } catch {
      setState(pkgId, { implementState: "offline" });
      setTimeout(() => setState(pkgId, { implementState: "idle" }), 2000);
    }
  }

  function handleLogToggle(pkgId: string) {
    const current = getState(pkgId);
    const nextOpen = !current.logOpen;
    setState(pkgId, { logOpen: nextOpen });

    if (nextOpen) {
      startLogPoll(pkgId);
    } else {
      stopLogPoll(pkgId);
    }
  }

  onDestroy(() => {
    for (const pkgId of pollers.keys()) {
      stopLogPoll(pkgId);
    }
  });

  const activeTab = $derived(tabContext?.current ?? "overview");
  const selectedAgent = $derived(
    agentContext?.agentId
      ? (data.agents.agents.find((a: AgentEntry) => a.id === agentContext.agentId) ?? null)
      : null,
  );
  const agentPanelOpen = $derived(agentContext?.agentId != null);
</script>

<div class="page-with-panel">
  <main class="dashboard-main">
  <h2 class="sr-only">Noema 🧠</h2>

  {#if activeTab === "overview"}
    <Overview
      crons={data.crons}
      agents={data.agents}
      health={data.health}
      h1={data.h1}
      hostname={data.hostname}
    />
  {:else if activeTab === "agents"}
    <Agents agents={data.agents} viktor={data.h1.viktor} />
  {:else if activeTab === "crons"}
    <Crons crons={data.crons} />
  {:else if activeTab === "orchestrator"}
    <Orchestrator
      crons={data.crons}
      research={data.research}
      actionQueue={data.actionQueue}
      {packageStates}
      onImplement={handleImplement}
      onLogToggle={handleLogToggle}
    />
  {:else if activeTab === "h1"}
    <H1 h1={data.h1} />
  {:else if activeTab === "viktor"}
    <Viktor viktor={data.h1.viktor} />
  {:else if activeTab === "brainstorm"}
    <Brainstorm brainstorm={data.brainstorm} />
  {:else if activeTab === "bills"}
    <Bills bills={data.bills} />
  {:else if activeTab === "research"}
    <Research research={data.research} />
  {:else if activeTab === "logs"}
    <LogsViewer logs={data.logs} />
  {:else if activeTab === "audit"}
    <AuditTrail auditTrail={data.auditTrail} />
  {:else if activeTab === "trace"}
    <DecisionTrace decisionTrace={data.decisionTrace} />
  {:else if activeTab === "noema"}
    <Noema
      packages={data.devPackages.packages}
      {packageStates}
      onImplement={handleImplement}
      onLogToggle={handleLogToggle}
    />
  {:else}
    <div class="dashboard-placeholder">
      <p><strong>{activeTab}</strong> tab — coming in a future package.</p>
      <p class="muted">
        Loaded at: {new Date(data.meta.loadedAt).toLocaleString()}
      </p>
    </div>
  {/if}
  </main>

  <AgentDetailPanel
    agent={selectedAgent}
    open={agentPanelOpen}
    onClose={() => agentContext?.closeAgent()}
  />
</div>

<style>
  .page-with-panel {
    position: relative;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .dashboard-placeholder {
    padding: 24px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    text-align: center;
  }

  .dashboard-placeholder .muted {
    color: var(--muted);
    font-size: 0.88em;
    margin-top: 8px;
  }
</style>
