import { startCollector } from "$lib/server/collector";
import type { Handle } from "@sveltejs/kit";

let collectorStarted = false;

export const handle: Handle = async ({ event, resolve }) => {
  if (!collectorStarted) {
    collectorStarted = true;
    startCollector();
  }

  return resolve(event);
};
