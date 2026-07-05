<script lang="ts">
	import type { H1ViktorStatus } from '$lib/types';

	let { viktor }: { viktor: H1ViktorStatus } = $props();

	function recallClass(recall: number): string {
		if (recall >= 90) return 'ok';
		if (recall >= 70) return 'warn';
		return 'error';
	}

	function circuitClass(circuit: string): string {
		if (circuit === 'TRIPPED') return 'error';
		if (circuit === 'Warning') return 'warn';
		return 'ok';
	}

	function trendDirection(trend: H1ViktorStatus['recallTrend']): string {
		if (trend.length < 2) return '→';
		const first = trend[0]?.recall ?? 0;
		const last = trend[trend.length - 1]?.recall ?? 0;
		const delta = last - first;
		if (delta > 0.5) return '↑';
		if (delta < -0.5) return '↓';
		return '→';
	}

	function trendLabel(trend: H1ViktorStatus['recallTrend']): string {
		const dir = trendDirection(trend);
		if (dir === '↑') return 'improving';
		if (dir === '↓') return 'declining';
		return 'stable';
	}

	const trendValues = $derived(
		viktor.recallTrend.map((p) => `${p.recall}%`).join(' → ')
	);
</script>

<section class="viktor-tab">
	<h3 class="section-title">🛡️ Viktor Security Audit</h3>

	<div class="metrics-bar">
		<div class="metric-card">
			<div class="metric-value">{viktor.totalCompleted}</div>
			<div class="metric-label">Total audits</div>
		</div>

		<div class="metric-card {recallClass(viktor.recall)}">
			<div class="metric-value">{viktor.recall}%</div>
			<div class="metric-label">Recall</div>
		</div>

		<div class="metric-card">
			<div class="metric-value">{viktor.pending}</div>
			<div class="metric-label">Pending repos</div>
		</div>

		<div class="metric-card" class:warn={viktor.failed > 0}>
			<div class="metric-value">{viktor.failed}</div>
			<div class="metric-label">Failed</div>
		</div>
	</div>

	<div class="circuit-row">
		<span class="circuit-label">Circuit</span>
		<span class="circuit-badge {circuitClass(viktor.circuit)}">{viktor.circuit}</span>
		{#if viktor.activeLabel}
			<span class="active-label">Active: {viktor.activeLabel}</span>
		{/if}
	</div>

	<div class="panel">
		<h4 class="panel-title">📈 Recall trend (last 5 runs)</h4>
		{#if viktor.recallTrend.length === 0}
			<p class="empty">No Cortex run data yet.</p>
		{:else}
			<div class="trend-row">
				<span class="trend-arrow" title={trendLabel(viktor.recallTrend)}>
					{trendDirection(viktor.recallTrend)}
				</span>
				<span class="trend-values">{trendValues}</span>
			</div>
			<div class="trend-meta muted">
				{#each viktor.recallTrend as point (point.run)}
					<span>R{point.run} ({point.date})</span>
				{/each}
			</div>
		{/if}
	</div>

	<div class="panel">
		<h4 class="panel-title warn-title">⚠️ Blind spots</h4>
		{#if viktor.blindSpots.length === 0}
			<p class="empty">No CWE blind spots detected.</p>
		{:else}
			<ul class="blind-list">
				{#each viktor.blindSpots as cwe (cwe)}
					<li>{cwe}</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="panel">
		<h4 class="panel-title">⏳ Pending repos</h4>
		{#if viktor.pendingRepos.length === 0}
			<p class="empty">No repos queued.</p>
		{:else}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Repo</th>
							<th>Priority</th>
							<th>Age</th>
						</tr>
					</thead>
					<tbody>
						{#each viktor.pendingRepos as repo (repo.name + repo.priority)}
							<tr>
								<td class="col-name">{repo.name}</td>
								<td>{repo.priority}</td>
								<td class="muted">{repo.age}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</section>

<style>
	.viktor-tab {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.section-title {
		font-size: 0.95em;
		color: var(--accent);
		margin: 0;
	}

	.metrics-bar {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}

	.metric-card {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 14px;
		text-align: center;
	}

	.metric-card.ok {
		border-color: var(--green);
		background: var(--g-bg);
	}

	.metric-card.warn {
		border-color: var(--yellow);
		background: var(--y-bg);
	}

	.metric-card.error {
		border-color: var(--red);
		background: var(--r-bg);
	}

	.metric-value {
		font-size: 1.4em;
		font-weight: 600;
		color: var(--text);
	}

	.metric-label {
		font-size: 0.85em;
		color: var(--muted);
		margin-top: 4px;
	}

	.circuit-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 0.88em;
	}

	.circuit-label {
		color: var(--muted);
	}

	.circuit-badge {
		padding: 2px 10px;
		border-radius: 4px;
		font-weight: 500;
		font-size: 0.85em;
	}

	.circuit-badge.ok {
		background: var(--g-bg);
		color: var(--green);
		border: 1px solid var(--green);
	}

	.circuit-badge.warn {
		background: var(--y-bg);
		color: var(--yellow);
		border: 1px solid var(--yellow);
	}

	.circuit-badge.error {
		background: var(--r-bg);
		color: var(--red);
		border: 1px solid var(--red);
	}

	.active-label {
		color: var(--muted);
		margin-left: auto;
	}

	.panel {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px 14px;
	}

	.panel-title {
		font-size: 0.88em;
		color: var(--accent);
		margin: 0 0 8px;
		font-weight: 500;
	}

	.warn-title {
		color: var(--yellow);
	}

	.trend-row {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.95em;
	}

	.trend-arrow {
		font-size: 1.4em;
		font-weight: 600;
		color: var(--accent);
		min-width: 24px;
	}

	.trend-values {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: var(--text);
	}

	.trend-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
		margin-top: 8px;
		font-size: 0.78em;
	}

	.blind-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.blind-list li {
		padding: 4px 10px;
		background: var(--y-bg);
		border: 1px solid var(--yellow);
		border-radius: 4px;
		font-size: 0.82em;
		color: var(--yellow);
	}

	.table-wrap {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88em;
	}

	.data-table th,
	.data-table td {
		padding: 8px 10px;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	.data-table th {
		color: var(--muted);
		font-weight: 500;
		font-size: 0.82em;
	}

	.data-table tbody tr:last-child td {
		border-bottom: none;
	}

	.col-name {
		font-weight: 500;
	}

	.muted {
		color: var(--muted);
	}

	.empty {
		color: var(--muted);
		font-style: italic;
		font-size: 0.9em;
		margin: 0;
	}

	@media (max-width: 768px) {
		.metrics-bar {
			grid-template-columns: repeat(2, 1fr);
		}

		.circuit-row {
			flex-wrap: wrap;
		}

		.active-label {
			margin-left: 0;
			width: 100%;
		}
	}
</style>
