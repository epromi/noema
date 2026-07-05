import { createOpenClawProviders } from './openclaw.js';
import { provider as openclawProvider } from './openclaw-singleton.js';
import type { AllProviders } from './types.js';

export type * from './types.js';
export { createOpenClawProviders, workspaceRoot } from './openclaw.js';
export { provider as openclawSingleton } from './openclaw-singleton.js';

let cached: AllProviders | null = null;

/** Factory: returns provider based on NOEMA_PROVIDER env (default: openclaw). */
export function getProvider(): AllProviders {
	if (cached) return cached;

	const name = process.env.NOEMA_PROVIDER ?? 'openclaw';

	switch (name) {
		case 'openclaw':
			cached = openclawProvider;
			return cached;
		default:
			throw new Error(`Unknown NOEMA_PROVIDER: ${name}. Supported: openclaw`);
	}
}

/** Reset cached provider (for tests). */
export function resetProvider(): void {
	cached = null;
}

/** Create a fresh provider instance (bypasses cache). */
export function createProvider(name = process.env.NOEMA_PROVIDER ?? 'openclaw'): AllProviders {
	switch (name) {
		case 'openclaw':
			return createOpenClawProviders();
		default:
			throw new Error(`Unknown NOEMA_PROVIDER: ${name}. Supported: openclaw`);
	}
}
