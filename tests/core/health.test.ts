import { describe, it, expect } from 'vitest';
import { getHealth } from '$lib/core/health';
import { createMockProviders } from './mock-providers';

describe('health', () => {
	it('getHealth returns system metrics via provider', async () => {
		const data = await getHealth(createMockProviders());
		expect(data.uptime).toContain('2 days');
		expect(data.disk).toContain('used');
		expect(data.ram).toContain('total');
		expect(data.gatewayStatus).toBe('online');
		expect(data.heartbeat.length).toBeGreaterThan(0);
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
});
