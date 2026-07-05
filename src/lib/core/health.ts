import type { AllProviders } from '$lib/providers/types';
import { getProvider } from '$lib/providers';
import type { HealthData, HeartbeatEntry } from '$lib/types';
import { safeParseJson } from './utils.js';

export async function getHealth(providers?: AllProviders): Promise<HealthData> {
	const p = providers ?? getProvider();

	try {
		const [uptime, disk, ram, gatewayRaw, heartbeatRaw, modelMapping] = await Promise.all([
			p.tool.execCommand('uptime -p 2>/dev/null || echo "unknown"').catch(() => 'unknown'),
			p.tool
				.execCommand("df -h / | awk 'NR==2{print $5\" used (\"$3\"/\"$2\")\"}' 2>/dev/null || echo 'unknown'")
				.catch(() => 'unknown'),
			p.tool
				.execCommand("free -h | awk 'NR==2{printf \"%s used / %s total\", $3, $2}' 2>/dev/null || echo 'unknown'")
				.catch(() => 'unknown'),
			p.tool.execCommand('openclaw gateway status 2>/dev/null || echo offline').catch(() => 'offline'),
			p.filesystem.readState('heartbeat-state.json').catch(() => '{}'),
			p.filesystem.readMemory('agents-model-mapping.md').catch(() => '')
		]);

		const hb = safeParseJson<Record<string, Record<string, unknown>>>(heartbeatRaw, {});
		const heartbeat: HeartbeatEntry[] = Object.entries(hb).map(([agentId, state]) => ({
			agentId,
			consecutiveErrors: Number(state.consecutiveErrors ?? 0),
			lastError: typeof state.lastError === 'string' ? state.lastError : undefined,
			retriesToday: Number(state.retriesToday ?? 0),
			timeout: Number(state.timeout ?? 300)
		}));

		const modelMappingAge = modelMapping ? 0 : 999;

		return {
			uptime: uptime.replace(/^up\s+/i, ''),
			disk,
			ram,
			gatewayStatus: gatewayRaw.includes('offline') ? 'offline' : 'online',
			heartbeat,
			modelMappingAge,
			updatedAt: Date.now()
		};
	} catch (err) {
		return {
			uptime: 'unknown',
			disk: 'unknown',
			ram: 'unknown',
			gatewayStatus: 'unknown',
			heartbeat: [],
			modelMappingAge: 999,
			updatedAt: Date.now(),
			error: String(err)
		};
	}
}
