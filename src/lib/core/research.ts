import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { AllProviders } from "$lib/providers/types";
import { workspaceRoot } from "$lib/providers/openclaw";
import { getProvider } from "$lib/providers";
import type {
  ResearchData,
  ResearchProposal,
  OttoRunEntry,
  OttoRunStatus,
} from "$lib/types";
import { countFiles, safeParseJson } from "./utils.js";

export async function getResearch(
  providers?: AllProviders,
): Promise<ResearchData> {
  const p = providers ?? getProvider();

  try {
    const workspace = workspaceRoot();
    const researchRoot = join(workspace, "memory", "research");

    const { total, recent } = await countFiles(async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true });
      return Promise.all(
        entries.map(async (e) => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          mtimeMs: e.isDirectory()
            ? undefined
            : (await stat(join(dir, e.name))).mtimeMs,
        })),
      );
    }, researchRoot);

    let latestDate = "";
    let autoFixCount = 0;
    let proposeCount = 0;
    const proposals: ResearchProposal[] = [];

    try {
      const noemaDir = join(researchRoot, "noema");
      const files = (await readdir(noemaDir))
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse();
      if (files[0]) {
        latestDate = files[0].replace(".md", "");
        const content = await p.filesystem.readResearch(`noema/${files[0]}`);
        autoFixCount = countSectionRows(content, "🔧 AUTO-FIX");
        proposeCount = countSectionRows(content, "📋 PROPOSE");
        proposals.push(...parseProposals(content));
      }
    } catch {
      /* no noema research yet */
    }

    try {
      const actionsRaw = await p.filesystem.readState("noema-actions.jsonl");
      const actions = actionsRaw
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => safeParseJson<{ id?: string; status?: string }>(l, {}));

      for (const proposal of proposals) {
        const match = actions.find((a) => a.id === proposal.id);
        if (match?.status) proposal.status = match.status;
      }
    } catch {
      /* no actions file */
    }

    const ottoRuns = await loadOttoRuns(p, researchRoot);

    return {
      totalFiles: total,
      recentFiles: recent,
      latestDate,
      proposals: proposals.slice(0, 8),
      autoFixCount,
      proposeCount,
      ottoRuns,
      updatedAt: Date.now(),
    };
  } catch (err) {
    return {
      totalFiles: 0,
      recentFiles: 0,
      latestDate: "",
      proposals: [],
      autoFixCount: 0,
      proposeCount: 0,
      ottoRuns: [],
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}

function countSectionRows(content: string, header: string): number {
  const startIdx = content.indexOf(`### ${header}`);
  if (startIdx === -1) return 0;
  const afterStart = content.indexOf("\n", startIdx);
  const nextSection = content.indexOf("\n### ", afterStart + 1);
  const sectionEnd = nextSection === -1 ? content.length : nextSection;
  const section = content.substring(afterStart, sectionEnd);
  return (section.match(/^\| \d+ \|.*\|/gm) ?? []).length;
}

function parseProposals(content: string): ResearchProposal[] {
  const proposals: ResearchProposal[] = [];
  const propStart = content.indexOf("### 📋 PROPOSE");
  if (propStart === -1) return proposals;

  const propEnd = content.indexOf("\n### ", propStart + 1);
  const propSection = content.substring(
    propStart,
    propEnd === -1 ? content.length : propEnd,
  );
  const lines = propSection.split("\n").filter((l) => l.match(/^\| \d+ \|/));

  for (const line of lines) {
    const parts = line
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      proposals.push({
        id: `P-${parts[0]}`,
        finding: parts[1] ?? "",
        priority: parts[3] ?? "🟢",
      });
    }
  }

  return proposals;
}

async function loadOttoRuns(
  p: AllProviders,
  researchRoot: string,
): Promise<OttoRunEntry[]> {
  const nightlyDir = join(researchRoot, "..", "nightly");
  try {
    const files = (await readdir(nightlyDir))
      .filter((f) => f.startsWith("nightly-review-") && f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, 10);

    const runs: OttoRunEntry[] = [];
    for (const file of files) {
      const content = await p.filesystem.readMemory(`nightly/${file}`);
      runs.push(parseOttoRun(file, content));
    }
    return runs;
  } catch {
    return [];
  }
}

function parseOttoRun(filename: string, content: string): OttoRunEntry {
  const lines = content.split("\n");
  const title = lines[0]?.replace(/^#\s*/, "") || filename;
  const date = filename
    .replace("nightly-review-", "")
    .replace(".md", "");

  let summaryStart = 1;
  for (let i = 1; i < lines.length && i < 10; i++) {
    const line = lines[i] ?? "";
    if (
      line.startsWith("**") ||
      line.startsWith(">") ||
      line.length < 3 ||
      line.trim() === "---"
    ) {
      summaryStart++;
      continue;
    }
    break;
  }

  const summary = lines
    .slice(summaryStart, summaryStart + 3)
    .join(" ")
    .substring(0, 200);

  const steps: OttoRunEntry["steps"] = [];
  for (const line of lines) {
    const stepMatch = line.match(/^- \[(x| )\]\s+(N\+\d+):\s+(.+)/);
    if (stepMatch) {
      steps.push({
        status: stepMatch[1] === "x" ? "ok" : "pending",
        label: stepMatch[3] ?? "",
      });
    }
  }

  let status: OttoRunStatus = "ok";
  const upper = title.toUpperCase();
  if (upper.includes("FAILED") || upper.includes("ERROR")) status = "err";
  else if (upper.includes("WARN")) status = "warn";

  return { title, date, summary, steps, status };
}
