import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  SSR_FAILURE_THRESHOLD,
  checkSsrHealth,
  evaluateSsrResponse,
  extractChunkReferences,
  extractClientAssetReferences,
  findManifestFiles,
  getBuildIntegrity,
  getSsrOrigin,
  recordSsrCheckResult,
  resetSsrFailureCounter,
  verifyBuildArtifacts,
} from "$lib/core/build-integrity";

describe("build-integrity", () => {
  beforeEach(() => {
    resetSsrFailureCounter();
  });

  it("extractChunkReferences finds dynamic and static imports", () => {
    const source = `
      import { x } from './nodes/0.js-B7k3jrgl.js';
      const load = () => import('./entries/endpoints/api/action/_server.ts.js-C5eal-bE.js');
    `;
    expect(extractChunkReferences(source).sort()).toEqual(
      [
        "nodes/0.js-B7k3jrgl.js",
        "entries/endpoints/api/action/_server.ts.js-C5eal-bE.js",
      ].sort(),
    );
  });

  it("extractClientAssetReferences finds _app paths", () => {
    const source =
      'start:"_app/immutable/entry/start.Bk8tc2m0.js",app:"_app/immutable/entry/app.S3qQhBMQ.js"';
    expect(extractClientAssetReferences(source)).toEqual([
      "_app/immutable/entry/start.Bk8tc2m0.js",
      "_app/immutable/entry/app.S3qQhBMQ.js",
    ]);
  });

  it("evaluateSsrResponse rejects bad status, short body, and non-html", () => {
    expect(evaluateSsrResponse(500, "<html>x</html>")).toEqual({
      ok: false,
      error: "SSR returned 500",
    });
    expect(evaluateSsrResponse(200, "tiny")).toEqual({
      ok: false,
      error: "SSR returned too little content (4 bytes)",
    });
    expect(evaluateSsrResponse(200, "x".repeat(600))).toEqual({
      ok: false,
      error: "SSR output does not look like HTML",
    });
  });

  it("evaluateSsrResponse accepts valid HTML responses", () => {
    const html = `<!doctype html><html><body>${"x".repeat(600)}</body></html>`;
    expect(evaluateSsrResponse(200, html)).toEqual({
      ok: true,
      bytes: html.length,
    });
  });

  it("recordSsrCheckResult tracks consecutive failures and resets on success", () => {
    expect(recordSsrCheckResult(false)).toBe(1);
    expect(recordSsrCheckResult(false)).toBe(2);
    expect(recordSsrCheckResult(true)).toBe(0);
  });

  it("getBuildIntegrity sets alert after threshold failures", async () => {
    const fetchFn = vi.fn(async () => ({
      status: 500,
      text: async () => "<html>" + "x".repeat(600) + "</html>",
    })) as unknown as typeof fetch;

    for (let i = 0; i < SSR_FAILURE_THRESHOLD - 1; i++) {
      const data = await getBuildIntegrity(fetchFn, "http://127.0.0.1:8080");
      expect(data.alert).toBe(false);
      expect(data.consecutiveFailures).toBe(i + 1);
    }

    const alertData = await getBuildIntegrity(fetchFn, "http://127.0.0.1:8080");
    expect(alertData.alert).toBe(true);
    expect(alertData.consecutiveFailures).toBe(SSR_FAILURE_THRESHOLD);
    expect(alertData.lastError).toBe("SSR returned 500");
  });

  it("checkSsrHealth surfaces network errors", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch;

    const result = await checkSsrHealth("http://127.0.0.1:9", fetchFn);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("connection refused");
  });

  it("verifyBuildArtifacts passes for a minimal valid build tree", () => {
    const root = mkdtempSync(join(tmpdir(), "noema-build-"));
    try {
      const chunks = join(root, "server", "chunks");
      const nodes = join(chunks, "nodes");
      const clientEntry = join(root, "client", "_app", "immutable", "entry");
      mkdirSync(nodes, { recursive: true });
      mkdirSync(clientEntry, { recursive: true });

      writeFileSync(join(root, "index.js"), "import './server/chunks/manifest.js-abc.js';");
      writeFileSync(
        join(chunks, "manifest.js-abc.js"),
        "import('./nodes/0.js-deadbeef.js'); \"_app/immutable/entry/start.js\"",
      );
      writeFileSync(join(nodes, "0.js-deadbeef.js"), "export {};");
      writeFileSync(join(clientEntry, "start.js"), "console.log('ok');");

      const result = verifyBuildArtifacts(root);
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(findManifestFiles(chunks)).toEqual(["manifest.js-abc.js"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("verifyBuildArtifacts reports missing manifest chunks", () => {
    const root = mkdtempSync(join(tmpdir(), "noema-build-"));
    try {
      const chunks = join(root, "server", "chunks");
      const clientEntry = join(root, "client", "_app", "immutable", "entry");
      mkdirSync(chunks, { recursive: true });
      mkdirSync(clientEntry, { recursive: true });

      writeFileSync(join(root, "index.js"), "// entry");
      writeFileSync(
        join(chunks, "manifest.js-broken.js"),
        "import('./nodes/missing.js-abc123.js');",
      );
      writeFileSync(join(clientEntry, "start.js"), "export {};");

      const result = verifyBuildArtifacts(root);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes("missing.js-abc123.js"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("getSsrOrigin prefers ORIGIN then PORT", () => {
    const originalOrigin = process.env.ORIGIN;
    const originalPort = process.env.PORT;
    process.env.ORIGIN = "https://alfred.local/";
    delete process.env.PORT;
    expect(getSsrOrigin()).toBe("https://alfred.local");
    delete process.env.ORIGIN;
    process.env.PORT = "3000";
    expect(getSsrOrigin()).toBe("http://127.0.0.1:3000");
    if (originalOrigin === undefined) delete process.env.ORIGIN;
    else process.env.ORIGIN = originalOrigin;
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
  });
});
