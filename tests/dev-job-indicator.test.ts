import { describe, it, expect, vi } from 'vitest';
import {
	getDevJobStatus,
	formatDevJobCountdown,
	getDevJobIndicatorState
} from '$lib/core/noema';
import type { DevJobStatus } from '$lib/types';

function mockFetch(responses: Record<string, unknown>) {
	return vi.fn(async (url: string | URL | Request) => {
		const path = String(url).split('/').pop() ?? '';
		const body = responses[path];
		if (body === undefined) {
			throw new Error(`unexpected fetch: ${String(url)}`);
		}
		return {
			ok: true,
			status: 200,
			json: async () => body
		} as Response;
	});
}

describe('dev-job-indicator', () => {
	it('getDevJobStatus merges next-trigger and running responses', async () => {
		const fetchFn = mockFetch({
			'next-trigger': { nextMs: 154_000, queue: 2, now: Date.now() },
			running: { running: 'PKG-022-cron-sidebar' }
		});

		const status = await getDevJobStatus('http://127.0.0.1:18998', fetchFn);

		expect(status.nextMs).toBe(154_000);
		expect(status.queue).toBe(2);
		expect(status.running).toBe('PKG-022-cron-sidebar');
		expect(status.error).toBeUndefined();
		expect(status.updatedAt).toBeGreaterThan(0);
	});

	it('getDevJobStatus returns offline fallback when relay fails', async () => {
		const fetchFn = vi.fn(async () => {
			throw new Error('ECONNREFUSED');
		});

		const status = await getDevJobStatus('http://127.0.0.1:18998', fetchFn);

		expect(status).toEqual({
			nextMs: 0,
			queue: 0,
			running: null,
			updatedAt: expect.any(Number),
			error: 'offline'
		});
	});

	it('formatDevJobCountdown renders MM:SS countdown', () => {
		const now = 1_000_000;
		const result = formatDevJobCountdown(now + 154_000, false, now);

		expect(result.text).toBe('02:34');
		expect(result.soon).toBe(false);
		expect(result.expired).toBe(false);
	});

	it('formatDevJobCountdown marks soon state under one minute', () => {
		const now = 1_000_000;
		const result = formatDevJobCountdown(now + 45_000, false, now);

		expect(result.text).toBe('00:45');
		expect(result.soon).toBe(true);
	});

	it('formatDevJobCountdown shows offline label in red state path', () => {
		const result = formatDevJobCountdown(0, true);

		expect(result.text).toBe('offline');
		expect(result.soon).toBe(false);
	});

	it('getDevJobIndicatorState is active when a package is running', () => {
		const status: DevJobStatus = {
			nextMs: Date.now() + 120_000,
			queue: 1,
			running: 'PKG-026-dev-job-indicator',
			updatedAt: Date.now()
		};

		expect(getDevJobIndicatorState(status)).toBe('active');
	});

	it('getDevJobIndicatorState is soon when next run is under one minute', () => {
		const now = Date.now();
		const status: DevJobStatus = {
			nextMs: now + 30_000,
			queue: 0,
			running: null,
			updatedAt: now
		};

		expect(getDevJobIndicatorState(status, now)).toBe('soon');
	});

	it('getDevJobIndicatorState is offline when relay error is set', () => {
		const status: DevJobStatus = {
			nextMs: 0,
			queue: 0,
			running: null,
			updatedAt: Date.now(),
			error: 'offline'
		};

		expect(getDevJobIndicatorState(status)).toBe('offline');
	});
});
