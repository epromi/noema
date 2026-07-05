import { describe, it, expect } from 'vitest';
import {
	buildCronByGroup,
	classifyCronGroup,
	formatSchedule,
	safeParseJson,
	staleLevel
} from '$lib/core/utils';
import type { CronEntry } from '$lib/types';

describe('utils', () => {
	it('formatSchedule handles everyMs schedules', () => {
		expect(formatSchedule({ kind: 'every', everyMs: 7_200_000 })).toBe('every 2h');
	});

	it('safeParseJson returns fallback on invalid JSON', () => {
		expect(safeParseJson('not-json', { ok: true })).toEqual({ ok: true });
	});

	it('staleLevel thresholds', () => {
		expect(staleLevel(3)).toBe(0);
		expect(staleLevel(10)).toBe(3);
		expect(staleLevel(20)).toBe(7);
	});

	it('classifyCronGroup covers all groups', () => {
		expect(classifyCronGroup('18:00 daily')).toBe('EVENING');
	});

	it('buildCronByGroup aggregates healthy counts', () => {
		const crons: CronEntry[] = [
			{
				id: '1',
				name: 'A',
				agentId: 'alfred',
				schedule: '02:00',
				group: 'NIGHT',
				lastResult: 'ok',
				enabled: true,
				consecutiveErrors: 0
			},
			{
				id: '2',
				name: 'B',
				agentId: 'otto',
				schedule: '03:00',
				group: 'NIGHT',
				lastResult: 'error',
				enabled: true,
				consecutiveErrors: 1
			}
		];
		expect(buildCronByGroup(crons).NIGHT).toEqual({ total: 2, healthy: 1 });
	});
});
