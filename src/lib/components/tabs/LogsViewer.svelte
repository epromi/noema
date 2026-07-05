<script lang="ts">
	import type { LogData, LogEntry, LogFilter } from '$lib/types';

	let { logs }: { logs: LogData } = $props();

	let activeFilter = $state<LogFilter>('all');

	const filteredEntries = $derived(
		activeFilter === 'all'
			? logs.entries
			: activeFilter === 'errors'
				? logs.entries.filter((entry) => entry.level === 'ERROR')
				: logs.entries.filter((entry) => entry.level === 'WARN')
	);

	const FILTERS: { id: LogFilter; label: string; count: number }[] = $derived([
		{ id: 'all', label: 'All', count: logs.total },
		{ id: 'errors', label: 'Errors', count: logs.counts.error },
		{ id: 'warnings', label: 'Warnings', count: logs.counts.warn }
	]);

	function levelClass(level: LogEntry['level']): string {
		switch (level) {
			case 'ERROR':
				return 'level-error';
			case 'WARN':
				return 'level-warn';
			case 'INFO':
				return 'level-info';
			case 'DEBUG':
				return 'level-debug';
			default:
				return 'level-other';
		}
	}
</script>

<section class="logs-tab">
	<h3 class="section-title">📋 Logs</h3>
	<p class="subtitle">Last 500 lines from ~/.openclaw/logs/</p>

	{#if logs.error}
		<p class="empty">No log data — {logs.error}</p>
	{:else}
		<div class="filter-bar" role="toolbar" aria-label="Log filters">
			{#each FILTERS as filter (filter.id)}
				<button
					type="button"
					class="filter-btn"
					class:active={activeFilter === filter.id}
					onclick={() => (activeFilter = filter.id)}
				>
					{filter.label}
					<span class="count">{filter.count}</span>
				</button>
			{/each}
		</div>

		{#if filteredEntries.length === 0}
			<p class="empty">No lines match this filter.</p>
		{:else}
			<div class="log-viewer" role="log" aria-live="polite">
				{#each filteredEntries as entry (entry.lineNum + entry.raw)}
					<div class="log-line {levelClass(entry.level)}">
						<span class="line-num">{entry.lineNum}</span>
						{#if entry.timestamp}
							<span class="timestamp">{entry.timestamp}</span>
						{/if}
						<span class="level-tag">{entry.level}</span>
						<span class="message">{entry.message}</span>
					</div>
				{/each}
			</div>
		{/if}

		<p class="meta">
			{filteredEntries.length} / {logs.total} lines · updated {new Date(
				logs.updatedAt
			).toLocaleTimeString()}
		</p>
	{/if}
</section>

<style>
	.logs-tab {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 16px;
	}

	.section-title {
		font-size: 1.05em;
		margin-bottom: 4px;
	}

	.subtitle {
		color: var(--muted);
		font-size: 0.85em;
		margin-bottom: 12px;
	}

	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}

	.filter-btn {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text);
		cursor: pointer;
		font-size: 0.88em;
		padding: 6px 12px;
	}

	.filter-btn.active {
		border-color: var(--accent);
		color: var(--accent);
	}

	.filter-btn .count {
		color: var(--muted);
		margin-left: 6px;
	}

	.log-viewer {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.78em;
		max-height: 70vh;
		overflow: auto;
		padding: 8px 0;
	}

	.log-line {
		display: grid;
		grid-template-columns: 48px minmax(80px, auto) 56px 1fr;
		gap: 8px;
		line-height: 1.45;
		padding: 2px 12px;
		word-break: break-word;
	}

	.line-num {
		color: var(--muted);
		text-align: right;
	}

	.timestamp {
		color: var(--muted);
		white-space: nowrap;
	}

	.level-tag {
		font-weight: 600;
		text-transform: uppercase;
	}

	.message {
		white-space: pre-wrap;
	}

	.level-error {
		background: var(--r-bg);
		color: var(--error);
	}

	.level-warn {
		background: var(--y-bg);
		color: var(--warn);
	}

	.level-info {
		color: var(--accent);
	}

	.level-debug,
	.level-other {
		color: var(--muted);
	}

	.empty,
	.meta {
		color: var(--muted);
		font-size: 0.88em;
	}

	.meta {
		margin-top: 10px;
	}

	@media (max-width: 768px) {
		.log-line {
			grid-template-columns: 36px 1fr;
		}

		.timestamp,
		.level-tag {
			display: none;
		}
	}
</style>
