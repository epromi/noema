import { describe, it, expect, vi } from 'vitest';
import { countFiles, classifyCronGroup, formatSchedule, staleLevel } from '$lib/core/utils';

describe('utils edge cases', () => {
	describe('countFiles', () => {
		it('counts files in directory (non-recursive)', async () => {
			const readDir = vi.fn(async (dir: string) => {
				if (dir === '/test') {
					return [
						{ name: 'file1.md', isDirectory: false, mtimeMs: Date.now() },
						{ name: 'file2.ts', isDirectory: false, mtimeMs: Date.now() - 10 * 86_400_000 }, // 10 days old
					];
				}
				return [];
			});

			const { total, recent } = await countFiles(readDir, '/test');
			expect(total).toBe(2);
			expect(recent).toBe(1); // only file1 is recent (<7 days)
		});

		it('handles directories recursively', async () => {
			const readDir = vi.fn(async (dir: string) => {
				if (dir === '/test') {
					return [
						{ name: 'subdir', isDirectory: true },
						{ name: 'top.md', isDirectory: false, mtimeMs: Date.now() },
					];
				}
				if (dir === '/test/subdir') {
					return [
						{ name: 'deep.ts', isDirectory: false, mtimeMs: Date.now() },
					];
				}
				return [];
			});

			const { total, recent } = await countFiles(readDir, '/test');
			expect(total).toBe(2);
			expect(recent).toBe(2);
		});

		it('skips dotfiles and respects maxDepth', async () => {
			const readDir = vi.fn(async (dir: string) => {
				if (dir === '/test') {
					return [
						{ name: '.hidden', isDirectory: false, mtimeMs: Date.now() },
						{ name: 'real.md', isDirectory: false, mtimeMs: Date.now() },
					];
				}
				return [];
			});

			const { total } = await countFiles(readDir, '/test', 1);
			expect(total).toBe(1); // .hidden skipped
		});

		it('handles readDir errors gracefully', async () => {
			const readDir = vi.fn(async () => {
				throw new Error('EACCES');
			});

			const { total, recent } = await countFiles(readDir, '/test');
			expect(total).toBe(0);
			expect(recent).toBe(0);
		});
	});

	describe('classifyCronGroup', () => {
		it('classifies hourly schedules as SPANNING', () => {
			expect(classifyCronGroup('every hour')).toBe('SPANNING');
			expect(classifyCronGroup({ kind: 'every', everyMs: 3600000 })).toBe('SPANNING');
		});

		it('classifies night hours', () => {
			expect(classifyCronGroup('at 02:30')).toBe('NIGHT');
			expect(classifyCronGroup('03:00 daily')).toBe('NIGHT');
		});

		it('classifies morning hours', () => {
			expect(classifyCronGroup('at 07:15')).toBe('MORNING');
			expect(classifyCronGroup('08:30')).toBe('MORNING');
		});

		it('classifies daytime hours', () => {
			expect(classifyCronGroup('at 12:00')).toBe('DAYTIME');
			expect(classifyCronGroup('16:45')).toBe('DAYTIME');
		});

		it('classifies evening hours', () => {
			expect(classifyCronGroup('at 20:00')).toBe('EVENING');
			expect(classifyCronGroup('23:30')).toBe('EVENING');
		});
	});

	describe('formatSchedule', () => {
		it('formats plain string schedules', () => {
			expect(formatSchedule('02:30 daily')).toBe('02:30 daily');
		});

		it('formats every-ms schedules as hours', () => {
			expect(formatSchedule({ kind: 'every', everyMs: 7200000 })).toBe('every 2h');
			expect(formatSchedule({ kind: 'every', everyMs: 900000 })).toBe('every 15m');
		expect(formatSchedule({ kind: 'every', everyMs: 60000 })).toBe('every 1m');
		});

		it('formats expr and at schedules', () => {
			expect(formatSchedule({ expr: '*/5 * * * *' })).toBe('*/5 * * * *');
			expect(formatSchedule({ at: '08:00' })).toBe('08:00');
		});

		it('falls back to "unknown"', () => {
			expect(formatSchedule(null)).toBe('unknown');
			expect(formatSchedule(undefined)).toBe('unknown');
			expect(formatSchedule({})).toBe('unknown');
		});
	});

	describe('staleLevel', () => {
		it('returns 7 for >=14 days', () => {
			expect(staleLevel(14)).toBe(7);
			expect(staleLevel(30)).toBe(7);
		});

		it('returns 3 for >=7 days', () => {
			expect(staleLevel(7)).toBe(3);
			expect(staleLevel(10)).toBe(3);
		});

		it('returns 0 for <7 days', () => {
			expect(staleLevel(0)).toBe(0);
			expect(staleLevel(3)).toBe(0);
			expect(staleLevel(6)).toBe(0);
		});
	});
});
