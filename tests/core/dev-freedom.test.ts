import { describe, it, expect } from "vitest";
import {
  parseDevFreedom,
  parseResearchEnabled,
  extractExpectedFiles,
  generateResearchQueries,
  formatResearchMarkdown,
  buildGardeningPromptSection,
  fillCursorPrompt,
  buildSpecAnalysis,
  validatePhaseOutput,
  type ResearchQueryResult,
} from "$lib/core/dev-freedom";

const SAMPLE_SPEC = `# PKG-042: Agent Status Panel

**Státusz**: 📋 F0 | **Méret**: M | **Becslés**: 1h | **DevFreedom**: strict | **Research**: yes

## Kérés

Show agent status in a slide-in panel with live updates.

## Scope

\`src/lib/core/agents.ts\`
\`src/lib/components/tabs/Agents.svelte\`
`;

describe("dev-freedom", () => {
  it("parseDevFreedom ignores example strict in spec body", () => {
    const spec = `**Státusz**: 📋 F0 | **DevFreedom**: gardening\n\nExample:\n**DevFreedom**: strict\n`;
    expect(parseDevFreedom(spec)).toBe("gardening");
  });

  it("parseResearchEnabled reads from status line only", () => {
    const spec = `**Státusz**: 📋 F0 | **Research**: yes\n\nResearch: no in body\n`;
    expect(parseResearchEnabled(spec)).toBe(true);
  });

  it("parseDevFreedom defaults to gardening", () => {
    expect(parseDevFreedom("# PKG-001: Test\n")).toBe("gardening");
  });

  it("parseDevFreedom reads strict from metadata line", () => {
    expect(parseDevFreedom("**Státusz**: F0 | **DevFreedom**: strict\n")).toBe(
      "strict",
    );
    expect(
      parseDevFreedom("**Státusz**: F0 | **DevFreedom**: gardening\n"),
    ).toBe("gardening");
  });

  it("parseResearchEnabled reads yes/no", () => {
    expect(parseResearchEnabled("**Státusz**: F0 | **Research**: yes\n")).toBe(
      true,
    );
    expect(parseResearchEnabled("**Státusz**: F0 | **Research**: no\n")).toBe(
      false,
    );
  });

  it("parseResearchEnabled defaults to false", () => {
    expect(parseResearchEnabled("# PKG\n")).toBe(false);
  });

  it("extractExpectedFiles pulls backtick paths from spec", () => {
    const files = extractExpectedFiles(SAMPLE_SPEC);
    expect(files).toContain("src/lib/core/agents.ts");
    expect(files).toContain("src/lib/components/tabs/Agents.svelte");
  });

  it("generateResearchQueries uses research-topics.md lines", () => {
    const topics = "- grafana agent status panel\n- svelte dialog a11y";
    const queries = generateResearchQueries(SAMPLE_SPEC, topics);
    expect(queries).toEqual([
      "grafana agent status panel",
      "svelte dialog a11y",
    ]);
  });

  it("generateResearchQueries auto-generates competitor and best-practice queries", () => {
    const queries = generateResearchQueries(SAMPLE_SPEC);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain("dashboard design pattern");
    expect(queries[1]).toMatch(/best practice 2026/i);
  });

  it("formatResearchMarkdown renders spec output shape", () => {
    const results: ResearchQueryResult[] = [
      {
        query: "grafana agent status panel",
        summary: "Grafana uses expandable rows with status badges.",
        takeaway: "Validates our approach — add timestamp to agent detail panel.",
      },
    ];
    const md = formatResearchMarkdown(results, 12);
    expect(md).toContain("## 🔍 Research (12s, 1 results)");
    expect(md).toContain('### Query 1: "grafana agent status panel"');
    expect(md).toContain("📊 Grafana uses expandable rows");
    expect(md).toContain("🎯 Validates our approach");
  });

  it("buildGardeningPromptSection returns full section for gardening", () => {
    const section = buildGardeningPromptSection("gardening");
    expect(section).toContain("## 🎨 Gardening (DevFreedom: gardening)");
    expect(section).toContain("NOT allowed");
    expect(section).toContain("💡 SUGGESTION");
  });

  it("buildGardeningPromptSection is minimal for strict mode", () => {
    const section = buildGardeningPromptSection("strict");
    expect(section).toContain("DevFreedom: strict");
    expect(section).not.toContain("You may improve");
  });

  it("fillCursorPrompt replaces gardening and research placeholders", () => {
    const template = "GARDENING_PLACEHOLDER\nRESEARCH_PLACEHOLDER\nPKG_PLACEHOLDER";
    const out = fillCursorPrompt(template, {
      pkgId: "PKG-039-dev-freedom",
      pkgName: "Dev Freedom",
      pkgSize: "M",
      pkgEffort: "1h",
      expectedFiles: ["src/lib/core/dev-freedom.ts"],
      devFreedom: "gardening",
      gardeningSection: "## 🎨 Gardening",
      researchSection: "(none)",
    });
    expect(out).toContain("PKG-039-dev-freedom");
    expect(out).toContain("## 🎨 Gardening");
    expect(out).toContain("(none)");
    expect(out).not.toContain("GARDENING_PLACEHOLDER");
  });

  it("buildSpecAnalysis includes research when provided", () => {
    const analysis = buildSpecAnalysis({
      pkgId: "PKG-039",
      files: ["a.ts"],
      deps: ["PKG-014"],
      devFreedom: "gardening",
      researchEnabled: true,
      researchMarkdown: "## 🔍 Research (5s, 1 results)",
    });
    expect(analysis.pkgId).toBe("PKG-039");
    expect(analysis.research?.markdown).toContain("🔍 Research");
    expect(analysis.updatedAt).toBeGreaterThan(0);
  });

  it("validatePhaseOutput fails when required file missing", () => {
    const path = "/logs/spec-analysis.json";
    const result = validatePhaseOutput(1, {
      logsDir: "/nonexistent",
      pkgId: "PKG-039",
      specAnalysisPath: path,
      fileContents: {},
    });
    expect(result.ok).toBe(false);
    expect(result.phaseName).toContain("Phase 1");
  });

  it("validatePhaseOutput passes when spec-analysis.json exists and non-empty", () => {
    const path = "/logs/spec-analysis.json";
    const result = validatePhaseOutput(1, {
      logsDir: "/logs",
      pkgId: "PKG-039",
      specAnalysisPath: path,
      fileContents: { [path]: '{"pkgId":"PKG-039"}' },
    });
    expect(result.ok).toBe(true);
  });
});
