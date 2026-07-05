import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AllProviders } from "$lib/providers/types";
import { workspaceRoot } from "$lib/providers/openclaw";
import { getProvider } from "$lib/providers";
import type {
  ActionQueueData,
  ActionQueueItem,
  BrainstormData,
  BrainstormItem,
  BrainstormSection,
  BrainstormSectionKey,
  DashboardActionType,
  DevJobStatus,
  NoemaData,
} from "$lib/types";

export const DEFAULT_RELAY_URL = "http://127.0.0.1:18998";

export type DevJobIndicatorState = "idle" | "soon" | "active" | "offline";

export interface DevJobCountdown {
  text: string;
  soon: boolean;
  expired: boolean;
}

/** Fetch dev-loop status from relay `/next-trigger` + `/running`. */
export async function getDevJobStatus(
  relayUrl: string = DEFAULT_RELAY_URL,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<DevJobStatus> {
  try {
    const [ntRes, rRes] = await Promise.all([
      fetchFn(`${relayUrl}/next-trigger`),
      fetchFn(`${relayUrl}/running`),
    ]);

    if (!ntRes.ok || !rRes.ok) {
      throw new Error(`relay HTTP ${ntRes.status}/${rRes.status}`);
    }

    const nt = (await ntRes.json()) as { nextMs?: number; queue?: number };
    const r = (await rRes.json()) as { running?: string | null };

    return {
      nextMs: nt.nextMs ?? 0,
      queue: nt.queue ?? 0,
      running: r.running ?? null,
      updatedAt: Date.now(),
    };
  } catch {
    return {
      nextMs: 0,
      queue: 0,
      running: null,
      updatedAt: Date.now(),
      error: "offline",
    };
  }
}

/** MM:SS countdown label for the floating dev-job indicator. */
export function formatDevJobCountdown(
  nextMs: number,
  offline: boolean,
  now = Date.now(),
): DevJobCountdown {
  if (offline) {
    return { text: "offline", soon: false, expired: false };
  }
  if (nextMs <= 0) {
    return { text: "—", soon: false, expired: false };
  }

  const diff = nextMs - now;
  if (diff <= 0) {
    return { text: "most...", soon: true, expired: true };
  }

  const mins = Math.floor(diff / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  return {
    text: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    soon: diff < 60_000,
    expired: false,
  };
}

/** Border/animation state for DevJobIndicator.svelte. */
export function getDevJobIndicatorState(
  status: DevJobStatus,
  now = Date.now(),
): DevJobIndicatorState {
  if (status.error) return "offline";
  if (status.running) return "active";
  if (status.nextMs > 0 && status.nextMs - now < 60_000) return "soon";
  return "idle";
}

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

const BRAINSTORM_SECTION_META: Record<
  BrainstormSectionKey,
  Omit<BrainstormSection, "key" | "items">
> = {
  autoexec: {
    label: "⚡ AUTOEXECUTE",
    desc: "Alfred executes, no approval needed",
    color: "var(--green)",
    bgColor: "var(--g-bg)",
  },
  autonotify: {
    label: "🔔 AUTO_NOTIFY",
    desc: "Alfred executes + reports, András sees result",
    color: "var(--accent)",
    bgColor: "#1a2a3a",
  },
  approval: {
    label: "✋ APPROVAL NEEDED",
    desc: "András decides before work starts",
    color: "var(--yellow)",
    bgColor: "var(--y-bg)",
  },
  weekend: {
    label: "🔧 WEEKEND BUILD",
    desc: "András builds, 2-4h",
    color: "var(--purple)",
    bgColor: "#2a1a4a",
  },
  backlog: {
    label: "📋 BACKLOG",
    desc: "Interesting, not now",
    color: "var(--muted)",
  },
};

const BRAINSTORM_SECTION_ORDER: BrainstormSectionKey[] = [
  "autoexec",
  "autonotify",
  "approval",
  "weekend",
  "backlog",
];

function parseBrainstormStatus(
  emoji: string,
): Pick<BrainstormItem, "status" | "done"> {
  if (emoji === "✅") return { status: "done", done: true };
  if (emoji === "⏳") return { status: "waiting", done: false };
  return { status: "pending", done: false };
}

function parseBrainstormLine(
  line: string,
  section: BrainstormSectionKey,
): BrainstormItem | null {
  const standard = line.match(
    /^\|\s*(BA-\d+|BN-\d+|AP-\d+|WB-\d+)\s*\|\s*(⬜|✅|⏳|🔄)\s*[^|]*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\S+)/,
  );
  if (standard) {
    const { status, done } = parseBrainstormStatus(standard[2] ?? "⬜");
    return {
      id: standard[1] ?? "",
      name: (standard[3] ?? "").trim().substring(0, 100),
      status,
      done,
      source: (standard[4] ?? "").trim().substring(0, 80),
      age: standard[5],
    };
  }

  if (section === "backlog") {
    const backlog = line.match(/^\|\s*(BL-\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
    if (backlog) {
      return {
        id: backlog[1] ?? "",
        name: (backlog[2] ?? "").trim().substring(0, 100),
        status: "pending",
        done: false,
        source: (backlog[3] ?? "").trim().substring(0, 80),
      };
    }
  }

  return null;
}

/** Parse memory/brainstorming/action-tracker.md into categorized sections. */
export async function getBrainstorm(
  providers?: AllProviders,
): Promise<BrainstormData> {
  const p = providers ?? getProvider();
  const itemsBySection: Record<BrainstormSectionKey, BrainstormItem[]> = {
    autoexec: [],
    autonotify: [],
    approval: [],
    weekend: [],
    backlog: [],
  };
  let pending = 0;

  try {
    const tracker = await p.filesystem.readMemory(
      "brainstorming/action-tracker.md",
    );
    let section: BrainstormSectionKey | "" = "";

    for (const line of tracker.split("\n")) {
      if (line.match(/^## ⚡ AUTOEXECUTE/)) {
        section = "autoexec";
        continue;
      }
      if (line.match(/^## 🔔 AUTO_NOTIFY/)) {
        section = "autonotify";
        continue;
      }
      if (line.match(/^## ✋ APPROVAL_NEEDED/)) {
        section = "approval";
        continue;
      }
      if (line.match(/^## 🔧 WEEKEND_BUILD/)) {
        section = "weekend";
        continue;
      }
      if (line.match(/^## 📋 BACKLOG/)) {
        section = "backlog";
        continue;
      }
      if (line.match(/^## /)) {
        section = "";
        continue;
      }
      if (!section) continue;

      const item = parseBrainstormLine(line, section);
      if (!item) continue;
      itemsBySection[section].push(item);
      if (!item.done) pending++;
    }

    const sections: BrainstormSection[] = BRAINSTORM_SECTION_ORDER.map(
      (key) => ({
        key,
        ...BRAINSTORM_SECTION_META[key],
        items: itemsBySection[key],
      }),
    );

    return {
      sections,
      pending,
      updatedAt: Date.now(),
    };
  } catch (err) {
    return {
      sections: BRAINSTORM_SECTION_ORDER.map((key) => ({
        key,
        ...BRAINSTORM_SECTION_META[key],
        items: [],
      })),
      pending: 0,
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}
