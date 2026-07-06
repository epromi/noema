import { json } from "@sveltejs/kit";
import { checkSsrHealth, getSsrOrigin } from "$lib/core/build-integrity";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  try {
    const origin = getSsrOrigin();
    const result = await checkSsrHealth(origin);

    if (!result.ok) {
      return json(
        { ok: false, error: result.error ?? "SSR health check failed" },
        { status: 500 },
      );
    }

    return json({ ok: true, bytes: result.bytes });
  } catch (err) {
    return json({ ok: false, error: String(err) }, { status: 500 });
  }
};
