// projects/noema/dev-loop.conf.ts — Noema Dashboard dev-loop configuration
import type { DevLoopConfig, DevLoopHooks, ReviewResult, SpecAnalysis, ValidationResult, ArchViolation } from "../../../.openclaw/plugins/dev-loop/src/types.js";
import { defaultAnalysis } from "../../../.openclaw/plugins/dev-loop/src/types.js";

export const config: DevLoopConfig = {
  name: "Noema Dashboard",
  repo: "epromi/noema",
  packagePrefix: "PKG-",
  projectRoot: __dirname,

  build: { command: "pnpm build", retryMax: 3 },
  test: { command: "pnpm test --reporter=verbose --coverage", coverageJson: "coverage/coverage-summary.json", threshold: 70 },
  lint: { command: "npx eslint --fix --quiet src/", maxIterations: 3 },
  format: { command: 'npx prettier --write "src/**/*.{ts,svelte,js,cjs}"' },

  testMapping: { "src/lib/core": "tests/core" },

  ci: {
    repo: "epromi/noema",
    autoFixFiles: ["generate.cjs", "relay.cjs", "action-processor.cjs"],
  },

  executionBackend: "subagent",
  cursorPromptTemplate: "prompts/cursor-implement.txt",
  implementModel: "deepseek/deepseek-v4-pro",
  timeout: 3600,

  features: {
    specReview: true,
    devFreedom: true,
    archCheck: true,
    postCommit: true,
    reviewAgent: false,
  },
};

export const hooks: DevLoopHooks = {
  async specReview(ctx) {
    try {
      await ctx.runCommand("node", [
        "--experimental-strip-types",
        "scripts/dev-freedom-helper.mjs",
        "spec-review", ctx.pkgId,
      ]);
      return { passed: true };
    } catch (err: any) {
      return { passed: false, error: err.message };
    }
  },

  async specAnalysis(ctx) {
    if (!ctx.config.features.devFreedom) return defaultAnalysis(ctx.specContent);
    try {
      const output = await ctx.runCommand("node", [
        "--experimental-strip-types",
        "scripts/dev-freedom-helper.mjs",
        "spec-analysis", ctx.specFile, ctx.pkgId, "/dev/stdout",
      ]);
      return JSON.parse(output);
    } catch {
      return defaultAnalysis(ctx.specContent);
    }
  },

  async research(ctx) {
    if (!ctx.config.features.devFreedom) return "";
    return await ctx.runCommand("node", [
      "--experimental-strip-types",
      "scripts/dev-freedom-helper.mjs",
      "research", ctx.specFile, `${ctx.packageDir}research-topics.md`,
    ]);
  },

  async strategy(ctx) {
    if (!ctx.config.features.devFreedom) return "Subagent implementation, standard strategy";
    return await ctx.runCommand("node", [
      "--experimental-strip-types",
      "scripts/dev-freedom-helper.mjs",
      "strategy", ctx.specFile, ctx.pkgId, ctx.analysis.size, "/dev/stdout",
    ]);
  },

  async generatePrompt(ctx) {
    return await ctx.runCommand("node", [
      "--experimental-strip-types",
      "scripts/dev-freedom-helper.mjs",
      "prompt",
      ctx.config.cursorPromptTemplate || "prompts/cursor-implement.txt",
      ctx.specFile, ctx.pkgId,
      ctx.analysis.size, ctx.analysis.effort,
    ]);
  },

  async validatePhase(ctx, phaseOutput) {
    try {
      await ctx.runCommand("node", [
        "--experimental-strip-types",
        "scripts/dev-freedom-helper.mjs",
        "validate", JSON.stringify(phaseOutput),
      ]);
      return { valid: true };
    } catch (err: any) {
      return { valid: false, issues: [err.message] };
    }
  },

  async archCheck(ctx, files) {
    const violations: ArchViolation[] = [];
    try {
      const { readFile } = await import("node:fs/promises");
      for (const f of files) {
        if (f.startsWith("src/lib/core/")) {
          const content = await readFile(`${ctx.projectRoot}/${f}`, "utf-8");
          if (/from ['"]svelte/.test(content)) {
            violations.push({ file: f, rule: "SVELTE_LEAK", severity: "critical" });
          }
        }
      }
    } catch { /* skip arch check on error */ }
    return violations;
  },

  async postCommit(ctx) {
    try {
      await ctx.runCommand("node", ["generate.cjs"]);
      ctx.log.info("Dashboard regenerated");
    } catch (err: any) {
      ctx.log.warn(`Dashboard regen failed: ${err.message}`);
    }
  },
};
