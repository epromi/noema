import { json } from "@sveltejs/kit";
import { getLogs } from "$lib/core/logs";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const data = await getLogs();
  return json(data, {
    headers: { "Cache-Control": "no-cache" },
  });
};
