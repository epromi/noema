<script lang="ts">
	import type { AgentData, AgentEntry, H1ViktorStatus } from '$lib/types';

	let {
		agents,
		viktor
	}: {
		agents: AgentData;
		viktor: H1ViktorStatus;
	} = $props();

	const statusOrder: Record<AgentEntry['status'], number> = {
		red: 0,
		yellow: 1,
		green: 2
	};

	const sortedAgents = $derived(
		[...agents.agents].sort((a, b) => {
			const sa = statusOrder[a.status] ?? 3;
			const sb = statusOrder[b.status] ?? 3;
			if (sa !== sb) return sa - sb;
			return a.name.localeCompare(b.name);
		})
	);

	function parseDays(lastRun: string): number {
		if (lastRun === 'Never') return 999;
		const dayMatch = lastRun.match(/^(\d+)d ago$/);
		if (dayMatch) return parseInt(dayMatch[1] ?? '0', 10);
		return 0;
	}

	function staleBorderClass(lastRun: string): string {
		const days = parseDays(lastRun);
		if (days > 3) return 'stale-red';
		if (days >= 1) return 'stale-yellow';
		return 'stale-fresh';
	}

	function statusDotClass(status: AgentEntry['status']): string {
		if (status === 'green') return 'dot-ok';
		if (status === 'yellow') return 'dot-warn';
		return 'dot-error';
	}
</script>

<section class="agents-tab">
	<h3 class="section-title">🤖 Agents</h3>

	{#if agents.error}
		<p class="empty">No agent data — {agents.error}</p>
	{:else if sortedAgents.length === 0}
		<p class="empty">No agents loaded.</p>
	{:else}
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th class="col-emoji"></th>
						<th>Agent</th>
						<th class="col-status">Status</th>
						<th>Status text</th>
						<th>Last run</th>
						<th>Schedule</th>
						<th>Model</th>
						<th>Role</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedAgents as agent (agent.id)}
						<tr class={staleBorderClass(agent.lastRun)}>
							<td class="col-emoji">{agent.emoji}</td>
							<td class="col-name">{agent.name}</td>
							<td class="col-status">
								<span class="status-dot {statusDotClass(agent.status)}" title={agent.statusText}
								></span>
							</td>
							<td>{agent.statusText}</td>
							<td class="mono">{agent.lastRun}</td>
							<td>{agent.schedule}</td>
							<td class="muted">—</td>
							<td class="col-role">{agent.role}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<div class="viktor-mini">
		<span class="viktor-label">🛡️ Viktor</span>
		Total: {viktor.totalCompleted} | Recall: {viktor.recall}% | Pending: —
	</div>
</section>

<style>
	.agents-tab {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.section-title {
		font-size: 0.95em;
		color: var(--accent);
		margin: 0;
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--card);
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88em;
	}

	.data-table th,
	.data-table td {
		padding: 10px 12px;
		text-align: left;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}

	.data-table th {
		color: var(--muted);
		font-weight: 500;
		font-size: 0.82em;
		background: rgba(255, 255, 255, 0.02);
	}

	.data-table tbody tr:last-child td {
		border-bottom: none;
	}

	.data-table tbody tr.stale-fresh {
		border-left: 3px solid var(--green);
	}

	.data-table tbody tr.stale-yellow {
		border-left: 3px solid var(--yellow);
		background: var(--y-bg);
	}

	.data-table tbody tr.stale-red {
		border-left: 3px solid var(--red);
		background: var(--r-bg);
	}

	.col-emoji {
		width: 36px;
		text-align: center;
		font-size: 1.1em;
	}

	.col-status {
		width: 72px;
		white-space: nowrap;
	}

	.col-name {
		font-weight: 500;
		white-space: nowrap;
	}

	.col-role {
		color: var(--muted);
		font-size: 0.92em;
		max-width: 280px;
	}

	.status-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		vertical-align: middle;
	}

	.dot-ok {
		background: var(--green);
	}

	.dot-warn {
		background: var(--yellow);
	}

	.dot-error {
		background: var(--red);
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.92em;
	}

	.muted {
		color: var(--muted);
	}

	.viktor-mini {
		padding: 10px 14px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 0.88em;
		color: var(--muted);
	}

	.viktor-label {
		color: var(--accent);
		font-weight: 500;
		margin-right: 8px;
	}

	.empty {
		color: var(--muted);
		font-style: italic;
		font-size: 0.9em;
	}

	@media (max-width: 768px) {
		.data-table {
			font-size: 0.82em;
		}

		.data-table th,
		.data-table td {
			padding: 8px;
		}

		.col-role {
			max-width: 160px;
		}
	}
</style>
