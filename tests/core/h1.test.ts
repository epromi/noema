import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getH1Data,
	getH1Balance,
	getH1Programs,
	getH1Reports,
	getH1ViktorStatus,
	getH1Stats,
	getH1Signal,
	clearH1Cache,
	extractH1Json,
	parseH1Balance,
	parseH1Programs,
	parseH1Reports,
	parseH1SignalFromReports,
	parseH1FromAtAGlance,
	parseH1ViktorStatus
} from '$lib/core/h1';
import { createMockProviders } from './mock-providers';

const SAMPLE_REPORTS_JSON = {
	data: [
		{
			id: '1001',
			attributes: {
				title: 'Test finding',
				state: 'new',
				created_at: '2026-07-01T10:00:00Z',
				severity_rating: 'high'
			},
			relationships: {
				reporter: { data: { attributes: { signal: 7.5, reputation: 120 } } },
				program: { data: { attributes: { handle: 'acme' } } }
			}
		},
		{
			id: '1002',
			attributes: {
				title: 'Duplicate',
				state: 'duplicate',
				created_at: '2026-06-01T10:00:00Z'
			}
		},
		{
			id: '1003',
			attributes: {
				title: 'Resolved',
				state: 'resolved',
				created_at: '2026-05-01T10:00:00Z'
			}
		},
		{
			id: '1004',
			attributes: {
				title: 'N/A',
				state: 'not-applicable',
				created_at: '2026-04-01T10:00:00Z'
			}
		}
	]
};

const SAMPLE_PROGRAMS_JSON = {
	data: [
		{
			id: '1',
			attributes: {
				handle: 'ruby',
				name: 'Ruby',
				offers_bounties: true,
				submission_state: 'open'
			}
		},
		{
			id: '2',
			attributes: {
				handle: 'rails',
				name: 'Rails',
				offers_bounties: false,
				submission_state: 'open'
			}
		}
	]
};

const SAMPLE_VIKTOR_STATE = {
	totalCompleted: 42,
	activeLabel: 'crossplane',
	circuitBreaker: { tripped: false },
	transferValidation: { h1FindingsSubmitted: 3, h1FindingsAccepted: 1 },
	repos: [
		{ status: 'done', recallX: 3, recallY: 4 },
		{ status: 'done', recallX: 2, recallY: 2 }
	]
};

function createH1Mock(overrides: Parameters<typeof createMockProviders>[0] = {}) {
	let programsCalls = 0;
	const base = createMockProviders({
		...overrides,
		tool: {
			h1Command: async (cmd: string) => {
				if (cmd === 'balance') return JSON.stringify({ data: { balance: 100.5 } });
				if (cmd === 'programs') {
					programsCalls++;
					return `📋 Programs...\n${JSON.stringify(SAMPLE_PROGRAMS_JSON)}`;
				}
				if (cmd === 'my-reports') {
					return `📋 Reports...\n${JSON.stringify(SAMPLE_REPORTS_JSON)}`;
				}
				return '';
			},
			gogCommand: async () => '',
			execCommand: async () => 'ok',
			...overrides.tool
		},
		filesystem: {
			readMemory: async (path) => {
				if (path === 'at-a-glance.md') {
					return '| Open | 3 |\nSignal: 7.5\nReputation: 120\nTrial | 2 |';
				}
				return '';
			},
			writeMemory: async () => {},
			readAgentStatus: async (agentId) => ({
				agentId,
				content:
					agentId === 'scout'
						? '## Accessible Programs\n| Type | Handle |\n|---|---|\n| BBP | ruby |'
						: '',
				path: `/tmp/${agentId}`
			}),
			readState: async () => '{}',
			readResearch: async (path) => {
				if (path === 'viktor-benchmark/autoresearch-state.json') {
					return JSON.stringify(SAMPLE_VIKTOR_STATE);
				}
				return '{}';
			},
			...overrides.filesystem
		}
	});

	return { providers: base, getProgramsCalls: () => programsCalls };
}

