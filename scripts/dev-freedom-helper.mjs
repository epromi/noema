#!/usr/bin/env node
/**
 * Dev-loop helper for PKG-039 Developer Freedom (gardening + research + validation).
 * Usage: node --experimental-strip-types scripts/dev-freedom-helper.mjs <command> [args...]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDevFreedom,
  parseResearchEnabled,
  extractExpectedFiles,
  extractSpecDeps,
  extractSpecTitle,
  generateResearchQueries,
  formatResearchMarkdown,
  buildGardeningPromptSection,
  fillCursorPrompt,
  buildSpecAnalysis,
  validatePhaseOutput,
  summarizeSearchSnippet,
} from "../src/lib/core/dev-freedom.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");
const RESEARCH_TIMEOUT_MS = 60_000;

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function parseMetadata(specPath, pkgId) {
  const specText = readText(specPath);
  return {
    specText,
    pkgId,
    pkgName: extractSpecTitle(specText),
    devFreedom: parseDevFreedom(specText),
    researchEnabled: parseResearchEnabled(specText),
    expectedFiles: extractExpectedFiles(specText),
    deps: extractSpecDeps(specText),
  };
}

async function fetchDdgSnippet(query) {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "NoemaDevLoop/1.0" },
  });
  if (!res.ok) return "";
  const html = await res.text();
  const snippets = [...html.matchAll(/class="result-snippet"[^>]*>([^<]+)</gi)]
    .map((m) => m[1]?.trim())
    .filter(Boolean);
  if (snippets.length > 0) return snippets[0];
  const fallback = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return fallback.slice(0, 400);
}

async function runResearch(specPath, topicsPath) {
  const specText = readText(specPath);
  const topics = topicsPath && fs.existsSync(topicsPath) ? readText(topicsPath) : "";
  const queries = generateResearchQueries(specText, topics);
  const start = Date.now();
  const results = [];

  for (const query of queries) {
    if (Date.now() - start >= RESEARCH_TIMEOUT_MS) break;
    try {
      const snippet = await fetchDdgSnippet(query);
      results.push(summarizeSearchSnippet(query, snippet));
    } catch {
      results.push(
        summarizeSearchSnippet(query, "Search unavailable or timed out."),
      );
    }
  }

  const durationSec = Math.round((Date.now() - start) / 1000);
  return {
    markdown: formatResearchMarkdown(results, durationSec),
    durationSec,
    resultCount: results.length,
  };
}

function generatePrompt(templatePath, specPath, pkgId, pkgSize, pkgEffort, researchMd) {
  const meta = parseMetadata(specPath, pkgId);
  const template = readText(templatePath);
  const gardeningSection = buildGardeningPromptSection(meta.devFreedom);
  const researchSection =
    researchMd?.trim() ||
    (meta.researchEnabled ? "(research pending)" : "(none)");

  return fillCursorPrompt(template, {
    pkgId: meta.pkgId,
    pkgName: meta.pkgName,
    pkgSize,
    pkgEffort,
    expectedFiles: meta.expectedFiles,
    devFreedom: meta.devFreedom,
    gardeningSection,
    researchSection,
  });
}

function writeSpecAnalysisFile(outPath, specPath, pkgId, research) {
  const meta = parseMetadata(specPath, pkgId);
  const analysis = buildSpecAnalysis({
    pkgId,
    files: meta.expectedFiles,
    deps: meta.deps,
    devFreedom: meta.devFreedom,
    researchEnabled: meta.researchEnabled,
    researchMarkdown: research?.markdown,
    researchDurationSec: research?.durationSec,
    researchResultCount: research?.resultCount,
  });
  writeText(outPath, `${JSON.stringify(analysis, null, 2)}\n`);
  return analysis;
}

function validatePhase(phase, ctxPath) {
  const ctx = JSON.parse(readText(ctxPath));
  const fileContents = {};
  for (const [key, filePath] of Object.entries(ctx.paths ?? {})) {
    if (typeof filePath === "string" && fs.existsSync(filePath)) {
      fileContents[filePath] = readText(filePath);
    }
    if (key === "reviewLog" && typeof filePath === "string" && fs.existsSync(filePath)) {
      fileContents.reviewLog = readText(filePath);
    }
  }
  const result = validatePhaseOutput(Number(phase), { ...ctx, fileContents });
  if (!result.ok) {
    console.error(`❌ ${result.error ?? result.phaseName}`);
    process.exit(1);
  }
  console.log(`✅ ${result.phaseName} output valid`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "metadata": {
      const [specPath, pkgId] = args;
      const meta = parseMetadata(specPath, pkgId);
      console.log(JSON.stringify(meta, null, 2));
      break;
    }
    case "research": {
      const [specPath, topicsPath = ""] = args;
      const result = await runResearch(specPath, topicsPath || undefined);
      console.log(result.markdown);
      break;
    }
    case "spec-analysis": {
      const [specPath, pkgId, outPath, researchMdPath = ""] = args;
      let research;
      if (researchMdPath && fs.existsSync(researchMdPath)) {
        const md = readText(researchMdPath);
        research = {
          markdown: md,
          durationSec: 0,
          resultCount: (md.match(/### Query/g) ?? []).length,
        };
      }
      writeSpecAnalysisFile(outPath, specPath, pkgId, research);
      break;
    }
    case "prompt": {
      const [templatePath, specPath, pkgId, pkgSize, pkgEffort, outPath, researchMdPath = ""] = args;
      const researchMd =
        researchMdPath && fs.existsSync(researchMdPath)
          ? readText(researchMdPath)
          : "";
      const prompt = generatePrompt(
        templatePath,
        specPath,
        pkgId,
        pkgSize,
        pkgEffort,
        researchMd,
      );
      writeText(outPath, prompt);
      break;
    }
    case "strategy": {
      const [specPath, pkgId, pkgSize, outPath] = args;
      const meta = parseMetadata(specPath, pkgId);
      const body = [
        `# Strategy: ${pkgId}`,
        "",
        `- **Package**: ${meta.pkgName}`,
        `- **Size**: ${pkgSize}`,
        `- **DevFreedom**: ${meta.devFreedom}`,
        `- **Research**: ${meta.researchEnabled ? "yes" : "no"}`,
        `- **Executor**: Cursor agent`,
        `- **Expected files**: ${meta.expectedFiles.length}`,
        "",
      ].join("\n");
      writeText(outPath, body);
      break;
    }
    case "validate": {
      validatePhase(args[0], args[1]);
      break;
    }
    default:
      console.error(
        "Usage: dev-freedom-helper.mjs <metadata|research|spec-analysis|prompt|strategy|validate> ...",
      );
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
