import { describe, it, expect, vi } from 'vitest';
import {
	getHealth,
	parseHeartbeatEntries,
	classifyGatewayStatus
} from '$lib/core/health';
import { createMockProviders } from './mock-providers';

describe('health', () => {
	it('parseHeartbeatEntries maps agent heartbeat fields', () => {
		const entries = parseHeartbeatEntries({
			edwin: {
				consecutiveErrors: 2,
				lastError: 'timeout',
				retriesToday: 1,
				timeout: 120
			},
			otto: {}
		});
		expect(entries).toEqual([
			{
				agentId: 'edwin',
				consecutiveErrors: 2,
				lastError: 'timeout',
				retriesToday: 1,
				timeout: 120
			},
			{
				agentId: 'otto',
				consecutiveErrors: 0,
				lastError: undefined,
				retriesToday: 0,
				timeout: 300
			}
		]);
	});

	it('classifyGatewayStatus detects offline output', () => {
		expect(classifyGatewayStatus('offline')).toBe('offline');
		expect(classifyGatewayStatus('Gateway running on :8080')).toBe('online');
	});

	it('getHealth returns system metrics via provider', async () => {
		const data = await getHealth(createMockProviders());
		expect(data.uptime).toContain('2 days');
		expect(data.disk).toContain('used');
		expect(data.ram).toContain('total');
		expect(data.gatewayStatus).toBe('online');
		expect(data.heartbeat.length).toBeGreaterThan(0);
		expect(data.hookState.rulesCheck?.enabled).toBe(true);
		expect(data.modelMappingAge).toBeGreaterThanOrEqual(0);
		expect(data.updatedAt).toBeGreaterThan(0);
	});

	it('getHealth returns degraded data when exec fails', async () => {
		const mock = createMockProviders({
			tool: {
				h1Command: async () => '',
				gogCommand: async () => '',
				execCommand: async () => {
					throw new Error('exec failed');
				}
			}
		});
		const data = await getHealth(mock);
		expect(data.uptime).toBe('unknown');
		expect(data.gatewayStatus).toBe('offline');
	});

	it('getHealth returns error payload when provider construction fails', async () => {
		const broken = createMockProviders();
		const spy = vi.spyOn(Promise, 'all').mockImplementationOnce(async () => {
			throw new Error('forced failure');
		});
		const data = await getHealth(broken);
		spy.mockRestore();
		expect(data.error).toContain('forced failure');
		expect(data.heartbeat).toEqual([]);
		expect(data.hookState).toEqual({});
	});
});
