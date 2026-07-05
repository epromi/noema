import { getAllData } from "$lib/core";
import { getProvider } from "$lib/providers";
import type { DashboardData } from "$lib/types";
import { setCache } from "$lib/server/cache";
import { broadcast } from "$lib/server/sse";

export const COLLECT_INTERVAL_MS = 60_000;

let collectorTimer: ReturnType<typeof setInterval> | null = null;
let collectPromise: Promise<DashboardData> | null = null;

/** Run one collector cycle: fetch, cache, broadcast. */
export async function collectOnce(): Promise<DashboardData> {
  if (collectPromise) return collectPromise;

  collectPromise = (async () => {
    const providers = getProvider();
    const data = await getAllData(providers);
    setCache(data);
    broadcast(data);
    return data;
  })();

  try {
    return await collectPromise;
  } finally {
    collectPromise = null;
  }
}

/** Start periodic background collection (idempotent). */
export function startCollector(): void {
  if (collectorTimer) return;

  void collectOnce();

  collectorTimer = setInterval(() => {
    void collectOnce();
  }, COLLECT_INTERVAL_MS);
}

/** Stop background collection (for tests). */
export function stopCollector(): void {
  if (collectorTimer) {
    clearInterval(collectorTimer);
    collectorTimer = null;
  }
}
