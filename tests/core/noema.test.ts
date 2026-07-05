import { describe, it, expect, vi } from 'vitest';
import { getNoema, getActionQueue, getBrainstorm } from '$lib/core/noema';
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

	it('getActionQueue parses kanban columns with multi-actions', async () => {
		const data = await getActionQueue(createMockProviders());
		expect(data.alfred.length).toBe(1);
		expect(data.alfred[0]?.id).toBe('test_item');
		expect(data.alfred[0]?.actions).toEqual(['done', 'escalate']);
		expect(data.andras.length).toBe(1);
		expect(data.andras[0]?.actions).toContain('done');
		expect(data.auto.length).toBe(1);
		expect(data.auto[0]?.actions).toEqual([]);
	});

	it('getBrainstorm parses action-tracker sections and pending count', async () => {
		const data = await getBrainstorm(createMockProviders());
		expect(data.pending).toBe(3);
		expect(data.sections.length).toBe(5);
		expect(data.updatedAt).toBeGreaterThan(0);

		const autoexec = data.sections.find((s) => s.key === 'autoexec');
		expect(autoexec?.items.length).toBe(2);
		expect(autoexec?.items[0]?.done).toBe(true);
		expect(autoexec?.items[0]?.status).toBe('done');
		expect(autoexec?.items[1]?.status).toBe('pending');

		const autonotify = data.sections.find((s) => s.key === 'autonotify');
		expect(autonotify?.items[0]?.status).toBe('waiting');

		const backlog = data.sections.find((s) => s.key === 'backlog');
		expect(backlog?.items[0]?.id).toBe('BL-01');
		expect(backlog?.items[0]?.name).toContain('Backlog');
	});

	it('getBrainstorm handles provider errors', async () => {
		const mock = createMockProviders({
			filesystem: {
				readMemory: async (path) => {
					if (path === 'brainstorming/action-tracker.md') {
						throw new Error('tracker missing');
					}
					return '';
				},
				writeMemory: async () => {},
				readAgentStatus: async (id) => ({ agentId: id, content: '', path: '' }),
				readState: async () => '',
				readResearch: async () => ''
			}
		});
		const data = await getBrainstorm(mock);
		expect(data.error).toContain('tracker missing');
		expect(data.pending).toBe(0);
		expect(data.sections.length).toBe(5);
	});
});
