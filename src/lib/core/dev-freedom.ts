/** DevFreedom level for Cursor gardening scope. */
export type DevFreedomLevel = "gardening" | "strict";

export interface ResearchQueryResult {
  query: string;
  summary: string;
  takeaway: string;
}

export interface SpecAnalysisJson {
  pkgId: string;
  files: string[];
  deps: string[];
  devFreedom: DevFreedomLevel;
  researchEnabled: boolean;
  research?: {
    durationSec: number;
    resultCount: number;
    markdown: string;
  };
  updatedAt: number;
}

export interface PromptFillVars {
  pkgId: string;
  pkgName: string;
  pkgSize: string;
  pkgEffort: string;
  expectedFiles: string[];
  devFreedom: DevFreedomLevel;
  gardeningSection: string;
  researchSection: string;
}

export interface PhaseOutputContext {
  logsDir: string;
  pkgId: string;
  specAnalysisPath?: string;
  strategyPath?: string;
  cursorPromptPath?: string;
  deepReviewPath?: string;
  ciResultPath?: string;
  reviewLogGlob?: string;
  gitDiffCount?: number;
  commitHash?: string;
}

const PHASE_NAMES: Record<number, string> = {
  0: "Phase 0: Spec Review",
  1: "Phase 1: Spec Analysis",
  2: "Phase 2: Strategy",
  3: "Phase 3: Cursor Prompt",
  4: "Phase 4: Cursor Agent",
  5: "Phase 5: Deep Review",
  6: "Phase 6: Commit",
  7: "Phase 7: CI Verification",
};

/** Extract the PKG status/metadata header line (first **Státusz** line). */
export function extractStatusLine(specText: string): string {
  const match = specText.match(/^\*\*Státusz\*\*:[^\n]*/m);
  return match?.[0] ?? "";
}

function parseMetadataField(
  source: string,
  field: string,
): string | undefined {
  const patterns = [
    new RegExp(`\\*\\*${field}\\*\\*:\\s*([^|\\n]+)`, "i"),
    new RegExp(`${field}:\\s*([^|\\n]+)`, "i"),
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

/** Parse DevFreedom from spec metadata; defaults to gardening. */
export function parseDevFreedom(specText: string): DevFreedomLevel {
  const status = extractStatusLine(specText);
  const source = status || specText.split("\n").slice(0, 8).join("\n");
  const value = parseMetadataField(source, "DevFreedom")?.toLowerCase();
  if (value === "strict") return "strict";
  return "gardening";
}

/** Parse Research flag from spec metadata; defaults to false. */
export function parseResearchEnabled(specText: string): boolean {
  const status = extractStatusLine(specText);
  const source = status || specText.split("\n").slice(0, 8).join("\n");
  const value = parseMetadataField(source, "Research")?.toLowerCase();
  if (value === "yes") return true;
  if (value === "no") return false;
  return false;
}

/** Extract dependency PKG ids from spec text. */
export function extractSpecDeps(specText: string): string[] {
  const deps = new Set<string>();
  const pattern = /PKG-\d{3}(?:-[a-z0-9-]+)?/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(specText)) !== null) {
    const id = match[0];
    if (!/^PKG-\d{3}$/i.test(id)) {
      deps.add(id);
    }
  }
  return [...deps].sort();
}

