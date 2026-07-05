import { describe, it, expect } from 'vitest';
import { getAgents, getAgentDetail } from '$lib/core/agents';
import { createMockProviders } from './mock-providers';

describe('agents', () => {
	it('getAgents returns agent cards via provider', async () => {
		const data = await getAgents(createMockProviders());
		expect(data.total).toBe(8);
		expect(data.agents[0]?.id).toBe('otto');
		expect(data.agents.find((a) => a.id === 'alfred')?.activeSessions).toBe(1);
		expect(data.updatedAt).toBeGreaterThan(0);
	});

	it('getAgentDetail returns single agent', async () => {
		const mock = createMockProviders();
		const agent = await getAgentDetail('viktor', mock);
		expect(agent?.name).toBe('Viktor');
		expect(agent?.emoji).toBe('🛡️');
	});

	it('getAgents handles provider errors', async () => {
		const mock = createMockProviders({
			session: {
				listSessions: async () => {
					throw new Error('sessions down');
				},
				getHistory: async () => [],
				spawnAgent: async (id) => ({ sessionKey: '', agentId: id, status: 'error' })
			}
		});
		const data = await getAgents(mock);
		expect(data.error).toContain('sessions down');
		expect(data.agents).toEqual([]);
	});
});
