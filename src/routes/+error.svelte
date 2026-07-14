<script lang="ts">
  import { dev } from "$app/environment";

  let { status, error } = $props();

  const message = $derived(
    status === 404 ? "Oldal nem található." :
    status === 500 ? "Szerverhiba történt." :
    status === 403 ? "Hozzáférés megtagadva." :
    status === 503 ? "A dashboard szolgáltatás átmenetileg nem elérhető." :
    `${status} — Hiba történt.`
  );

  const emoji = $derived(
    status === 404 ? "🔍" :
    status === 500 ? "💥" :
    status === 403 ? "🚫" :
    status === 503 ? "🔧" :
    "⚠️"
  );
</script>

<div class="error-page">
  <div class="error-card">
    <h1 class="error-emoji">{emoji}</h1>
    <h2 class="error-status">{status}</h2>
    <p class="error-message">{message}</p>
    <a href="/" class="error-back">← Vissza a dashboardra</a>
    {#if dev && error}
      <pre class="error-detail">{error?.message ?? ''}</pre>
    {/if}
  </div>
</div>

<style>
  .error-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--bg-primary, #111);
    color: var(--text-primary, #f0f0f0);
    font-family: system-ui, sans-serif;
  }
  .error-card {
    text-align: center;
    padding: 3rem 2rem;
    max-width: 480px;
  }
  .error-emoji {
    font-size: 4rem;
    margin: 0;
  }
  .error-status {
    font-size: 3rem;
    margin: 0.5rem 0;
    font-weight: 700;
    color: var(--text-primary, #f0f0f0);
  }
  .error-message {
    font-size: 1.1rem;
    color: var(--text-secondary, #999);
    margin: 0.5rem 0 1.5rem;
  }
  .error-back {
    display: inline-block;
    padding: 0.6rem 1.5rem;
    background: var(--accent, #48c);
    color: #fff;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 500;
    transition: opacity 0.2s;
  }
  .error-back:hover {
    opacity: 0.85;
  }
  .error-detail {
    margin-top: 2rem;
    padding: 1rem;
    background: var(--bg-secondary, #1a1a1a);
    border-radius: 8px;
    font-size: 0.8rem;
    text-align: left;
    overflow-x: auto;
    color: var(--text-warning, #f66);
  }
</style>