/** Extract backtick file paths from spec (lib/, tests/, src/). */
export function extractExpectedFiles(specText: string): string[] {
  const pattern = /`(lib|tests|src)\/[^`]+\.(ts|svelte|js|html)`/g;
  const files = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(specText)) !== null) {
    files.add(match[0].slice(1, -1));
  }
  return [...files].sort();
}

/** Read package title from spec H1. */
export function extractSpecTitle(specText: string): string {
  const match = specText.match(/^#\s*PKG-\d+:\s*(.+)$/m);
  return match?.[1]?.trim() ?? "feature";
}

/** First non-empty paragraph after ## Kérés or ## Probléma. */
export function extractSpecSubject(specText: string): string {
  const title = extractSpecTitle(specText);
  const sectionMatch = specText.match(
    /##\s*(?:Kérés|Probléma|Request)\s*\n+([^#\n][^\n]+)/i,
  );
  const paragraph = sectionMatch?.[1]?.trim();
  if (paragraph && paragraph.length > 10) {
    return paragraph.slice(0, 80);
  }
  return title;
}

/** Build research queries from topics file or auto-generate from spec. */
export function generateResearchQueries(
  specText: string,
  topicsContent?: string,
): string[] {
  const fromTopics = parseResearchTopics(topicsContent);
  if (fromTopics.length > 0) return fromTopics.slice(0, 4);

  const subject = extractSpecSubject(specText);
  const tech = inferTechnology(specText);
  return [
    `${subject} dashboard design pattern`,
    `${tech} best practice 2026`,
  ];
}

function parseResearchTopics(topicsContent?: string): string[] {
  if (!topicsContent?.trim()) return [];
  return topicsContent
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 3 && !line.startsWith("#"));
}

function inferTechnology(specText: string): string {
  if (/svelte/i.test(specText)) return "SvelteKit";
  if (/typescript|\.ts/i.test(specText)) return "TypeScript";
  return "SvelteKit";
}

/** Format research results for Phase 1 log and cursor prompt. */
export function formatResearchMarkdown(
  results: ResearchQueryResult[],
  durationSec: number,
): string {
  if (results.length === 0) {
    return `## 🔍 Research (${durationSec}s, 0 results)\n\n(no results — timeout or search unavailable)`;
  }

  const lines = [
    `## 🔍 Research (${durationSec}s, ${results.length} results)`,
    "",
  ];

  results.forEach((result, index) => {
    lines.push(`### Query ${index + 1}: "${result.query}"`);
    lines.push(`📊 ${result.summary}`);
    lines.push(`🎯 ${result.takeaway}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

/** Build gardening section for Cursor prompt (F4). */
export function buildGardeningPromptSection(level: DevFreedomLevel): string {
  if (level === "strict") {
    return [
      "## 🎨 Gardening (DevFreedom: strict)",
      "",
      "Implement **only** what the spec requires. Do not refactor, DRY, or polish code beyond the listed scope.",
      "",
    ].join("\n");
  }

  return [
    "## 🎨 Gardening (DevFreedom: gardening)",
    "",
    "You may improve the code within the files listed above. Allowed:",
    "- Fix TypeScript `any` → concrete types",
    "- Add missing error handling, fallback values",
    "- Remove unused imports, add accessibility attributes",
    "- Fix simple TODO/FIXME comments in touched files",
    "- DRY up duplicated code within these files",
    "",
    "NOT allowed: change API contracts, CSS design tokens, routing, add deps,",
    "touch files outside scope, modify // STABLE code.",
    "",
    "If you see a larger improvement opportunity, add a comment:",
    "`💡 SUGGESTION: <brief description>`",
    "",
  ].join("\n");
}

/** Replace cursor-implement.txt placeholders. */
export function fillCursorPrompt(
  template: string,
  vars: PromptFillVars,
): string {
  const files =
    vars.expectedFiles.length > 0
      ? vars.expectedFiles.map((f) => `- ${f}`).join("\n")
      : "- (none listed in spec — check Scope section)";

  let out = template;
  out = out.replace(/PKG_PLACEHOLDER/g, vars.pkgId);
  out = out.replace(/PKG_NAME_PLACEHOLDER/g, vars.pkgName);
  out = out.replace(/PKG_SIZE_PLACEHOLDER/g, vars.pkgSize);
  out = out.replace(/PKG_EFFORT_PLACEHOLDER/g, vars.pkgEffort);
  out = out.replace(/PKG_FILES_PLACEHOLDER/g, files);
  out = out.replace(/DEVFREEDOM_PLACEHOLDER/g, vars.devFreedom);
  out = out.replace(/GARDENING_PLACEHOLDER/g, vars.gardeningSection);
  out = out.replace(
    /RESEARCH_PLACEHOLDER/g,
    vars.researchSection.trim() || "(none)",
  );

  // Legacy: strip old inline GARDENING block if template still has it
  if (vars.devFreedom === "strict") {
    out = out.replace(
      /^## GARDENING — allowed ONLY[\s\S]*?(?=^## RESEARCH FINDINGS|^## DONE)/m,
      "",
    );
  }

  return out;
}

/** Build spec-analysis.json payload for Phase 1. */
export function buildSpecAnalysis(input: {
  pkgId: string;
  files: string[];
  deps: string[];
  devFreedom: DevFreedomLevel;
  researchEnabled: boolean;
  researchMarkdown?: string;
  researchDurationSec?: number;
  researchResultCount?: number;
}): SpecAnalysisJson {
  const analysis: SpecAnalysisJson = {
    pkgId: input.pkgId,
    files: input.files,
    deps: input.deps,
    devFreedom: input.devFreedom,
    researchEnabled: input.researchEnabled,
    updatedAt: Date.now(),
  };

  if (input.researchMarkdown) {
    analysis.research = {
      durationSec: input.researchDurationSec ?? 0,
      resultCount: input.researchResultCount ?? 0,
      markdown: input.researchMarkdown,
    };
  }

  return analysis;
}

/** Check non-empty file at path (sync check via caller-provided existence). */
export function isNonEmptyFile(content: string | undefined | null): boolean {
  return typeof content === "string" && content.trim().length > 0;
}

/** Validate mandatory phase output exists (F3). Pure logic — file reads done by caller. */
export function validatePhaseOutput(
  phase: number,
  ctx: PhaseOutputContext & {
    fileContents?: Record<string, string | undefined>;
  },
): { ok: boolean; phaseName: string; error?: string } {
  const phaseName = PHASE_NAMES[phase] ?? `Phase ${phase}`;
  const contents = ctx.fileContents ?? {};

  const requireFile = (
    key: string,
    path: string | undefined,
  ): string | undefined => {
    if (!path) return `${phaseName}: missing path for ${key}`;
    const content = contents[path];
    if (content === undefined) return `${phaseName}: missing output ${path}`;
    if (!isNonEmptyFile(content)) return `${phaseName}: empty output ${path}`;
    return undefined;
  };

  switch (phase) {
    case 0: {
      const review = contents["reviewLog"];
      if (!isNonEmptyFile(review)) {
        return {
          ok: false,
          phaseName,
          error: `${phaseName}: missing review log`,
        };
      }
      return { ok: true, phaseName };
    }
    case 1: {
      const err = requireFile("specAnalysis", ctx.specAnalysisPath);
      if (err) return { ok: false, phaseName, error: err };
      return { ok: true, phaseName };
    }
    case 2: {
      const err = requireFile("strategy", ctx.strategyPath);
      if (err) return { ok: false, phaseName, error: err };
      return { ok: true, phaseName };
    }
    case 3: {
      const err = requireFile("cursorPrompt", ctx.cursorPromptPath);
      if (err) return { ok: false, phaseName, error: err };
      return { ok: true, phaseName };
    }
    case 4: {
      const count = ctx.gitDiffCount ?? 0;
      if (count < 1) {
        return {
          ok: false,
          phaseName,
          error: `${phaseName}: no files changed in git diff`,
        };
      }
      return { ok: true, phaseName };
    }
    case 5: {
      const err = requireFile("deepReview", ctx.deepReviewPath);
      if (err) return { ok: false, phaseName, error: err };
      return { ok: true, phaseName };
    }
    case 6: {
      if (!ctx.commitHash?.trim()) {
        return {
          ok: false,
          phaseName,
          error: `${phaseName}: missing commit hash`,
        };
      }
      return { ok: true, phaseName };
    }
    case 7: {
      const err = requireFile("ciResult", ctx.ciResultPath);
      if (err) return { ok: false, phaseName, error: err };
      return { ok: true, phaseName };
    }
    default:
      return { ok: true, phaseName };
  }
}

/** Summarize a web snippet into research result lines. */
export function summarizeSearchSnippet(
  query: string,
  snippet: string,
): ResearchQueryResult {
  const cleaned = snippet.replace(/\s+/g, " ").trim().slice(0, 280);
  const summary = cleaned || "No snippet available from search results.";
  const takeaway =
    summary.length > 60
      ? `Consider: ${summary.slice(0, 120)}…`
      : "No actionable takeaway — validate manually.";
  return { query, summary, takeaway };
}
