import type { DashboardData } from "$lib/types";

/** Return null if cache is older than this (ms). 2.5× collector cycle. */
const CACHE_MAX_AGE_MS = 150_000; // 2.5 min

let cache: DashboardData | null = null;
let cacheAt = 0;

export function setCache(data: DashboardData): void {
  cache = data;
  cacheAt = Date.now();
}

export function getCache(): DashboardData | null {
  if (cache && Date.now() - cacheAt > CACHE_MAX_AGE_MS) {
    console.warn("[cache] returning null — cache expired (> 2.5 min)");
    return null;
  }
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
