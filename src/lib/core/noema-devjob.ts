// Browser-safe — NO Node.js imports. Used by DevJobIndicator.svelte client component.
import type { DevJobStatus } from "$lib/types";

export const DEFAULT_RELAY_URL = "/api";
export type DevJobIndicatorState = "idle" | "soon" | "active" | "offline";

export interface DevJobCountdown {
  text: string;
  soon: boolean;
  expired: boolean;
}

/** Fetch dev-loop status from relay `/next-trigger` + `/running`. */
export async function getDevJobStatus(
  relayUrl: string = DEFAULT_RELAY_URL,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<DevJobStatus> {
  try {
    const [ntRes, rRes] = await Promise.all([
      fetchFn(`${relayUrl}/next-trigger`),
      fetchFn(`${relayUrl}/running`),
    ]);

    if (!ntRes.ok || !rRes.ok) {
      throw new Error(`relay HTTP ${ntRes.status}/${rRes.status}`);
    }

    const nt = (await ntRes.json()) as { nextMs?: number; queue?: number };
    const r = (await rRes.json()) as { running?: string | null };

    return {
      nextMs: nt.nextMs ?? 0,
      queue: nt.queue ?? 0,
      running: r.running ?? null,
      updatedAt: Date.now(),
    };
  } catch {
    return {
      nextMs: 0,
      queue: 0,
      running: null,
      updatedAt: Date.now(),
      error: "offline",
    };
  }
}

/** MM:SS countdown label for the floating dev-job indicator. */
export function formatDevJobCountdown(
  nextMs: number,
  offline: boolean,
  now = Date.now(),
): DevJobCountdown {
  if (offline) {
    return { text: "offline", soon: false, expired: false };
  }
  if (nextMs <= 0) {
    return { text: "—", soon: false, expired: false };
  }

  const diff = nextMs - now;
  if (diff <= 0) {
    return { text: "most...", soon: true, expired: true };
  }

  const mins = Math.floor(diff / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  return {
    text: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    soon: diff < 60_000,
    expired: false,
  };
}

/** Border/animation state for DevJobIndicator.svelte. */
export function getDevJobIndicatorState(
  status: DevJobStatus,
  now = Date.now(),
): DevJobIndicatorState {
  if (status.error) return "offline";
  if (status.running) return "active";
  if (status.nextMs > 0 && status.nextMs - now < 60_000) return "soon";
  return "idle";
}
