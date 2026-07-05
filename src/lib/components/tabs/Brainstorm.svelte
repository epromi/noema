<script lang="ts">
	import type { BrainstormData, BrainstormItemStatus } from '$lib/types';

	let { brainstorm }: { brainstorm: BrainstormData } = $props();

	const STATUS_ICONS: Record<BrainstormItemStatus, string> = {
		done: '✅',
		waiting: '⏳',
		pending: '📋'
	};

	const sectionsWithItems = $derived(
		brainstorm.sections.filter((section) => section.items.length > 0)
	);
</script>

<section class="brainstorm-tab">
	<div class="tab-header">
		<h2 class="section-title">🧠 Brainstorming Action Tracker</h2>
		<div class="pending-badge">
			<span class="pending-count">{brainstorm.pending}</span>
			<span class="pending-label">pending</span>
		</div>
	</div>

	{#if brainstorm.error}
		<p class="empty">Brainstorm data unavailable — {brainstorm.error}</p>
	{:else if sectionsWithItems.length === 0}
		<div class="card wide empty-card">
			<p>No brainstorming items tracked. Run the brainstorming cron to populate.</p>
		</div>
	{:else}
		<div class="grid">
			{#each sectionsWithItems as section (section.key)}
				<div class="card section-card" style:border-left-color={section.color}>
					<h3 style:color={section.color}>{section.label}</h3>
					<p class="section-desc">{section.desc}</p>
					{#each section.items as item (item.id)}
						<div
							class="item-row"
							class:item-done={item.done}
							style:background={!item.done && section.bgColor ? section.bgColor : undefined}
						>
							<span class="item-icon">{STATUS_ICONS[item.status]}</span>
							<div class="item-body">
								<span class="item-id">{item.id}</span>
								{item.name}
								{#if item.source || item.age}
									<span class="item-meta">
										{item.source}{#if item.source && item.age} · {/if}{item.age}
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	<p class="legend">
		Source: memory/brainstorming/action-tracker.md · Items not seen here are invisible → they rot.
	</p>
</section>

<style>
	.brainstorm-tab {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.tab-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.section-title {
		font-size: 1em;
		color: var(--accent);
		font-weight: 600;
	}

	.pending-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 16px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		min-width: 72px;
	}

	.pending-count {
		font-size: 1.4em;
		font-weight: 700;
		color: var(--yellow);
		line-height: 1.1;
	}

	.pending-label {
		font-size: 0.78em;
		color: var(--muted);
		text-transform: uppercase;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 14px;
	}

	.card {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 14px;
	}

	.card.wide {
		grid-column: 1 / -1;
	}

	.section-card {
		border-left: 3px solid var(--accent);
	}

	.section-card h3 {
		font-size: 0.95em;
		margin-bottom: 4px;
	}

	.section-desc {
		font-size: 0.88em;
		color: var(--muted);
		margin-bottom: 8px;
	}

	.item-row {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		font-size: 0.92em;
		line-height: 1.4;
		padding: 4px 8px;
		border-radius: 4px;
		margin: 4px 0;
	}

	.item-done {
		opacity: 0.65;
	}

	.item-icon {
		flex-shrink: 0;
		font-size: 0.89em;
	}

	.item-body {
		flex: 1;
	}

	.item-id {
		font-family: monospace;
		color: var(--accent);
		font-size: 0.92em;
		margin-right: 6px;
	}

	.item-meta {
		display: block;
		color: var(--muted);
		font-size: 0.88em;
	}

	.empty,
	.empty-card {
		color: var(--muted);
		text-align: center;
		font-size: 0.92em;
	}

	.legend {
		text-align: center;
		font-size: 0.88em;
		color: var(--muted);
		padding: 12px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	@media (max-width: 768px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
