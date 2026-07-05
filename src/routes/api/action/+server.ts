import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const RELAY = "http://127.0.0.1:18998";

export const POST: RequestHandler = async ({ request, fetch }) => {
  const body = await request.json();
  const res = await fetch(`${RELAY}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return json(data);
};