describe('h1 parsers', () => {
	it('extractH1Json pulls JSON from mixed h1.sh stdout', () => {
		const raw = '📋 Saját reportok...\n{"data":{"balance":12.5}}\n💾 Mentve: /tmp/x.json';
		expect(extractH1Json(raw)).toEqual({ data: { balance: 12.5 } });
	});

	it('parseH1Balance formats balance amount', () => {
		expect(parseH1Balance({ data: { balance: 50 } })).toEqual({
			amount: 50,
			display: '$50.00'
		});
	});

	it('parseH1Programs maps API rows', () => {
		const programs = parseH1Programs(SAMPLE_PROGRAMS_JSON);
		expect(programs).toHaveLength(2);
		expect(programs[0]).toMatchObject({
			handle: 'ruby',
			offersBounties: true,
			submissionState: 'open'
		});
	});

	it('parseH1Reports maps API rows with program handle', () => {
		const reports = parseH1Reports(SAMPLE_REPORTS_JSON);
		expect(reports).toHaveLength(4);
		expect(reports[0]).toMatchObject({
			id: '1001',
			state: 'new',
			programHandle: 'acme'
		});
	});

	it('parseH1SignalFromReports reads reporter relationship', () => {
		expect(parseH1SignalFromReports(SAMPLE_REPORTS_JSON)).toEqual({
			signal: '7.5',
			reputation: '120',
			trial: '0'
		});
	});

	it('parseH1FromAtAGlance extracts dashboard metrics', () => {
		expect(parseH1FromAtAGlance('| Open | 3 |\nSignal: 7.5\nReputation: 120\nTrial | 2 |')).toEqual({
			open: '3',
			signal: '7.5',
			reputation: '120',
			trial: '2'
		});
	});

	it('getH1Stats aggregates report states', () => {
		const reports = parseH1Reports(SAMPLE_REPORTS_JSON);
		const stats = getH1Stats(reports, { signal: '7.5', reputation: '120', trial: '2' }, '3');
		expect(stats.totalReports).toBe(4);
		expect(stats.resolved).toBe(1);
		expect(stats.duplicates).toBe(1);
		expect(stats.pending).toBe(1);
		expect(stats.notApplicable).toBe(1);
		expect(stats.open).toBe('3');
	});

	it('getH1Signal prefers API reporter fields over at-a-glance', () => {
		const signal = getH1Signal(SAMPLE_REPORTS_JSON, 'Signal: 1.0\nReputation: 50');
		expect(signal.signal).toBe('7.5');
		expect(signal.reputation).toBe('120');
		expect(signal.trial).toBe('0');
	});

	it('parseH1ViktorStatus computes recall and transfer stats', () => {
		expect(parseH1ViktorStatus(SAMPLE_VIKTOR_STATE)).toEqual({
			totalCompleted: 42,
			recall: 83,
			h1Submitted: 3,
			h1Accepted: 1,
			activeLabel: 'crossplane',
			circuit: 'Normal'
		});
	});
});

describe('h1 providers', () => {
	beforeEach(() => {
		clearH1Cache();
	});

	it('getH1Balance parses balance via provider', async () => {
		const { providers } = createH1Mock();
		await expect(getH1Balance(providers)).resolves.toEqual({
			amount: 100.5,
			display: '$100.50'
		});
	});

	it('getH1Programs caches API results for one hour', async () => {
		const { providers, getProgramsCalls } = createH1Mock();
		await getH1Programs(providers);
		await getH1Programs(providers);
		expect(getProgramsCalls()).toBe(1);
	});

	it('getH1Reports returns parsed report list', async () => {
		const { providers } = createH1Mock();
		const reports = await getH1Reports(providers);
		expect(reports).toHaveLength(4);
	});

	it('getH1ViktorStatus reads autoresearch state', async () => {
		const { providers } = createH1Mock();
		const viktor = await getH1ViktorStatus(providers);
		expect(viktor.totalCompleted).toBe(42);
		expect(viktor.h1Submitted).toBe(3);
	});

	it('getH1Data aggregates balance, stats, programs, and viktor', async () => {
		const { providers } = createH1Mock();
		const data = await getH1Data(providers);
		expect(data.stats.open).toBe('3');
		expect(data.stats.signal).toBe('7.5');
		expect(data.stats.reputation).toBe('120');
		expect(data.stats.totalReports).toBe(4);
		expect(data.balance).toBe('$100.50');
		expect(data.balanceAmount).toBe(100.5);
		expect(data.programList).toHaveLength(2);
		expect(data.programs).toContain('accessible programs');
		expect(data.viktor.recall).toBe(83);
		expect(data.updatedAt).toBeGreaterThan(0);
	});

	it('getH1Data returns fallback stats when memory and API unavailable', async () => {
		const mock = createMockProviders({
			filesystem: {
				readMemory: async () => {
					throw new Error('no memory');
				},
				writeMemory: async () => {},
				readAgentStatus: async (id) => ({ agentId: id, content: '', path: '' }),
				readState: async () => '',
				readResearch: async () => {
					throw new Error('no viktor');
				}
			},
			tool: {
				h1Command: async () => {
					throw new Error('h1 down');
				},
				gogCommand: async () => '',
				execCommand: async () => ''
			}
		});
		const data = await getH1Data(mock);
		expect(data.stats.open).toBe('?');
		expect(data.balance).toBe('unknown');
		expect(data.programList).toEqual([]);
		expect(data.reports).toEqual([]);
	});
});
