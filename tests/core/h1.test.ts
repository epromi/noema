import { describe, it, expect } from 'vitest';
import { getH1Data } from '$lib/core/h1';
import { createMockProviders } from './mock-providers';

describe('h1', () => {
	it('getH1Data parses at-a-glance via filesystem provider', async () => {
		const data = await getH1Data(createMockProviders());
		expect(data.stats.open).toBe('3');
		expect(data.stats.signal).toBe('7.5');
		expect(data.stats.reputation).toBe('120');
		expect(data.stats.trial).toBe('2');
		expect(data.balance).toContain('balance');
		expect(data.updatedAt).toBeGreaterThan(0);
	});

	it('getH1Data returns fallback stats when memory unavailable', async () => {
		const mock = createMockProviders({
			filesystem: {
				readMemory: async () => {
					throw new Error('no memory');
				},
				writeMemory: async () => {},
				readAgentStatus: async (id) => ({ agentId: id, content: '', path: '' }),
				readState: async () => '',
				readResearch: async () => ''
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
	});
});
