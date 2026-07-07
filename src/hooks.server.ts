import { startCollector } from "$lib/server/collector";
import { startPkgWatcher } from "$lib/server/pkg-watcher";
import type { Handle } from "@sveltejs/kit";

let serverServicesStarted = false;

export const handle: Handle = async ({ event, resolve }) => {
  if (!serverServicesStarted) {
    serverServicesStarted = true;
    startCollector();
    startPkgWatcher();
  }

  return resolve(event);
};
