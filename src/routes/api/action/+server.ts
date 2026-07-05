import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const RELAY = "http://127.0.0.1:18998";

export const POST: RequestHandler = async ({ request, fetch }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const res = await fetch(`${RELAY}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return json(
        { ok: false, error: `Relay returned ${res.status}: ${text}`.trim() },
        { status: 502 },
      );
    }

    const data = await res.json();
    return json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/action] relay unreachable:", msg);
    return json(
      { ok: false, error: `Relay unreachable: ${msg}` },
      { status: 502 },
    );
  }
};
