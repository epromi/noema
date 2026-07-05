import type { DashboardData } from '$lib/types';
import { getAgents } from './agents.js';
import { getBills } from './bills.js';
import { getCalendar } from './calendar.js';
import { getCrons } from './crons.js';
import { getH1Data } from './h1.js';
import { getHealth } from './health.js';
import { getNoema } from './noema.js';
import { getResearch } from './research.js';

export async function getAllData(): Promise<DashboardData> {
	const [crons, agents, health, h1, calendar, bills, research, noema] = await Promise.all([
		getCrons(),
		getAgents(),
		getHealth(),
		getH1Data(),
		getCalendar(),
		getBills(),
		getResearch(),
		getNoema()
	]);

	return {
		meta: { loadedAt: Date.now() },
		crons,
		agents,
		health,
		h1,
		calendar,
		bills,
		research,
		noema
	};
}

export { getAgents, getBills, getCalendar, getCrons, getH1Data, getHealth, getNoema, getResearch };
