<script lang="ts">
	import DevPackageRow from '$lib/components/shared/DevPackageRow.svelte';
	import type { DevPackageEntry, ImplementState } from '$lib/types';

	let {
		packages,
		packageStates,
		onImplement,
		onLogToggle
	}: {
		packages: DevPackageEntry[];
		packageStates: Record<
			string,
			{ implementState: ImplementState; showLogButton: boolean; logOpen: boolean; logContent: string }
		>;
		onImplement?: (pkgId: string, name: string) => void;
		onLogToggle?: (pkgId: string) => void;
	} = $props();
</script>

<section class="noema-tab">
	<h2>🧠 Development Packages</h2>
	<p class="hint">▶ Mehet indítja a dev-loop-ot. Futás közben 📋 Log mutatja a Cursor kimenetét (3s frissítés).</p>

	{#if packages.length === 0}
		<p class="empty">Nincs csomag az INDEX.md-ben.</p>
	{:else}
		<div class="package-list">
			{#each packages as pkg (pkg.id)}
				{@const state = packageStates[pkg.id] ?? {
					implementState: 'idle' as ImplementState,
					showLogButton: false,
					logOpen: false,
					logContent: ''
				}}
				<DevPackageRow
					pkgId={pkg.id}
					name={pkg.name}
					phase={pkg.phase}
					done={pkg.done}
					implementState={state.implementState}
					showLogButton={state.showLogButton}
					logOpen={state.logOpen}
					logContent={state.logContent}
					onImplement={() => onImplement?.(pkg.id, pkg.name)}
					onLogToggle={() => onLogToggle?.(pkg.id)}
				/>
			{/each}
		</div>
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

	.empty {
		color: var(--muted);
		font-style: italic;
	}

	.package-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
</style>
