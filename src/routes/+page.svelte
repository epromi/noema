<script lang="ts">
  import { getContext } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const tabContext = getContext<{ current: string }>('noema-active-tab');
</script>

<main class="dashboard-main">
  <h2 class="sr-only">Noema 🧠</h2>
  <div class="dashboard-placeholder">
    <p><strong>Noema 🧠</strong> — SvelteKit scaffold ready.</p>
    <p>Active tab: {tabContext?.current ?? 'overview'}</p>
    <p>Loaded at: {new Date(data.loadedAt).toLocaleString()}</p>
    <p>Tab components arrive in PKG-002+.</p>
  </div>
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
</style>
