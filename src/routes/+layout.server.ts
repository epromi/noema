import { getCrons } from "$lib/core/crons";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async () => {
  const crons = await getCrons();
  return { crons };
};
