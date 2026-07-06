import { json } from "@sveltejs/kit";
import { writeQueueMarker } from "$lib/core/dev-loop-log";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request }) => {
  const pkgId = params.pkgId ?? "";
  if (!pkgId) {
    return json({ ok: false, error: "Missing pkgId" }, { status: 400 });
  }

  let estimatedMs = 90 * 60_000;
  try {
    const body = (await request.json()) as { estimatedMs?: number };
    if (typeof body.estimatedMs === "number" && body.estimatedMs > 0) {
      estimatedMs = body.estimatedMs;
    }
  } catch {
    /* use default */
  }

  try {
    await writeQueueMarker(pkgId, estimatedMs);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) }, { status: 500 });
  }
};
