<script lang="ts">
  import '../app.css';
  import { setContext } from 'svelte';
  import CronSidebar from '$lib/components/shared/CronSidebar.svelte';
  import type { LayoutData } from './$types';

  const TABS = [
    { id: 'overview', label: '🏠 Overview' },
    { id: 'agents', label: '🤖 Agents' },
    { id: 'crons', label: '⏰ Crons' },
    { id: 'orchestrator', label: '⚡ Orchestrator' },
    { id: 'brainstorm', label: '🧠 Brainstorm' },
    { id: 'bills', label: '📋 Bills' },
    { id: 'research', label: '🔬 Research' },
    { id: 'kpis', label: '📊 KPIs' },
    { id: 'noema', label: '🧠 Noema' }
  ] as const;

  let activeTab = $state<(typeof TABS)[number]['id']>('overview');

  setContext('noema-active-tab', {
    get current() {
      return activeTab;
    }
  });

  let { data, children }: { data: LayoutData; children?: import('svelte').Snippet } = $props();
</script>

<div class="app-layout">
  <div class="main-content">
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
            class:mobile-crons-tab={tab.id === 'crons'}
            onclick={() => (activeTab = tab.id)}
          >
            {tab.label}
          </button>
        {/each}
      </nav>

      {@render children?.()}
    </div>
  </div>

  <CronSidebar crons={data.crons} />
</div>

<style>
  .app-layout {
    display: flex;
    min-height: 100vh;
  }

  .main-content {
    flex: 1;
    min-width: 0;
  }

  @media (max-width: 599px) {
    :global(.mobile-crons-tab) {
      display: inline-flex;
    }
  }

  @media (min-width: 600px) {
    :global(.mobile-crons-tab) {
      display: none;
    }
  }
</style>
