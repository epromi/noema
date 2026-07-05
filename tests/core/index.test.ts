import { describe, it, expect, vi, afterAll } from 'vitest';
import { getAllData } from '$lib/core/index';
import { createMockProviders } from './mock-providers';

// getAllData delegates to getNoema which uses readFile from node:fs/promises
// directly (not through the provider). We need to mock the filesystem paths.
vi.mock('node:fs/promises', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs/promises')>();
	return {
		...actual,
		readFile: vi.fn(async (path: string) => {
			const s = String(path);
			if (s.endsWith('CHANGELOG.md')) return '## 2026-07-05\n- Test change';
			if (s.endsWith('INDEX.md')) {
				return '| PKG-001 | Scaffold | F1 | | S | 1h | — |\n| PKG-013 | Provider | F1 | | M | 2h | PKG-001 |';
			}
			if (s.endsWith('generate.cjs')) return 'line1\nline2\nline3';
			if (s.endsWith('relay.js')) return 'line1\n';
			if (s.endsWith('action-processor.cjs')) return 'line1\nline2';
			return '';
		})
	};
});

afterAll(() => {
	vi.restoreAllMocks();
});

describe('index (getAllData)', () => {
	it('getAllData resolves all dashboard sections via provider', async () => {
		const data = await getAllData(createMockProviders());
		expect(data.meta.loadedAt).toBeGreaterThan(0);
		expect(data.crons).toBeDefined();
		expect(data.agents).toBeDefined();
		expect(data.health).toBeDefined();
		expect(data.h1).toBeDefined();
		expect(data.calendar).toBeDefined();
		expect(data.bills).toBeDefined();
		expect(data.research).toBeDefined();
		expect(data.noema).toBeDefined();
		expect(data.actionQueue).toBeDefined();
	}, 15000);

	it('named exports are callable', async () => {
		const { getAgents, getBills, getCalendar, getCrons, getH1Data, getHealth, getNoema, getResearch } = await import('$lib/core/index');
		expect(typeof getAgents).toBe('function');
		expect(typeof getBills).toBe('function');
		expect(typeof getCalendar).toBe('function');
		expect(typeof getCrons).toBe('function');
		expect(typeof getH1Data).toBe('function');
		expect(typeof getHealth).toBe('function');
		expect(typeof getNoema).toBe('function');
		expect(typeof getResearch).toBe('function');
	});
});
