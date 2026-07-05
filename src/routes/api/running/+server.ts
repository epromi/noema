import { json } from "@sveltejs/kit";
import { getRunningDevLoop } from "$lib/core/dev-loop-log";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const data = await getRunningDevLoop();
  return json(data, {
    headers: { "Cache-Control": "no-cache" },
  });
};
