import type { AllProviders } from '$lib/providers/types';
import { fileAgeDays } from '$lib/providers/openclaw';
import { getProvider } from '$lib/providers';
import type { AgentCardStatus, AgentData, AgentEntry } from '$lib/types';
import { staleLevel } from './utils.js';

const AGENT_DEFS = [
	{ id: 'otto', name: 'Otto', emoji: '🗄️', schedule: '03:00 + 03:35', role: 'Back Office — Nightly compilation + KG' },
	{ id: 'viktor', name: 'Viktor', emoji: '🛡️', schedule: 'On-demand', role: 'Security Analyst — Repo audit pipeline' },
	{ id: 'scout', name: 'Scout', emoji: '🏕️', schedule: 'On-demand (auto-spawn)', role: 'Intel — H1 program discovery' },
	{ id: 'porter', name: 'Porter', emoji: '🚪', schedule: '06-23 hourly', role: 'Email Triage — Gmail filtering' },
	{ id: 'edwin', name: 'Edwin', emoji: '🚀', schedule: '09:00 daily', role: 'Jarvis Driver — Events + monitoring' },
	{ id: 'hugo', name: 'Hugo', emoji: '📚', schedule: '20:00 nightly', role: 'Repo Prep — Advisory → answer keys' },
	{ id: 'cortex', name: 'Cortex', emoji: '🧠', schedule: '06:30 /3d', role: 'Optimizer — System tuning' },
	{ id: 'alfred', name: 'Alfred', emoji: '👔', schedule: 'Active (main)', role: 'Chief of Staff — Orchestration' }
] as const;

function cardStatus(days: number): { status: AgentCardStatus; statusText: string; stale: number } {
	const sl = staleLevel(days);
	if (sl >= 7) return { status: 'red', statusText: `Stale (${days}d)`, stale: sl };
	if (sl >= 3) return { status: 'yellow', statusText: `Aging (${days}d)`, stale: sl };
	return { status: 'green', statusText: 'Active', stale: sl };
}

export async function getAgents(providers?: AllProviders): Promise<AgentData> {
	const p = providers ?? getProvider();

	try {
		const sessions = await p.session.listSessions({ limit: 500 });
		const sessionCounts = new Map<string, number>();
		for (const s of sessions) {
			const id = s.agentId ?? 'unknown';
			sessionCounts.set(id, (sessionCounts.get(id) ?? 0) + 1);
		}

		const agents: AgentEntry[] = [];

		for (const def of AGENT_DEFS) {
			let days = 999;
			try {
				const statusFile = await p.filesystem.readAgentStatus(def.id);
				days = await fileAgeDays(statusFile.path);
			} catch {
				/* fallback to stale */
			}

			const { status, statusText, stale } = cardStatus(days);
			agents.push({
				id: def.id,
				name: def.name,
				emoji: def.emoji,
				status,
				statusText,
				staleLevel: stale,
				lastRun: days === 999 ? 'Never' : `${days}d ago`,
				schedule: def.schedule,
				role: def.role,
				activeSessions: sessionCounts.get(def.id) ?? 0
			});
		}

		return {
			agents,
			online: agents.filter((a) => a.status === 'green').length,
			total: agents.length,
			stale: agents.filter((a) => a.staleLevel >= 7).length,
			updatedAt: Date.now()
		};
	} catch (err) {
		return {
			agents: [],
			online: 0,
			total: 0,
			stale: 0,
			updatedAt: Date.now(),
			error: String(err)
		};
	}
}

export async function getAgentDetail(agentId: string, providers?: AllProviders): Promise<AgentEntry | null> {
	const data = await getAgents(providers);
	return data.agents.find((a) => a.id === agentId) ?? null;
}
