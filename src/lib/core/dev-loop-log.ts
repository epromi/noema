import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AllProviders } from '$lib/providers/types';
import { getProvider } from '$lib/providers';
import { workspaceRoot } from '$lib/providers/openclaw';
import type {
	DevLoopLogData,
	DevLoopRunningData,
	DevPackageEntry,
	DevPackagesData
} from '$lib/types';

const TAIL_BYTES = 8000;
const PLACEHOLDER =
	'⏳ Cursor agent dolgozik...\n(a log akkor jelenik meg amikor elkezd írni)';

/**
 * Tail the latest Cursor dev-loop log for a package (last 8KB).
 */
export async function getDevLoopLog(
	pkgId: string,
	_providers?: AllProviders
): Promise<DevLoopLogData> {
	try {
		const logDir = join(workspaceRoot(), 'projects', 'noema', 'logs');
		const logPath = await findLogFile(logDir, pkgId);

		if (!logPath) {
			return { pkgId, content: PLACEHOLDER, updatedAt: Date.now() };
		}

		const raw = await readFile(logPath, 'utf8');
		const content = raw.length > TAIL_BYTES ? raw.slice(-TAIL_BYTES) : raw;
		return { pkgId, content, updatedAt: Date.now() };
	} catch (err) {
		return { pkgId, content: PLACEHOLDER, updatedAt: Date.now(), error: String(err) };
	}
}

/**
 * Detect currently running dev-loop package via process list.
 */
export async function getRunningDevLoop(providers?: AllProviders): Promise<DevLoopRunningData> {
	const p = providers ?? getProvider();

	try {
		const ps = await p.tool.execCommand(
			'ps aux | grep -E "dev-loop\\.sh|action-processor" | grep -v grep'
		);
		const match = ps.match(/dev-loop\.sh\s+(PKG-\d+(?:-\S+)?)/);
		return { running: match?.[1] ?? null, updatedAt: Date.now() };
	} catch (err) {
		return { running: null, updatedAt: Date.now(), error: String(err) };
	}
}

/**
 * Parse dev/packages/INDEX.md into package rows for the Noema tab.
 */
export async function getDevPackages(_providers?: AllProviders): Promise<DevPackagesData> {
	try {
		const indexPath = join(workspaceRoot(), 'projects', 'noema', 'dev', 'packages', 'INDEX.md');
		const indexMd = await readFile(indexPath, 'utf8');
		const packages = parsePackageIndex(indexMd);
		return { packages, updatedAt: Date.now() };
	} catch (err) {
		return { packages: [], updatedAt: Date.now(), error: String(err) };
	}
}

export function parsePackageIndex(indexMd: string): DevPackageEntry[] {
	const packages: DevPackageEntry[] = [];

	for (const line of indexMd.split('\n')) {
		const match = line.match(/^\|\s*(PKG-\d{3})\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
		if (!match) continue;

		const id = match[1] ?? '';
		const name = (match[2] ?? '').trim();
		const phase = (match[3] ?? '').trim();
		const done = phase.includes('✅');

		packages.push({ id, name, phase, done });
	}

	return packages;
}

async function findLogFile(logDir: string, pkgId: string): Promise<string | null> {
	try {
		const files = await readdir(logDir);
		const match = files
			.filter((f) => f.startsWith(`cursor-${pkgId}`))
			.sort()
			.reverse()[0];
		return match ? join(logDir, match) : null;
	} catch {
		return null;
	}
}
