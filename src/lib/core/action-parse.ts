import type { DashboardActionType } from "$lib/types";

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
};

/**
 * Parse trailing `→ [A|B|C]` syntax from action-queue or PROPOSE lines.
 * Falls back to `fallback` when syntax is missing or labels are unknown.
 */
export function parseActionSyntax(
  text: string,
  fallback: DashboardActionType[],
): { cleanText: string; actions: DashboardActionType[] } {
  const match = text.match(/→\s*\[([^\]]+)\]\s*$/);
  if (!match) {
    return { cleanText: text.trim(), actions: fallback };
  }

  const labels = (match[1] ?? "").split("|").map((s) => s.trim());
  const actions = labels
    .map((label) => LABEL_TO_ACTION[label.toLowerCase()])
    .filter((a): a is DashboardActionType => a != null);
  const cleanText = text.replace(match[0], "").trim();

  return {
    cleanText,
    actions: actions.length > 0 ? actions : fallback,
  };
}
