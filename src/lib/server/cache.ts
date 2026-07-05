import type { DashboardData } from "$lib/types";

let cache: DashboardData | null = null;
let cacheAt = 0;

export function setCache(data: DashboardData): void {
  cache = data;
  cacheAt = Date.now();
}

export function getCache(): DashboardData | null {
  return cache;
}

export function getCacheUpdatedAt(): number {
  return cacheAt;
}

/** Reset cache (for tests). */
export function clearCache(): void {
  cache = null;
  cacheAt = 0;
}
