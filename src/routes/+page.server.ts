import { getDevPackages } from "$lib/core/dev-loop-log";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const devPackages = await getDevPackages();

  return {
    loadedAt: Date.now(),
    devPackages,
  };
};
