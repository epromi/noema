<script lang="ts">
	import LogPanel from './LogPanel.svelte';
	import ImplementButton from './ImplementButton.svelte';
	import type { ImplementState } from '$lib/types';

	let {
		pkgId,
		name,
		phase,
		done = false,
		implementState = 'idle' as ImplementState,
		showLogButton = false,
		logOpen = false,
		logContent = '',
		onImplement,
		onLogToggle
	}: {
		pkgId: string;
		name: string;
		phase: string;
		done?: boolean;
		implementState?: ImplementState;
		showLogButton?: boolean;
		logOpen?: boolean;
		logContent?: string;
		onImplement?: () => void;
		onLogToggle?: () => void;
	} = $props();
</script>

<div class="pkg-row" class:done>
	<div class="pkg-main">
		<span class="pkg-id">{pkgId}</span>
		<span class="pkg-name">{name}</span>
		<span class="pkg-phase">{phase}</span>
		{#if !done}
			<ImplementButton
				buttonState={implementState}
				{showLogButton}
				{logOpen}
				onImplement={onImplement}
				onLogToggle={onLogToggle}
			/>
		{/if}
	</div>
	<LogPanel open={logOpen} content={logContent} {pkgId} />
</div>

<style>
	.pkg-row {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 8px 10px;
		background: var(--card);
	}

	.pkg-row.done {
		opacity: 0.7;
	}

	.pkg-main {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.pkg-id {
		font-family: monospace;
		font-size: 0.85em;
		color: var(--accent);
		flex-shrink: 0;
	}

	.pkg-name {
		flex: 1;
		min-width: 120px;
	}

	.pkg-phase {
		font-size: 0.82em;
		color: var(--muted);
	}
</style>
