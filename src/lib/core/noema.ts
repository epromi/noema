import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AllProviders } from "$lib/providers/types";
import { workspaceRoot } from "$lib/providers/openclaw";
import { getProvider } from "$lib/providers";
import type { ActionQueueData, ActionQueueItem, DashboardActionType, NoemaData } from "$lib/types";

const NOEMA_CRON_IDS = ["cbc7d5d6", "3b4ea5d3", "eed1df55"];

export async function getNoema(providers?: AllProviders): Promise<NoemaData> {
  const p = providers ?? getProvider();

  try {
    const workspace = workspaceRoot();
    const noemaDir = join(workspace, "projects", "noema");

    const [genLines, relayLines, procLines, changelog, cronJobs] =
      await Promise.all([
        lineCount(join(noemaDir, "generate.cjs")),
        lineCount(join(noemaDir, "relay.js")),
        lineCount(join(noemaDir, "action-processor.cjs")),
        readFile(join(noemaDir, "CHANGELOG.md"), "utf8").catch(() => ""),
        p.cron.listCrons().catch(() => []),
      ]);

    const totalLoc = genLines + relayLines + procLines;
    const cronHealthy = NOEMA_CRON_IDS.filter((prefix) =>
      cronJobs.some(
        (j) =>
          j.id.startsWith(prefix) &&
          (j.state?.lastRunStatus ?? j.status) === "ok",
      ),
    ).length;

    let activeProposals = 0;
    try {
      const indexMd = await readFile(
        join(noemaDir, "dev", "packages", "INDEX.md"),
        "utf8",
      );
      const rows = indexMd
        .split("\n")
        .filter((l) => l.match(/^\| PKG-\d{3}\s*\|/));
      activeProposals = rows.filter((r) => !r.includes("✅")).length;
    } catch {
      /* no index */
    }

    const healthScore = Math.round(85 * (cronHealthy / NOEMA_CRON_IDS.length));

    return {
      metrics: {
        healthScore,
        cronsHealthy: cronHealthy,
        cronsTotal: NOEMA_CRON_IDS.length,
        totalLoc,
        activeProposals,
      },
      changelog: parseChangelog(changelog),
      architecture: [
        "  lib/core/*.ts ──► getAllData()",
        "       ▲                  │",
        "  lib/providers/     SvelteKit UI",
        "  (OpenClaw adapter)   :5173 dev",
        "       │",
        "  openclaw CLI + filesystem",
      ].join("\n"),
      updatedAt: Date.now(),
    };
  } catch (err) {
    return {
      metrics: {
        healthScore: 0,
        cronsHealthy: 0,
        cronsTotal: 3,
        totalLoc: 0,
        activeProposals: 0,
      },
      changelog: "",
      architecture: "",
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}

async function lineCount(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, "utf8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

function parseChangelog(content: string): string {
  if (!content) return "—";
  const entries = content.split(/^## (\d{4}-\d{2}-\d{2})/gm);
  const items: string[] = [];
  for (let i = 1; i < entries.length && items.length < 3; i += 2) {
    const date = entries[i];
    const body = (entries[i + 1] ?? "")
      .trim()
      .split("\n")
      .filter((l) => l.startsWith("-") || l.startsWith("###"))
      .slice(0, 3)
      .join("\n");
    items.push(`${date}: ${body}`);
  }
  return items.join("\n\n") || "—";
}

type ActionQueueColumn = "auto" | "alfred" | "andras";

const DEFAULT_ACTIONS: Record<ActionQueueColumn, DashboardActionType[]> = {
  auto: [],
  alfred: ["done", "escalate", "investigate"],
  andras: ["done", "escalate"],
};

const LABEL_TO_ACTION: Record<string, DashboardActionType> = {
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

/** Parse memory/state/action-queue.md into kanban columns. */
export async function getActionQueue(
  providers?: AllProviders,
): Promise<ActionQueueData> {
  const p = providers ?? getProvider();

  try {
    const aqText = await p.filesystem.readState("action-queue.md");
    const queue: ActionQueueData = {
      auto: [],
      alfred: [],
      andras: [],
      updatedAt: Date.now(),
    };

    let section: ActionQueueColumn | "" = "";
    for (const line of aqText.split("\n")) {
      if (line.match(/^#{1,3}\s*⚡.*Auto-resolved/i)) {
        section = "auto";
        continue;
      }
      if (line.match(/^#{1,3}\s*👔.*Alfred/i)) {
        section = "alfred";
        continue;
      }
      if (line.match(/^#{1,3}\s*🧑.*András/i)) {
        section = "andras";
        continue;
      }
      if (
        line.match(/^#{1,3}\s*✅.*Resolved/i) ||
        (line.startsWith("#") && !line.startsWith("# Action Queue"))
      ) {
        section = "";
        continue;
      }
      if (!section) continue;

      const item = parseActionQueueLine(line, section);
      if (item) queue[section].push(item);

      const metaMatch = line.match(/└──\s+(.+)/);
      if (metaMatch && queue[section].length > 0) {
        const last = queue[section][queue[section].length - 1];
        if (last) last.meta = metaMatch[1]?.trim() ?? last.meta;
      }
    }

    return queue;
  } catch (err) {
    return {
      auto: [],
      alfred: [],
      andras: [],
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}

function parseActionQueueLine(
  line: string,
  section: ActionQueueColumn,
): ActionQueueItem | null {
  const formatA = line.match(
    /^[-*]\s+\[(.)\] \[(\d{2}-\d{2})\] \[(P\d)\]\s+(\S+)\s+—\s+(.*)/,
  );
  if (formatA) {
    return buildActionItem(
      formatA[1] ?? " ",
      formatA[5] ?? "",
      formatA[4] ?? "",
      `[${formatA[2]}] ${formatA[3]}`,
      section,
    );
  }

  const formatC = line.match(
    /^[-*]\s+\[(.)\] \[(\d{2}-\d{2})\]\s+(\S+)\s+—\s+(.*)/,
  );
  if (formatC) {
    return buildActionItem(
      formatC[1] ?? " ",
      formatC[4] ?? "",
      formatC[3] ?? "",
      `[${formatC[2]}]`,
      section,
    );
  }

  const formatB = line.match(/^[-*]\s+\[(.)\]\s+(\S+)\s+[—\-]\s+(.*)/);
  if (formatB) {
    return buildActionItem(
      formatB[1] ?? " ",
      formatB[3] ?? "",
      formatB[2] ?? "",
      section === "auto" ? "auto" : "",
      section,
    );
  }

  return null;
}

function buildActionItem(
  checkMark: string,
  rawDesc: string,
  id: string,
  meta: string,
  section: ActionQueueColumn,
): ActionQueueItem | null {
  const checked = checkMark === "x" || checkMark === "X";
  if (section !== "auto" && checked) return null;
  if (section === "auto" && !checked) return null;
  const { cleanDesc, actions } = parseMultiActions(rawDesc, section);
  return { id, desc: cleanDesc, meta, actions };
}

function parseMultiActions(
  text: string,
  column: ActionQueueColumn,
): { cleanDesc: string; actions: DashboardActionType[] } {
  const match = text.match(/→\s*\[([^\]]+)\]\s*$/);
  if (match) {
    const labels = (match[1] ?? "").split("|").map((s) => s.trim());
    const actions = labels
      .map((label) => LABEL_TO_ACTION[label.toLowerCase()])
      .filter((a): a is DashboardActionType => a != null);
    const cleanDesc = text.replace(match[0], "").trim();
    return {
      cleanDesc,
      actions: actions.length > 0 ? actions : DEFAULT_ACTIONS[column],
    };
  }
  return { cleanDesc: text, actions: DEFAULT_ACTIONS[column] };
}
