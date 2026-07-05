import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AllProviders } from "$lib/providers/types";
import { workspaceRoot } from "$lib/providers/openclaw";
import { getProvider } from "$lib/providers";
import type { NoemaData } from "$lib/types";

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
