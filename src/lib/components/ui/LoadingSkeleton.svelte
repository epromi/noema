<script lang="ts">
  /**
   * Shared loading skeleton component.
   *
   * Renders placeholder UI with a CSS-only shimmer animation (zero JS runtime
   * cost). Respects `prefers-reduced-motion` and announces loading state to
   * screen readers via `aria-busy` + `aria-label`.
   *
   * Three variants:
   *  - `card`    — placeholder cards (tab content areas)
   *  - `table`   — table rows + header (list/tabular data)
   *  - `metrics` — metric bars (stats dashboards)
   */
  interface Props {
    /**
     * Skeleton variant.
     * - `card`: auto-grid placeholder cards
     * - `table`: tabular header + row placeholders
     * - `metrics`: metric bar placeholders for stat dashboards
     */
    skeleton: 'card' | 'table' | 'metrics';

    /**
     * Number of skeleton items.
     * Applies to `card` (default 3) and `metrics` (default 4) variants.
     */
    count?: number;

    /**
     * Number of table rows. Applies to `table` variant only.
     * @default 5
     */
    rows?: number;

    /**
     * Number of table columns. Applies to `table` variant only.
     * @default 4
     */
    cols?: number;

    /**
     * Human-readable label for the `aria-label` attribute.
     * Screen readers announce "Loading {label}".
     * @default "content"
     */
    label?: string;
  }

  let {
    skeleton,
    count = skeleton === 'metrics' ? 4 : 3,
    rows = 5,
    cols = 4,
    label = 'content'
  }: Props = $props();

  function range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="skeleton-root"
  class:skeleton-card={skeleton === 'card'}
  class:skeleton-table={skeleton === 'table'}
  class:skeleton-metrics={skeleton === 'metrics'}
  role="status"
  aria-busy="true"
  aria-label="Loading {label}"
>
  {#if skeleton === 'card'}
    {#each range(count) as _}
      <div class="card-placeholder">
        <span class="shimmer-line w-60"></span>
        <span class="shimmer-line w-80"></span>
        <span class="shimmer-line w-40"></span>
      </div>
    {/each}

  {:else if skeleton === 'metrics'}
    {#each range(count) as _}
      <div class="metric-placeholder">
        <span class="shimmer-line w-50 metric-label"></span>
        <span class="shimmer-line w-35 metric-value"></span>
      </div>
    {/each}

  {:else if skeleton === 'table'}
    <div class="table-header" style="grid-template-columns: repeat({cols}, 1fr)">
      {#each range(cols) as _}
        <span class="shimmer-cell header-cell"></span>
      {/each}
    </div>
    {#each range(rows) as _}
      <div class="table-row" style="grid-template-columns: repeat({cols}, 1fr)">
        {#each range(cols) as _}
          <span class="shimmer-cell row-cell"></span>
        {/each}
      </div>
    {/each}
  {/if}

  <!-- Hidden live-region fallback for screen readers that ignore the root role -->
  <span class="sr-only">Loading {label}&hellip;</span>
</div>

<style>
  /*
   * Design tokens — match Noema dark palette
   */
  .skeleton-root {
    --bg-page: #0d1117;
    --bg-card: #161b22;
    --shimmer-from: rgba(255, 255, 255, 0.03);
    --shimmer-to: rgba(255, 255, 255, 0.06);
    --shimmer-duration: 1.5s;
    --radius: 6px;
    width: 100%;
  }

  /* ── Shared shimmer animation ── */
  @keyframes skeleton-shimmer {
    0%,
    100% {
      background-color: var(--shimmer-from);
    }
    50% {
      background-color: var(--shimmer-to);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shimmer-line,
    .shimmer-cell,
    .card-placeholder,
    .metric-placeholder {
      animation: none;
    }
    .shimmer-line,
    .shimmer-cell {
      background-color: var(--shimmer-to);
    }
  }

  /* ── Screen reader only ── */
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

  /* ── Card variant ── */
  .skeleton-card {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .card-placeholder {
    background: var(--bg-card);
    border-radius: var(--radius);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .shimmer-line {
    display: block;
    height: 14px;
    border-radius: 4px;
    background-color: var(--shimmer-from);
    animation: skeleton-shimmer var(--shimmer-duration) ease-in-out infinite;
  }

  .w-60 {
    width: 60%;
  }
  .w-80 {
    width: 80%;
  }
  .w-40 {
    width: 40%;
  }
  .w-50 {
    width: 50%;
  }
  .w-35 {
    width: 35%;
  }

  /* ── Metrics variant ── */
  .skeleton-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
  }

  .metric-placeholder {
    background: var(--bg-card);
    border-radius: var(--radius);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .metric-label {
    height: 12px;
  }

  .metric-value {
    height: 24px;
  }

  /* ── Table variant ── */
  .skeleton-table {
    display: flex;
    flex-direction: column;
  }

  .table-header {
    display: grid;
    gap: 4px;
    margin-bottom: 4px;
  }

  .table-row {
    display: grid;
    gap: 4px;
    margin-bottom: 2px;
  }

  .shimmer-cell {
    display: block;
    border-radius: 4px;
    background-color: var(--shimmer-from);
    animation: skeleton-shimmer var(--shimmer-duration) ease-in-out infinite;
  }

  .header-cell {
    height: 32px;
  }

  .row-cell {
    height: 28px;
  }
</style>
