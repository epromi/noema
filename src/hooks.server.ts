import { startCollector } from "$lib/server/collector";
import { startPkgWatcher } from "$lib/server/pkg-watcher";
import type { Handle } from "@sveltejs/kit";

let serverServicesStarted = false;

export const handle: Handle = async ({ event, resolve }) => {
  if (!serverServicesStarted) {
    serverServicesStarted = true;

    // Validate critical env vars before starting services
    const token = process.env.OPENCLAW_GATEWAY_TOKEN;
    if (!token) {
      console.warn("[noema] ⚠️  OPENCLAW_GATEWAY_TOKEN not set — Gateway API calls will fail");
    }
    const workspace = process.env.WORKSPACE_ROOT || "$HOME/.openclaw/workspace";
    console.log(`[noema] services starting (workspace: ${workspace})`);

    startCollector();
    startPkgWatcher();
  }

  return resolve(event);
};
