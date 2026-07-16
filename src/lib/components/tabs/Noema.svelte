<script lang="ts">
  import { onMount } from "svelte";
  import DevPackageRow from "$lib/components/shared/DevPackageRow.svelte";
  import {
    computePackageStats,
    filterPackages,
    groupPackages,
  } from "$lib/core/dev-packages";
  import type { DevPackageEntry, PkgState } from "$lib/types";

  let {
    packages,
    packageStates,
    onImplement,
    onLogToggle,
  }: {
    packages: DevPackageEntry[];
    packageStates: Record<string, PkgState>;
    onImplement?: (pkgId: string, name: string) => void;
    onLogToggle?: (pkgId: string) => void;
  } = $props();

  const STORAGE_DONE = "pkg-collapsed-done";
  const STORAGE_SPEC = "pkg-collapsed-spec";
  const STORAGE_ACTIVE = "pkg-collapsed-active";
  const STORAGE_COMPACT = "pkg-compact-view";

  let searchQuery = $state("");
  let compactView = $state(false);
  let collapsedDone = $state(true);
  let collapsedSpec = $state(false);
  let collapsedActive = $state(false);

  const filtered = $derived(filterPackages(packages, searchQuery));
  const grouped = $derived(groupPackages(filtered));
  const stats = $derived(computePackageStats(packages));
  const searching = $derived(searchQuery.trim().length > 0);

  const showSpec = $derived(searching ? grouped.spec.length > 0 : true);
  const showActive = $derived(searching ? grouped.active.length > 0 : true);
  const showDone = $derived(searching ? grouped.done.length > 0 : true);

  const specOpen = $derived(
    searching ? grouped.spec.length > 0 : !collapsedSpec,
  );
  const activeOpen = $derived(
    searching ? grouped.active.length > 0 : !collapsedActive,
  );
  const doneOpen = $derived(
    searching ? grouped.done.length > 0 : !collapsedDone,
  );

  const specPct = $derived(
    stats.total > 0 ? (stats.spec / stats.total) * 100 : 0,
  );
  const activePct = $derived(
    stats.total > 0 ? (stats.active / stats.total) * 100 : 0,
  );
  const donePct = $derived(
    stats.total > 0 ? (stats.done / stats.total) * 100 : 0,
  );

  function toggleSection(section: "done" | "spec" | "active") {
    if (section === "done") collapsedDone = !collapsedDone;
    else if (section === "spec") collapsedSpec = !collapsedSpec;
    else collapsedActive = !collapsedActive;
    persistCollapse();
  }

  function toggleCompact() {
    compactView = !compactView;
    try {
      localStorage.setItem(STORAGE_COMPACT, String(compactView));
    } catch {
      /* ignore */
    }
  }

  function persistCollapse() {
    try {
      localStorage.setItem(STORAGE_DONE, String(collapsedDone));
      localStorage.setItem(STORAGE_SPEC, String(collapsedSpec));
      localStorage.setItem(STORAGE_ACTIVE, String(collapsedActive));
    } catch {
      /* ignore */
    }
  }

  function rowState(pkgId: string): PkgState {
    return packageStates[pkgId] ?? {
      implementState: "idle",
      showLogButton: false,
      logOpen: false,
      logContent: "",
      queueStatus: null,
    };
  }

  onMount(() => {
    try {
      const doneRaw = localStorage.getItem(STORAGE_DONE);
      const specRaw = localStorage.getItem(STORAGE_SPEC);
      const activeRaw = localStorage.getItem(STORAGE_ACTIVE);
      const compactRaw = localStorage.getItem(STORAGE_COMPACT);

      if (doneRaw !== null) collapsedDone = doneRaw === "true";
      if (specRaw !== null) collapsedSpec = specRaw === "true";
      if (activeRaw !== null) collapsedActive = activeRaw === "true";
      if (compactRaw !== null) compactView = compactRaw === "true";
    } catch {
      /* ignore */
    }
  });
</script>

