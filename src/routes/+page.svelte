<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import type { PageData } from './$types';
	import Noema from '$lib/components/tabs/Noema.svelte';
	import type { ImplementState } from '$lib/types';

	const RELAY_URL = 'http://127.0.0.1:18998';
	const LOG_POLL_MS = 3000;

	let { data }: { data: PageData } = $props();

	const tabContext = getContext<{ current: string }>('noema-active-tab');

	type PkgState = {
		implementState: ImplementState;
		showLogButton: boolean;
		logOpen: boolean;
		logContent: string;
	};

	let packageStates = $state<Record<string, PkgState>>({});
	const pollers = new Map<string, ReturnType<typeof setInterval>>();

	function defaultState(): PkgState {
		return {
			implementState: 'idle',
			showLogButton: false,
			logOpen: false,
			logContent: ''
		};
	}

	function getState(pkgId: string): PkgState {
		return packageStates[pkgId] ?? defaultState();
	}

	function setState(pkgId: string, patch: Partial<PkgState>) {
		packageStates[pkgId] = { ...getState(pkgId), ...patch };
	}

	async function fetchLog(pkgId: string) {
		try {
			const res = await fetch(`/api/log/${encodeURIComponent(pkgId)}`);
			const body = await res.json();
			setState(pkgId, { logContent: body.content ?? '' });
		} catch (err) {
			setState(pkgId, { logContent: `❌ Hiba: ${String(err)}` });
		}
	}

	function startLogPoll(pkgId: string) {
		stopLogPoll(pkgId);
		void fetchLog(pkgId);
		pollers.set(
			pkgId,
			setInterval(() => {
				void fetchLog(pkgId);
			}, LOG_POLL_MS)
		);
	}

	function stopLogPoll(pkgId: string) {
		const timer = pollers.get(pkgId);
		if (timer) {
			clearInterval(timer);
			pollers.delete(pkgId);
		}
	}

	async function handleImplement(pkgId: string, name: string) {
		setState(pkgId, { implementState: 'running' });

		try {
			const res = await fetch(`${RELAY_URL}/action`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'implement',
					id: pkgId,
					description: `${pkgId}: ${name}`
				})
			});
			const body = await res.json();

			if (body.ok) {
				setState(pkgId, { implementState: 'running', showLogButton: true });
			} else {
				setState(pkgId, { implementState: 'error' });
				setTimeout(() => setState(pkgId, { implementState: 'idle' }), 2000);
			}
		} catch {
			setState(pkgId, { implementState: 'offline' });
			setTimeout(() => setState(pkgId, { implementState: 'idle' }), 2000);
		}
	}

	function handleLogToggle(pkgId: string) {
		const current = getState(pkgId);
		const nextOpen = !current.logOpen;
		setState(pkgId, { logOpen: nextOpen });

		if (nextOpen) {
			startLogPoll(pkgId);
		} else {
			stopLogPoll(pkgId);
		}
	}

	onDestroy(() => {
		for (const pkgId of pollers.keys()) {
			stopLogPoll(pkgId);
		}
	});
</script>

<main class="dashboard-main">
	<h2 class="sr-only">Noema 🧠</h2>

	{#if tabContext?.current === 'noema'}
		<Noema
			packages={data.devPackages.packages}
			{packageStates}
			onImplement={handleImplement}
			onLogToggle={handleLogToggle}
		/>
	{:else}
		<div class="dashboard-placeholder">
			<p><strong>Noema 🧠</strong> — SvelteKit scaffold ready.</p>
			<p>Active tab: {tabContext?.current ?? 'overview'}</p>
			<p>Loaded at: {new Date(data.loadedAt).toLocaleString()}</p>
			<p>Tab components arrive in PKG-002+.</p>
		</div>
	{/if}
</main>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.dashboard-placeholder {
		padding: 24px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--muted);
	}

	.dashboard-placeholder p + p {
		margin-top: 8px;
	}
</style>
