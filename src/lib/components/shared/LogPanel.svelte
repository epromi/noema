<script lang="ts">
	let {
		open = false,
		content = '',
		pkgId = ''
	}: {
		open?: boolean;
		content?: string;
		pkgId?: string;
	} = $props();

	let preEl = $state<HTMLPreElement | null>(null);

	$effect(() => {
		if (open && preEl && content) {
			preEl.parentElement?.scrollTo(0, preEl.parentElement.scrollHeight);
		}
	});
</script>

{#if open}
	<div class="log-panel" role="region" aria-label="Cursor log for {pkgId}">
		<pre bind:this={preEl}>{content || '⏳ Betöltés...'}</pre>
	</div>
{/if}

<style>
	.log-panel {
		margin-top: 6px;
		padding: 8px;
		background: #0a0e14;
		border: 1px solid var(--border);
		border-radius: 6px;
		max-height: 320px;
		overflow-y: auto;
	}

	.log-panel pre {
		font-family: 'Fira Code', 'Cascadia Code', monospace;
		font-size: 0.78em;
		color: var(--muted);
		white-space: pre-wrap;
		word-break: break-all;
		line-height: 1.5;
		margin: 0;
	}
</style>
