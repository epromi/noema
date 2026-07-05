import { createOpenClawProviders } from "./openclaw.js";
import type { AllProviders } from "./types.js";

/** Singleton OpenClaw provider instance for production use. */
export const provider: AllProviders = createOpenClawProviders();
