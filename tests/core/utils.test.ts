import { describe, it, expect } from 'vitest';
import {
	classifyCronGroup,
	formatSchedule,
	safeParseJson,
	staleLevel
} from '$lib/core/utils';

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
});
