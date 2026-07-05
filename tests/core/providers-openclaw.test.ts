import { describe, it, expect, vi } from 'vitest';
import { workspaceRoot, fileAgeDays } from '$lib/providers/openclaw';

describe('openclaw provider internals', () => {
	describe('workspaceRoot', () => {
		it('returns config.workspace when provided', () => {
			const root = workspaceRoot({ workspace: '/custom/workspace' });
			expect(root).toBe('/custom/workspace');
		});

		it('returns WORKSPACE env var when set', () => {
			vi.stubEnv('WORKSPACE', '/env/workspace');
			const root = workspaceRoot({});
			expect(root).toBe('/env/workspace');
			vi.unstubAllEnvs();
		});

		it('returns default ~/.openclaw/workspace when nothing set', () => {
			const root = workspaceRoot({});
			expect(root).toContain('.openclaw');
			expect(root).toContain('workspace');
		});

		it('returns config.workspace over WORKSPACE env', () => {
			vi.stubEnv('WORKSPACE', '/env/workspace');
			const root = workspaceRoot({ workspace: '/override' });
			expect(root).toBe('/override');
			vi.unstubAllEnvs();
		});
	});

	describe('fileAgeDays', () => {
		it('returns 999 for non-existent file', async () => {
			const age = await fileAgeDays('/tmp/nonexistent-file-xyz-12345');
			expect(age).toBe(999);
		});

		it('returns 0 for a just-created file', async () => {
			const { writeFile, unlink } = await import('node:fs/promises');
			const tmpPath = '/tmp/noema-test-age.txt';
			await writeFile(tmpPath, 'test');
			try {
				const age = await fileAgeDays(tmpPath);
				expect(age).toBeGreaterThanOrEqual(0);
			} finally {
				await unlink(tmpPath).catch(() => {});
			}
		});
	});
});
