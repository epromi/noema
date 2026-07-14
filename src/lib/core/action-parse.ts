/** @file Dashboard action parser — extracts actions from agent prompts and tool calls. */

import type { ActionOption, DashboardActionType } from "$lib/types";

/** Maps markdown action labels to dashboard relay action types. */
export const LABEL_TO_ACTION: Record<string, DashboardActionType> = {
  done: "done",
  escalate: "escalate",
  investigate: "investigate",
  restart: "restart",
  trigger: "trigger",
  activate: "activate",
  paid: "paid",
  implement: "implement",
  mehet: "implement",
  resolve: "resolve",
  delegate: "delegate",
};

/** Result of parsing action-queue line description. */
export interface ParsedActionLine {
  cleanText: string;
  actions: DashboardActionType[];
  options: ActionOption[];
}

/**
 * Parse trailing `→ [A: label|B: label|C: label]` syntax.
 * When options are found, they OVERRIDE the fallback actions.
 * Falls back to `fallback` when syntax is missing or malformed.
 */
export function parseActionSyntax(
  text: string,
  fallback: DashboardActionType[],
): ParsedActionLine {
  const match = text.match(/→\s*\[([^\]]+)\]\s*$/);
  if (!match) {
    return { cleanText: text.trim(), actions: fallback, options: [] };
  }

  const rawOptions = (match[1] ?? "").split("|").map((s) => s.trim());
  const cleanStripped = text.replace(match[0], "").trim();

  const options: ActionOption[] = [];
  for (let i = 0; i < rawOptions.length; i++) {
    const opt = rawOptions[i];
    if (!opt) continue;
    const colonIdx = opt.indexOf(":");
    if (colonIdx === -1) {
      console.warn(
        `[action-parse] Malformed option (no colon): "${opt}" in "${text}"`,
      );
      return { cleanText: cleanStripped, actions: fallback, options: [] };
    }
    const letter = opt.substring(0, colonIdx).trim().toUpperCase();
    const label = opt.substring(colonIdx + 1).trim();
    if (!/^[A-Z]$/.test(letter)) {
      console.warn(
        `[action-parse] Malformed option letter: "${letter}" in "${text}"`,
      );
      return { cleanText: cleanStripped, actions: fallback, options: [] };
    }
    if (options.length >= 5) {
      console.warn(
        `[action-parse] Too many options (max 5): ${rawOptions.length} in "${text}"`,
      );
      return { cleanText: cleanStripped, actions: fallback, options: [] };
    }
    const key = `option_${letter.toLowerCase()}` as DashboardActionType;
    options.push({ key, label: `${letter}: ${label}` });
  }

  if (options.length === 0) {
    return { cleanText: cleanStripped, actions: fallback, options: [] };
  }

  return { cleanText: cleanStripped, actions: [], options };
}
