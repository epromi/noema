<script lang="ts">
  import { getContext, onDestroy } from "svelte";
  import type { PageData } from "./$types";
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
  import H1 from "$lib/components/tabs/H1.svelte";
  import Viktor from "$lib/components/tabs/Viktor.svelte";
  import type { ImplementState } from "$lib/types";

  const RELAY_URL = "/api";
  const LOG_POLL_MS = 3000;

  let { data }: { data: PageData } = $props();

  const tabContext = getContext<{ current: string }>("noema-active-tab");

  type PkgState = {
    implementState: ImplementState;
    showLogButton: boolean;
    logOpen: boolean;
    logContent: string;
  };

  let packageStates = $state<Record<string, PkgState>>({});
  const pollers = new Map<string, ReturnType<typeof setInterval>>();

  function defaultState(): PkgState {
    return {
      implementState: "idle",
      showLogButton: false,
      logOpen: false,
      logContent: "",
    };
  }

  function getState(pkgId: string): PkgState {
    return packageStates[pkgId] ?? defaultState();
  }

  function setState(pkgId: string, patch: Partial<PkgState>) {
    packageStates[pkgId] = { ...getState(pkgId), ...patch };
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
    setState(pkgId, { implementState: "running" });

    try {
      const res = await fetch(`${RELAY_URL}/action`, {
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
        setState(pkgId, { implementState: "running", showLogButton: true });
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
</script>

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

<style>
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
