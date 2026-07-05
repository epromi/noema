import { describe, it, expect } from 'vitest';
import { getProvider, createProvider, resetProvider } from '$lib/providers';
import { createMockProviders } from './mock-providers';

describe('providers', () => {
	it('getProvider returns openclaw by default', () => {
		resetProvider();
		const p = getProvider();
		expect(p.cron).toBeDefined();
		expect(p.session).toBeDefined();
		expect(p.filesystem).toBeDefined();
		expect(p.tool).toBeDefined();
	});

	it('createProvider creates fresh instance', () => {
		const a = createProvider('openclaw');
		const b = createProvider('openclaw');
		expect(a).not.toBe(b);
	});

	it('mock provider satisfies AllProviders interface', () => {
		const mock = createMockProviders();
		expect(mock.cron.listCrons).toBeTypeOf('function');
		expect(mock.filesystem.readMemory).toBeTypeOf('function');
	});
});
