<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { buildCronSidebarRows } from '$lib/core/cron-sidebar';
	import type { CronData } from '$lib/types';

	const REFRESH_MS = 30_000;
	const STORAGE_KEY = 'noema-cron-sidebar-collapsed';

	let {
		crons,
		variant = 'sidebar'
	}: {
		crons: CronData;
		variant?: 'sidebar' | 'inline';
	} = $props();

	let now = $state(new Date());
	let collapsed = $state(false);
	let refreshTimer: ReturnType<typeof setInterval> | undefined;

	let displayData = $derived(buildCronSidebarRows(crons.crons, now));

	onMount(() => {
		try {
			collapsed = localStorage.getItem(STORAGE_KEY) === '1';
		} catch {
			collapsed = false;
		}

		refreshTimer = setInterval(() => {
			now = new Date();
		}, REFRESH_MS);
	});

	onDestroy(() => {
		if (refreshTimer) clearInterval(refreshTimer);
	});

	function toggleCollapsed() {
		collapsed = !collapsed;
		try {
			localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
		} catch {
			/* ignore */
		}
	}

	function statusClass(status: 'ok' | 'error' | 'warning'): string {
		if (status === 'ok') return 'status-ok';
		if (status === 'error') return 'status-error';
		return 'status-warn';
	}
</script>

<aside
	class="cron-sidebar"
	class:collapsed
	class:inline={variant === 'inline'}
	aria-label="Cron schedule sidebar"
>
	<header class="sidebar-header">
		<button
			type="button"
			class="toggle-btn"
			onclick={toggleCollapsed}
			aria-expanded={!collapsed}
			aria-label={collapsed ? 'Expand cron sidebar' : 'Collapse cron sidebar'}
		>
			{collapsed ? '▶' : '◀'}
		</button>
		{#if !collapsed}
			<span class="sidebar-title">⏰ Cronok</span>
			<span class="sidebar-clock">{displayData.clockLabel}</span>
		{/if}
	</header>

	{#if crons.error}
		<p class="sidebar-error">{crons.error}</p>
	{:else if displayData.rows.length === 0}
		<p class="sidebar-empty">No cron data</p>
	{:else}
		<ul class="cron-list">
			{#each displayData.rows as row (row.kind === 'now' ? 'now' : row.id)}
				{#if row.kind === 'now'}
					<li class="cr-item now-marker">
						<span class="now-label">NOW {row.clockLabel}</span>
					</li>
				{:else}
					<li
						class="cr-item {statusClass(row.status)}"
						class:past={row.isPast}
						class:next={row.isNext}
						title={row.name}
					>
						{#if collapsed}
							<span class="cr-emoji" title={row.name}>{row.emoji}</span>
						{:else}
							<span class="cr-time">{row.timeLabel}</span>
							<span class="cr-emoji">{row.emoji}</span>
							<div class="cr-body">
								<span class="cr-name">{row.shortName}</span>
								<span class="cr-countdown">{row.countdown}</span>
							</div>
						{/if}
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</aside>

<style>
	.cron-sidebar {
		width: 280px;
		min-width: 280px;
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-y: auto;
		background: var(--card);
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	.cron-sidebar.inline {
		position: static;
		width: 100%;
		min-width: 0;
		height: auto;
		border-left: none;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.cron-sidebar.collapsed {
		width: 40px;
		min-width: 40px;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 8px;
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		background: var(--card);
		z-index: 1;
	}

	.collapsed .sidebar-header {
		flex-direction: column;
		padding: 8px 4px;
	}

	.toggle-btn {
		background: none;
		border: 1px solid var(--border);
		color: var(--muted);
		cursor: pointer;
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 0.75em;
		line-height: 1.2;
	}

	.toggle-btn:hover {
		color: var(--text);
		border-color: var(--accent);
	}

	.sidebar-title {
		font-size: 0.9em;
		font-weight: 600;
		flex: 1;
	}

	.sidebar-clock {
		font-size: 0.78em;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.sidebar-error,
	.sidebar-empty {
		padding: 12px 8px;
		color: var(--muted);
		font-size: 0.85em;
	}

	.sidebar-error {
		color: var(--error);
	}

	.cron-list {
		list-style: none;
		padding: 4px 0 16px;
		margin: 0;
	}

	.cr-item {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 4px 8px;
		border-left: 2px solid transparent;
		font-size: 0.82em;
		transition: background 0.15s;
	}

	.cr-item:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.cr-item.status-ok {
		border-left-color: var(--green);
	}

	.cr-item.status-error {
		border-left-color: var(--red);
	}

	.cr-item.status-warn {
		border-left-color: var(--yellow);
	}

	.cr-item.past {
		opacity: 0.45;
	}

	.cr-item.next {
		background: rgba(88, 166, 255, 0.08);
		box-shadow: inset 2px 0 0 var(--accent);
	}

	.cr-item.now-marker {
		border-top: 2px solid var(--red);
		border-bottom: 2px solid var(--red);
		background: rgba(248, 81, 73, 0.08);
		justify-content: center;
		padding: 6px 8px;
		animation: now-pulse 2s ease-in-out infinite;
	}

	.now-label {
		color: var(--red);
		font-size: 0.78em;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	@keyframes now-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	.cr-time {
		font-variant-numeric: tabular-nums;
		color: var(--muted);
		min-width: 36px;
	}

	.cr-emoji {
		flex-shrink: 0;
	}

	.cr-body {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.cr-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cr-countdown {
		color: var(--muted);
		font-size: 0.9em;
	}

	.collapsed .cr-item {
		justify-content: center;
		padding: 6px 4px;
	}

	@media (max-width: 900px) and (min-width: 600px) {
		.cron-sidebar:not(.inline) {
			width: 220px;
			min-width: 220px;
		}

		.cron-sidebar:not(.inline) .cr-item {
			font-size: 0.76em;
		}
	}

	@media (max-width: 599px) {
		.cron-sidebar:not(.inline) {
			display: none;
		}
	}
</style>
