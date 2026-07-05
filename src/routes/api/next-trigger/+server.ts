import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const RELAY = "http://127.0.0.1:18998";

export const GET: RequestHandler = async ({ fetch }) => {
  try {
    const res = await fetch(`${RELAY}/next-trigger`);
    const data = await res.json();
    return json(data, {
      headers: { "Cache-Control": "no-cache" },
    });
  } catch (err) {
    return json(
      { nextMs: 0, queue: 0, error: String(err) },
      { headers: { "Cache-Control": "no-cache" } },
    );
  }
};