<section class="noema-tab">
  <h2>🧠 Development Packages</h2>
  <p class="hint">
    ▶ Mehet indítja a dev-loop-ot. Futás közben 📋 Log mutatja a Cursor
    kimenetét (3s frissítés).
  </p>

  {#if packages.length === 0}
    <p class="empty">Nincs csomag az INDEX.md-ben.</p>
  {:else}
    <div class="stats-bar">
      <div class="stats-line">
        <span class="stats-primary">
          📊 {stats.done}/{stats.total} kész ({stats.donePercent}%)
        </span>
        <button
          type="button"
          class="compact-toggle"
          title={compactView ? "Részletes nézet" : "Kompakt nézet"}
          onclick={toggleCompact}
        >
          {compactView ? "📜" : "📋"}
        </button>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        aria-valuenow={stats.donePercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Csomag haladás"
      >
        <span class="seg spec" style:width="{specPct}%"></span>
        <span class="seg active" style:width="{activePct}%"></span>
        <span class="seg done" style:width="{donePct}%"></span>
      </div>
      <div class="stats-chips">
        <span>📋 {stats.spec} spec</span>
        <span>🔨 {stats.active} aktív</span>
        <span>✅ {stats.done} kész</span>
      </div>
    </div>

    <label class="search-wrap">
      <span class="search-icon" aria-hidden="true">🔍</span>
      <input
        type="search"
        class="search-input"
        placeholder="Keresés..."
        aria-label="Keresés csomagok között"
        bind:value={searchQuery}
      />
    </label>

    {#if filtered.length === 0}
      <p class="empty">Nincs találat a keresésre.</p>
    {:else}
      <div class="sections">
        {#if showSpec}
          <section class="pkg-section">
            <button
              type="button"
              class="section-header"
              onclick={() => toggleSection("spec")}
              aria-expanded={specOpen}
            >
              <span class="chevron">{specOpen ? "▾" : "▸"}</span>
              <span>📋 Specifikáció Kész ({grouped.spec.length})</span>
            </button>
            {#if specOpen}
              <div class="section-body" class:compact={compactView}>
                {#if grouped.spec.length === 0}
                  <p class="section-empty">Nincs specifikációs csomag.</p>
                {:else}
                  {#each grouped.spec as pkg (pkg.id)}
                    {@const state = rowState(pkg.id)}
                    <DevPackageRow
                      pkgId={pkg.id}
                      name={pkg.name}
                      phase={pkg.phase}
                      done={pkg.done}
                      compact={compactView}
                      implementState={state.implementState}
                      showLogButton={state.showLogButton}
                      logOpen={state.logOpen}
                      logContent={state.logContent}
                      queueStatus={state.queueStatus}
                      onImplement={() => onImplement?.(pkg.id, pkg.name)}
                      onLogToggle={() => onLogToggle?.(pkg.id)}
                    />
                  {/each}
                {/if}
              </div>
            {/if}
          </section>
        {/if}

        {#if showActive}
          <section class="pkg-section">
            <button
              type="button"
              class="section-header"
              onclick={() => toggleSection("active")}
              aria-expanded={activeOpen}
            >
              <span class="chevron">{activeOpen ? "▾" : "▸"}</span>
              <span>🔨 Fejlesztés Alatt ({grouped.active.length})</span>
            </button>
            {#if activeOpen}
              <div class="section-body" class:compact={compactView}>
                {#if grouped.active.length === 0}
                  <p class="section-empty">Nincs aktív csomag.</p>
                {:else}
                  {#each grouped.active as pkg (pkg.id)}
                    {@const state = rowState(pkg.id)}
                    <DevPackageRow
                      pkgId={pkg.id}
                      name={pkg.name}
                      phase={pkg.phase}
                      done={pkg.done}
                      compact={compactView}
                      implementState={state.implementState}
                      showLogButton={state.showLogButton}
                      logOpen={state.logOpen}
                      logContent={state.logContent}
                      queueStatus={state.queueStatus}
                      onImplement={() => onImplement?.(pkg.id, pkg.name)}
                      onLogToggle={() => onLogToggle?.(pkg.id)}
                    />
                  {/each}
                {/if}
              </div>
            {/if}
          </section>
        {/if}

        {#if showDone}
          <section class="pkg-section">
            <button
              type="button"
              class="section-header"
              onclick={() => toggleSection("done")}
              aria-expanded={doneOpen}
            >
              <span class="chevron">{doneOpen ? "▾" : "▸"}</span>
              <span>✅ Kész ({grouped.done.length})</span>
            </button>
            {#if doneOpen}
              <div class="section-body" class:compact={compactView}>
                {#each grouped.done as pkg (pkg.id)}
                  {@const state = rowState(pkg.id)}
                  <DevPackageRow
                    pkgId={pkg.id}
                    name={pkg.name}
                    phase={pkg.phase}
                    done={pkg.done}
                    compact={compactView}
                    implementState={state.implementState}
                    showLogButton={state.showLogButton}
                    logOpen={state.logOpen}
                    logContent={state.logContent}
                    queueStatus={state.queueStatus}
                    onImplement={() => onImplement?.(pkg.id, pkg.name)}
                    onLogToggle={() => onLogToggle?.(pkg.id)}
                  />
                {/each}
              </div>
            {/if}
          </section>
        {/if}
      </div>
    {/if}
  {/if}
</section>

<style>
  .noema-tab h2 {
    font-size: 1.1em;
    margin-bottom: 8px;
  }

  .hint {
    color: var(--muted);
    font-size: 0.88em;
    margin-bottom: 16px;
  }

  .empty,
  .section-empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.9em;
  }

  .section-empty {
    padding: 8px 4px;
  }

  .stats-bar {
    margin-bottom: 14px;
    padding: 10px 12px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .stats-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 0.92em;
  }

  .stats-primary {
    font-weight: 600;
  }

  .compact-toggle {
    cursor: pointer;
    background: var(--border);
    border: none;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 1em;
    line-height: 1.2;
  }

  .compact-toggle:hover {
    background: var(--muted);
  }

  .progress-track {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg);
    margin-bottom: 8px;
  }

  .seg {
    height: 100%;
    min-width: 0;
    transition: width 0.2s ease;
  }

  .seg.spec {
    background: var(--muted);
  }

  .seg.active {
    background: var(--accent);
  }

  .seg.done {
    background: var(--green);
  }

  .stats-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 0.82em;
    color: var(--muted);
  }

  .search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    padding: 8px 10px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .search-icon {
    flex-shrink: 0;
    opacity: 0.7;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text);
    font-size: 0.92em;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--muted);
  }

  .sections {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 4px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }

  .section-header:hover {
    color: var(--accent);
  }

  .chevron {
    color: var(--muted);
    width: 1em;
    flex-shrink: 0;
  }

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
  }

  .section-body.compact {
    gap: 4px;
  }
</style>
