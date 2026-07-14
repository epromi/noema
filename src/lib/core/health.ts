/** @file System health aggregation (CPU, memory, uptime, disk) for the Health tab. */

import { join } from "node:path";
import type { AllProviders } from "$lib/providers/types";
import { fileAgeDays, workspaceRoot } from "$lib/providers/openclaw";
import { getProvider } from "$lib/providers";
import type {
  GatewayStatus,
  HealthData,
  HeartbeatEntry,
  HookState,
} from "$lib/types";
import { getCpuData } from "./cpu.js";
import { safeParseJson } from "./utils.js";

/** Top-level heartbeat-state.json keys that are not per-agent records. */
const HEARTBEAT_META_KEYS = new Set(["lastChecks"]);

/** Derive a 0–100 health score from consecutive heartbeat errors. */
export function computeHeartbeatHealthScore(consecutiveErrors: number): number {
  if (consecutiveErrors <= 0) return 100;
  if (consecutiveErrors === 1) return 75;
  if (consecutiveErrors === 2) return 50;
  return 25;
}

function isAgentHeartbeatState(
  state: unknown,
): state is Record<string, unknown> {
  return typeof state === "object" && state !== null && !Array.isArray(state);
}

/** Parse heartbeat-state.json entries into dashboard rows. */
export function parseHeartbeatEntries(
  raw: Record<string, Record<string, unknown>>,
): HeartbeatEntry[] {
  return Object.entries(raw)
    .filter(
      ([agentId, state]) =>
        !HEARTBEAT_META_KEYS.has(agentId) && isAgentHeartbeatState(state),
    )
    .map(([agentId, state]) => {
      const consecutiveErrors = Number(state.consecutiveErrors ?? 0);
      return {
        agentId,
        consecutiveErrors,
        healthScore: computeHeartbeatHealthScore(consecutiveErrors),
        lastError:
          typeof state.lastError === "string" ? state.lastError : undefined,
        retriesToday: Number(state.retriesToday ?? 0),
        timeout: Number(state.timeout ?? 300),
      };
    });
}

/** Classify gateway exec output as online, offline, or unknown. */
export function classifyGatewayStatus(raw: string): GatewayStatus {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized === "unknown") return "unknown";
  if (normalized.includes("offline")) return "offline";
  return "online";
}

async function resolveModelMappingAge(
  providers: AllProviders,
): Promise<number> {
  try {
    const content = await providers.filesystem.readMemory(
      "agents-model-mapping.md",
    );
    if (!content.trim()) return 999;
    const modelPath = join(
      workspaceRoot(),
      "memory",
      "agents-model-mapping.md",
    );
    return await fileAgeDays(modelPath);
  } catch {
    return 999;
  }
}

export async function getHealth(providers?: AllProviders): Promise<HealthData> {
  const p = providers ?? getProvider();

  try {
    const [uptime, disk, ram, gatewayRaw, heartbeatRaw, hookStateRaw, cpu] =
      await Promise.all([
        p.tool
          .execCommand('uptime -p 2>/dev/null || echo "unknown"')
          .catch(() => "unknown"),
        p.tool
          .execCommand(
            'df -h / | awk \'NR==2{print $5" used ("$3"/"$2")"}\' 2>/dev/null || echo \'unknown\'',
          )
          .catch(() => "unknown"),
        p.tool
          .execCommand(
            "free -h | awk 'NR==2{printf \"%s used / %s total\", $3, $2}' 2>/dev/null || echo 'unknown'",
          )
          .catch(() => "unknown"),
        p.tool.gatewayHealth(),

        p.filesystem.readState("heartbeat-state.json").catch(() => "{}"),
        p.filesystem.readState("hook-state.json").catch(() => "{}"),
        getCpuData(p),
      ]);

    const hb = safeParseJson<Record<string, Record<string, unknown>>>(
      heartbeatRaw,
      {},
    );
    const hookState = safeParseJson<HookState>(hookStateRaw, {});
    const modelMappingAge = await resolveModelMappingAge(p);

    return {
      uptime: uptime.replace(/^up\s+/i, ""),
      disk,
      ram,
      gatewayStatus: classifyGatewayStatus(gatewayRaw),
      heartbeat: parseHeartbeatEntries(hb),
      hookState,
      modelMappingAge,
      cpu,
      updatedAt: Date.now(),
    };
  } catch (err) {
    return {
      uptime: "unknown",
      disk: "unknown",
      ram: "unknown",
      gatewayStatus: "unknown",
      heartbeat: [],
      hookState: {},
      modelMappingAge: 999,
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}
