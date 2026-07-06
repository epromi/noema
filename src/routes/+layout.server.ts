import { getCrons } from "$lib/core/crons";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { LayoutServerLoad } from "./$types";

// ⚡ Oszd meg a cache-t a +page.server.ts-sel
const CACHE_FILE = resolve(process.cwd(), "data", "dashboard-cache.json");
const CACHE_TTL_MS = 5 * 60 * 1000;

export const load: LayoutServerLoad = async () => {
  // 🔥 Try page cache first (cron data included)
  try {
    if (existsSync(CACHE_FILE)) {
      const raw = readFileSync(CACHE_FILE, "utf-8");
      const cached = JSON.parse(raw);
      if (cached._ts && Date.now() - cached._ts < CACHE_TTL_MS) {
        return { crons: cached._data.crons };
      }
    }
  } catch {
    /* fall through to live fetch */
  }

  // Cache miss → live Gateway call
  const crons = await getCrons();
  return { crons };
};
