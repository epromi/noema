import { describe, it, expect, vi } from 'vitest';
import { getNoema } from '$lib/core/noema';
import { createMockProviders } from './mock-providers';

vi.mock('node:fs/promises', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs/promises')>();
	return {
		...actual,
		readFile: vi.fn(async (path: string) => {
			if (String(path).endsWith('CHANGELOG.md')) return '## 2026-07-05\n- Test change';
			if (String(path).endsWith('INDEX.md')) {
				return '| PKG-001 | Scaffold | F1 | | S | 1h | — |\n| PKG-013 | Provider | F1 | | M | 2h | PKG-001 |';
			}
			if (String(path).endsWith('generate.cjs')) return 'line1\nline2\nline3';
			if (String(path).endsWith('relay.js')) return 'line1\n';
			if (String(path).endsWith('action-processor.cjs')) return 'line1\nline2';
			return '';
		})
	};
});

describe('noema', () => {
	it('getNoema returns product metrics via provider', async () => {
		const data = await getNoema(createMockProviders());
		expect(data.metrics.totalLoc).toBeGreaterThan(0);
		expect(data.metrics.cronsTotal).toBe(3);
		expect(data.metrics.activeProposals).toBe(2);
		expect(data.architecture).toContain('lib/providers');
		expect(data.updatedAt).toBeGreaterThan(0);
	});
});
