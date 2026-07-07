<script lang="ts">
  import "../app.css";
  import { browser } from "$app/environment";
  import { setContext } from "svelte";
  import { onMount } from "svelte";
  import DevJobIndicator from "$lib/components/DevJobIndicator.svelte";
  import CronSidebar from "$lib/components/layout/CronSidebar.svelte";
  import BuildIntegrityBanner from "$lib/components/shared/BuildIntegrityBanner.svelte";
  import type { BuildIntegrityData, CronData, DashboardData } from "$lib/types";
  import type { LayoutData } from "./$types";

  const PRIMARY_TABS = [
    { id: "overview", label: "🏠 Overview" },
    { id: "agents", label: "🤖 Agents" },
    { id: "crons", label: "⏰ Crons" },
    { id: "orchestrator", label: "⚡ Orchestrator" },
    { id: "noema", label: "🧠 Noema" },
    { id: "cron-pipeline", label: "⏰ Pipeline", mobileOnly: true },
  ] as const;

  const SECONDARY_TABS = [
    { id: "h1", label: "🏴 H1" },
    { id: "viktor", label: "🛡️ Viktor" },
    { id: "brainstorm", label: "🧠 Brainstorm" },
    { id: "bills", label: "📋 Bills" },
    { id: "research", label: "🔬 Research" },
    { id: "logs", label: "📋 Logs" },
    { id: "audit", label: "📜 Audit" },
    { id: "trace", label: "🌳 Trace" },
  ] as const;

  type TabId =
    | (typeof PRIMARY_TABS)[number]["id"]
    | (typeof SECONDARY_TABS)[number]["id"];

  let {
    data,
    children,
  }: { data: LayoutData; children?: import("svelte").Snippet } = $props();

  let activeTab = $state<TabId>("overview");
  let selectedAgentId = $state<string | null>(null);
  let isMobile = $state(false);
  let sseCrons = $state<CronData | null>(null);
  let buildIntegrity = $state<BuildIntegrityData | null>(null);

  const liveCrons = $derived(sseCrons ?? data.crons);
  const showBuildAlert = $derived(buildIntegrity?.alert === true);

  $effect(() => {
    data.crons;
    sseCrons = null;
    buildIntegrity = null;
  });

  $effect(() => {
    if (!isMobile && activeTab === "cron-pipeline") {
      activeTab = "overview";
    }
  });

  setContext("noema-active-tab", {
    get current() {
      return activeTab;
    },
  });

  setContext("noema-selected-agent", {
    get agentId() {
      return selectedAgentId;
    },
    selectAgent(id: string) {
      selectedAgentId = id;
    },
    closeAgent() {
      selectedAgentId = null;
    },
  });

  const showMobileCron = $derived(isMobile && activeTab === "cron-pipeline");

  onMount(() => {
    if (!browser) return;

    const mq = window.matchMedia("(max-width: 599px)");
    const syncMobile = () => {
      isMobile = mq.matches;
    };
    syncMobile();
    mq.addEventListener("change", syncMobile);

    const es = new EventSource("/api/events");
    es.onmessage = (event) => {
      if (!event.data || event.data.startsWith(":")) return;
      try {
        const payload = JSON.parse(event.data) as DashboardData;
        if (payload.crons) sseCrons = payload.crons;
        if (payload.buildIntegrity) buildIntegrity = payload.buildIntegrity;
      } catch {
        /* ignore malformed SSE payloads */
      }
    };

    return () => {
      mq.removeEventListener("change", syncMobile);
      es.close();
    };
  });
</script>

<div class="app-layout">
  <div class="main-column">
    <header class="app-header">
      <h1>Noema 🧠</h1>
      <p class="subtitle">System Intelligence Dashboard</p>
    </header>

    {#if showBuildAlert}
      <BuildIntegrityBanner
        message="Dashboard build sérült — újrabuild szükséges"
      />
    {/if}

    <nav class="tab-bar tab-bar-primary" aria-label="Fő navigáció">
      {#each PRIMARY_TABS as tab (tab.id)}
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === tab.id}
          class:tab-btn-mobile-crons={"mobileOnly" in tab && tab.mobileOnly}
          onclick={() => (activeTab = tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </nav>

    <nav class="tab-bar tab-bar-secondary" aria-label="Eszközök">
      <span class="tab-label">Tools:</span>
      {#each SECONDARY_TABS as tab (tab.id)}
        <button
          type="button"
          class="tab-btn tab-btn-secondary"
          class:active={activeTab === tab.id}
          onclick={() => (activeTab = tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </nav>

    {#if showMobileCron}
      <div class="mobile-cron-panel">
        <CronSidebar crons={liveCrons} mobile />
      </div>
    {:else}
      {@render children?.()}
    {/if}

    <DevJobIndicator />
  </div>

  <CronSidebar crons={liveCrons} />
</div>

<style>
  .app-layout {
    display: flex;
    min-height: 100vh;
    align-items: stretch;
    width: 100%;
  }

  .main-column {
    flex: 1;
    min-width: 0;
    padding: 16px 24px;
  }

  .app-header h1 {
    font-size: 1.3em;
    margin-bottom: 0;
  }

  .app-header .subtitle {
    color: var(--muted);
    font-size: 0.92em;
    margin-bottom: 16px;
  }

  .tab-bar {
    display: flex;
    gap: 2px;
    margin-bottom: 8px;
    border-bottom: 2px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
    align-items: center;
  }

  .tab-bar-secondary {
    margin-bottom: 16px;
    border-bottom-width: 1px;
    background: rgba(255, 255, 255, 0.02);
    padding: 4px 0 0;
  }

  .tab-label {
    color: var(--muted);
    font-size: 0.78em;
    padding: 0 10px 6px 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tab-label::after {
    content: "|";
    margin-left: 10px;
    opacity: 0.35;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    padding: 8px 14px;
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 0.9em;
    white-space: nowrap;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition:
      color 0.2s,
      border-color 0.2s;
  }

  .tab-btn:hover {
    color: var(--text);
  }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-btn-secondary {
    font-size: 0.85em;
    padding: 6px 10px;
    border-bottom-width: 1px;
    margin-bottom: -1px;
  }

  .tab-bar-secondary .tab-btn.active {
    border-bottom-color: var(--muted);
    color: var(--text);
  }

  .tab-btn-mobile-crons {
    display: none;
  }

  .mobile-cron-panel {
    min-height: 240px;
  }

  @media (max-width: 768px) {
    .main-column {
      padding: 10px;
    }

    .tab-btn {
      padding: 6px 8px;
      font-size: 0.85em;
    }
  }

  @media (max-width: 599px) {
    .tab-btn-mobile-crons {
      display: inline-block;
    }
  }
</style>
