import type { AllProviders, CronJob, Session } from '$lib/providers/types';

export function createMockProviders(overrides: Partial<AllProviders> = {}): AllProviders {
	const defaultCronJobs: CronJob[] = [
		{
			id: 'abc-123',
			name: 'Test Cron',
			agentId: 'alfred',
			enabled: true,
			schedule: { kind: 'every', everyMs: 3_600_000 },
			status: 'ok',
			state: { lastRunStatus: 'ok', consecutiveErrors: 0 }
		},
		{
			id: 'def-456',
			name: 'Failed Cron',
			agentId: 'otto',
			enabled: true,
			schedule: '02:30 daily',
			status: 'error',
			state: { lastRunStatus: 'error', consecutiveErrors: 2 }
		}
	];

	const defaultSessions: Session[] = [
		{ key: 'agent:alfred:main', agentId: 'alfred', updatedAt: Date.now() }
	];

	const base: AllProviders = {
		cron: {
			listCrons: async () => defaultCronJobs,
			runCron: async () => {},
			getCronStatus: async () => ({ enabled: true, jobsTotal: 2, jobsEnabled: 2 }),
			getCronRuns: async () => []
		},
		session: {
			listSessions: async () => defaultSessions,
			getHistory: async () => [],
			spawnAgent: async (agentId) => ({
				sessionKey: `agent:${agentId}:spawn`,
				agentId,
				status: 'spawned'
			})
		},
		agent: {
			listSubagents: async () => [],
			steerSubagent: async () => {},
			killSubagent: async () => {}
		},
		messaging: {
			sendMessage: async () => {},
			sessionsSend: async () => {}
		},
		filesystem: {
			readMemory: async (path) => {
				if (path === 'at-a-glance.md') {
					return '| Open | 3 |\nSignal: 7.5\nReputation: 120\nTrial | 2 |';
				}
				if (path === 'logistics/tasks.md') {
					return `## 🔓 Open Loops\n| ID | Desc | Owner | Last | Status |\n|---|---|---|---|---|\n| OL-001 | Test loop | Alfred | 2026-07-01 | 🟢 Active |\n\n- [ ] 💰 Számla 5000 Ft maradék`;
				}
				if (path === 'agents-model-mapping.md') return '# models';
				return '';
			},
			writeMemory: async () => {},
			readAgentStatus: async (agentId) => ({
				agentId,
				content: `# ${agentId} status\nLast run: 2026-07-05`,
				path: `/tmp/agents/${agentId}/status.md`
			}),
			readState: async (path) => {
				if (path === 'heartbeat-state.json') {
					return JSON.stringify({ edwin: { consecutiveErrors: 0 } });
				}
				if (path === 'hook-state.json') {
					return JSON.stringify({ rulesCheck: { enabled: true } });
				}
				return '{}';
			},
			readResearch: async () =>
				'### 📋 PROPOSE\n| 1 | Test finding | med | 🟡 |\n| 2 | Another | low | 🟢 |'
		},
		tool: {
			h1Command: async (cmd) => {
				if (cmd === 'balance') return JSON.stringify({ data: { balance: 100 } });
				if (cmd === 'my-reports') {
					return JSON.stringify({
						data: [
							{
								id: '1',
								attributes: { title: 't', state: 'new', created_at: '2026-07-01' },
								relationships: {
									reporter: { data: { attributes: { signal: 7.5, reputation: 120 } } }
								}
							}
						]
					});
				}
				if (cmd === 'programs') return JSON.stringify({ data: [] });
				return '';
			},
			gogCommand: async () => JSON.stringify([{ title: 'Meeting', start: '2026-07-06T10:00:00', end: '2026-07-06T11:00:00' }]),
			execCommand: async (cmd) => {
				if (cmd.includes('uptime')) return 'up 2 days';
				if (cmd.includes('df')) return '45% used (20G/50G)';
				if (cmd.includes('free')) return '8G used / 16G total';
				return 'ok';
			}
		}
	};

	return {
		cron: { ...base.cron, ...overrides.cron },
		session: { ...base.session, ...overrides.session },
		agent: { ...base.agent, ...overrides.agent },
		messaging: { ...base.messaging, ...overrides.messaging },
		filesystem: { ...base.filesystem, ...overrides.filesystem },
		tool: { ...base.tool, ...overrides.tool }
	};
}
