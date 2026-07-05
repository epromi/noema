import type { AllProviders } from '$lib/providers/types';
import { getProvider } from '$lib/providers';
import type { CronData, CronEntry } from '$lib/types';
import { buildCronByGroup, classifyCronGroup, emptyCronByGroup, formatSchedule } from './utils.js';

export async function getCrons(providers?: AllProviders): Promise<CronData> {
	const p = providers ?? getProvider();

	try {
		const jobs = await p.cron.listCrons();
		const crons: CronEntry[] = jobs.map((job) => ({
			id: job.id,
			name: job.name,
			agentId: job.agentId ?? 'system',
			schedule: formatSchedule(job.schedule),
			group: classifyCronGroup(job.schedule),
			lastResult: job.state?.lastRunStatus ?? job.status ?? 'unknown',
			enabled: job.enabled,
			lastRunAtMs: job.state?.lastRunAtMs,
			nextRunAtMs: job.state?.nextRunAtMs,
			consecutiveErrors: job.state?.consecutiveErrors ?? 0
		}));

		const healthy = crons.filter((c) => c.lastResult === 'ok').length;

		return {
			crons,
			healthy,
			total: crons.length,
			byGroup: buildCronByGroup(crons),
			updatedAt: Date.now()
		};
	} catch (err) {
		return {
			crons: [],
			healthy: 0,
			total: 0,
			byGroup: emptyCronByGroup(),
			updatedAt: Date.now(),
			error: String(err)
		};
	}
}
