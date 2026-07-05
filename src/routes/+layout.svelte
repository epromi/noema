<script lang="ts">
  import "../app.css";
  import { setContext } from "svelte";
  import DevJobIndicator from "$lib/components/DevJobIndicator.svelte";

  const TABS = [
    { id: "overview", label: "🏠 Overview" },
    { id: "agents", label: "🤖 Agents" },
    { id: "crons", label: "⏰ Crons" },
    { id: "orchestrator", label: "⚡ Orchestrator" },
    { id: "h1", label: "🏴 HackerOne" },
    { id: "viktor", label: "🛡️ Viktor" },
    { id: "brainstorm", label: "🧠 Brainstorm" },
    { id: "bills", label: "📋 Bills" },
    { id: "research", label: "🔬 Research" },
    { id: "logs", label: "📋 Logs" },
    { id: "noema", label: "🧠 Noema" },
  ] as const;

  let activeTab = $state<(typeof TABS)[number]["id"]>("overview");

  setContext("noema-active-tab", {
    get current() {
      return activeTab;
    },
  });

  let { children } = $props();
</script>

<div class="app-shell">
  <header class="app-header">
    <h1>Noema 🧠</h1>
    <p class="subtitle">System Intelligence Dashboard</p>
  </header>

  <nav class="tab-bar" aria-label="Dashboard tabs">
    {#each TABS as tab (tab.id)}
      <button
        type="button"
        class="tab-btn"
        class:active={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  {@render children?.()}
  <DevJobIndicator />
</div>
