<script lang="ts">
	import type { AgentData, AgentEntry, CronData, H1Data, HealthData } from '$lib/types';

	let {
		crons,
		agents,
		health,
		h1,
		hostname
	}: {
		crons: CronData;
		agents: AgentData;
		health: HealthData;
		h1: H1Data;
		hostname: string;
	} = $props();

	function na(value: string | number | undefined | null): string {
		if (value == null || value === '' || value === 'unknown') return 'N/A';
		return String(value);
	}

	function cronMetricClass(healthy: number, total: number): string {
		if (total === 0) return 'muted';
		const ratio = healthy / total;
		if (ratio === 1) return 'ok';
		if (ratio >= 0.7) return 'warn';
		return 'error';
	}

	function agentMetricClass(online: number, total: number): string {
		if (total === 0) return 'muted';
		if (online > 0) return 'ok';
		return 'warn';
	}

	function diskPercent(disk: string): string {
		const match = disk.match(/(\d+)%/);
		return match?.[1] ? `${match[1]}%` : na(disk);
	}

	function isStale(agent: AgentEntry): boolean {
		if (agent.status !== 'green') return true;
		const match = agent.lastRun.match(/^(\d+)d ago$/);
		return match ? parseInt(match[1] ?? '0', 10) > 3 : false;
	}

	function statusDotClass(status: AgentEntry['status']): string {
		if (status === 'green') return 'dot-ok';
		if (status === 'yellow') return 'dot-warn';
		return 'dot-error';
	}
</script>

<section class="overview-tab">
	<div class="system-bar">
		<span class="sys-item"><strong>{na(hostname)}</strong></span>
		<span class="sys-item">Uptime: {na(health.uptime)}</span>
		<span class="sys-item">Disk: {na(health.disk)}</span>
		<span class="sys-item">RAM: {na(health.ram)}</span>
		{#if health.error}
			<span class="sys-item sys-error">⚠ {health.error}</span>
		{/if}
	</div>

	<div class="metrics-bar">
		<div class="metric-card {cronMetricClass(crons.healthy, crons.total)}">
			<div class="metric-value">
				{crons.error ? 'N/A' : `${crons.healthy}/${crons.total}`}
			</div>
			<div class="metric-label">Crons</div>
			<div class="metric-sub">
				{crons.error ? 'No data' : crons.total === 0 ? 'No crons' : `${crons.total - crons.healthy} failing`}
			</div>
		</div>

		<div class="metric-card {agentMetricClass(agents.online, agents.total)}">
			<div class="metric-value">
				{agents.error ? 'N/A' : `${agents.online}/${agents.total}`}
			</div>
			<div class="metric-label">Agents Active</div>
			<div class="metric-sub">
				{agents.error ? 'No data' : `${agents.stale} stale`}
			</div>
		</div>

		<div class="metric-card">
			<div class="metric-value">
				{h1.error ? 'N/A' : na(h1.signal.signal)}
			</div>
			<div class="metric-label">H1 Signal</div>
			<div class="metric-sub">
				Rep: {h1.error ? 'N/A' : na(h1.signal.reputation)}
			</div>
		</div>

		<div class="metric-card">
			<div class="metric-value">{diskPercent(health.disk)}</div>
			<div class="metric-label">Disk</div>
			<div class="metric-sub">{na(health.ram)}</div>
		</div>
	</div>

	<h3 class="section-title">🤖 Agents</h3>
	{#if agents.error}
		<p class="empty">No agent data — {agents.error}</p>
	{:else if agents.agents.length === 0}
		<p class="empty">No agents loaded.</p>
	{:else}
		<div class="agent-grid">
			{#each agents.agents as agent (agent.id)}
				<div class="agent-card">
					<div class="agent-header">
						<span class="agent-emoji">{agent.emoji}</span>
						<span class="agent-name">{agent.name}</span>
						<span class="status-dot {statusDotClass(agent.status)}" title={agent.statusText}></span>
					</div>
					<div class="agent-meta">{agent.lastActive || agent.lastRun}</div>
					{#if isStale(agent)}
						<div class="stale-warn">⚠ Stale</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<h3 class="section-title">🏴 HackerOne</h3>
	<div class="h1-grid">
		<div class="card">
			<div class="card-row">
				<span class="lbl">Open reports</span>
				<span class="val">{h1.error ? 'N/A' : na(h1.stats.open)}</span>
			</div>
			<div class="card-row">
				<span class="lbl">Bounty earned</span>
				<span class="val">{h1.error ? 'N/A' : na(h1.balance)}</span>
			</div>
		</div>
		<div class="card">
			<div class="card-row">
				<span class="lbl">Signal</span>
				<span class="val">{h1.error ? 'N/A' : na(h1.stats.signal)}</span>
			</div>
			<div class="card-row">
				<span class="lbl">Reputation</span>
				<span class="val">{h1.error ? 'N/A' : na(h1.stats.reputation)}</span>
			</div>
			<div class="card-row">
				<span class="lbl">Trials</span>
				<span class="val">{h1.error ? 'N/A' : na(h1.stats.trial)}</span>
			</div>
		</div>
	</div>
</section>

<style>
	.overview-tab {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.system-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 20px;
		padding: 10px 14px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 0.88em;
		color: var(--muted);
	}

	.sys-item strong {
		color: var(--text);
	}

	.sys-error {
		color: var(--error);
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

	.metric-sub {
		font-size: 0.78em;
		color: var(--muted);
		margin-top: 2px;
	}

	.section-title {
		font-size: 0.95em;
		color: var(--accent);
		margin: 4px 0 0;
	}

	.agent-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}

	.agent-card {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 10px 12px;
	}

	.agent-header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.agent-emoji {
		font-size: 1.1em;
	}

	.agent-name {
		font-weight: 500;
		font-size: 0.9em;
		flex: 1;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
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

	.agent-meta {
		font-size: 0.78em;
		color: var(--muted);
		margin-top: 4px;
	}

	.stale-warn {
		font-size: 0.75em;
		color: var(--warn);
		margin-top: 4px;
	}

	.h1-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.card {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px 14px;
	}

	.card-row {
		display: flex;
		justify-content: space-between;
		padding: 4px 0;
		font-size: 0.88em;
	}

	.lbl {
		color: var(--muted);
	}

	.val {
		color: var(--text);
		font-weight: 500;
	}

	.empty {
		color: var(--muted);
		font-style: italic;
		font-size: 0.9em;
	}

	@media (max-width: 768px) {
		.metrics-bar {
			grid-template-columns: repeat(2, 1fr);
		}

		.agent-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.h1-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
