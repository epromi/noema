import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import type { BuildIntegrityData } from "$lib/types";

export const SSR_FAILURE_THRESHOLD = 3;
export const SSR_MIN_BYTES = 500;
export const SSR_TIMEOUT_MS = 5000;

const DYNAMIC_IMPORT =
  /import\s*\(\s*['"]\.\/([^'"]+\.js(?:-[A-Za-z0-9_-]+)?\.js)['"]\s*\)/g;
const STATIC_IMPORT =
  /from\s+['"]\.\/([^'"]+\.js(?:-[A-Za-z0-9_-]+)?\.js)['"]/g;
const INDEX_CHUNK_IMPORT =
  /from\s+['"]\.\/server\/chunks\/([^'"]+\.js(?:-[A-Za-z0-9_-]+)?\.js)['"]/g;

/** Resolve dashboard SSR origin from environment (production default :8080). */
export function getSsrOrigin(): string {
  const fromEnv = process.env.ORIGIN ?? process.env.NOEMA_ORIGIN;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const port = process.env.PORT ?? "8080";
  return `http://127.0.0.1:${port}`;
}

/** Collect relative chunk paths referenced in a JS source file. */
export function extractChunkReferences(source: string): string[] {
  const refs = new Set<string>();
  for (const pattern of [DYNAMIC_IMPORT, STATIC_IMPORT, INDEX_CHUNK_IMPORT]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      if (match[1]) refs.add(match[1]);
    }
  }
  return [...refs];
}

/** Find hashed manifest module(s) under build/server/chunks. */
export function findManifestFiles(chunksDir: string): string[] {
  if (!existsSync(chunksDir)) return [];
  return readdirSync(chunksDir).filter(
    (name) =>
      name.startsWith("manifest.js") &&
      name.endsWith(".js") &&
      !name.endsWith(".js.map"),
  );
}

/** Extract client asset paths from manifest source (e.g. _app/immutable/...). */
export function extractClientAssetReferences(source: string): string[] {
  const refs = new Set<string>();
  const assetPattern = /["'](_app\/[^"']+\.js)["']/g;
  let match: RegExpExecArray | null;
  while ((match = assetPattern.exec(source)) !== null) {
    if (match[1]) refs.add(match[1]);
  }
  return [...refs];
}

export interface BuildArtifactVerification {
  ok: boolean;
  errors: string[];
}

/** Verify production build artifacts on disk (post-build gate).
 *  Also checks source freshness — fails if any src/ file is newer than build. */
export function verifyBuildArtifacts(
  buildDir = join(process.cwd(), "build"),
): BuildArtifactVerification {
  const errors: string[] = [];
  const entry = join(buildDir, "index.js");
  const clientDir = join(buildDir, "client");
  const serverChunksDir = join(buildDir, "server", "chunks");

  // ── Source freshness gate: fail if source changed since last build ──
  const srcDir = join(process.cwd(), "src");
  if (existsSync(srcDir) && existsSync(entry)) {
    const buildMtime = statSync(entry).mtimeMs;
    const staleFiles: string[] = [];

    function scanSourceDir(dir: string): void {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanSourceDir(full);
        } else if (
          /\.(ts|js|svelte|css)$/.test(entry.name) &&
          !entry.name.endsWith(".d.ts") &&
          !full.includes("node_modules")
        ) {
          if (statSync(full).mtimeMs > buildMtime) {
            staleFiles.push(relative(srcDir, full));
          }
        }
      }
    }

    scanSourceDir(srcDir);

    if (staleFiles.length > 0) {
      const preview = staleFiles.slice(0, 10).join(", ");
      const more =
        staleFiles.length > 10
          ? ` +${staleFiles.length - 10} more`
          : "";
      errors.push(
        `❌ Source files newer than build — build stale: ${preview}${more}. Re-run pnpm build.`,
      );
    }
  }

  // ── Artifact existence gates ──

  if (!existsSync(entry)) {
    errors.push("❌ build/index.js not found");
  }

  if (!existsSync(clientDir)) {
    errors.push("❌ build/client/ not found");
  }

  if (!existsSync(serverChunksDir)) {
    errors.push("❌ build/server/chunks/ not found");
  }

  const manifestFiles = findManifestFiles(serverChunksDir);
  if (manifestFiles.length === 0) {
    errors.push("❌ server/chunks/manifest.js* not found");
  }

  const filesToScan: Array<{ baseDir: string; relPath: string }> = [];

  if (existsSync(entry)) {
    filesToScan.push({
      baseDir: buildDir,
      relPath: "index.js",
    });
  }

  for (const manifestName of manifestFiles) {
    filesToScan.push({
      baseDir: serverChunksDir,
      relPath: manifestName,
    });
  }

  for (const { baseDir, relPath } of filesToScan) {
    const fullPath = join(baseDir, relPath);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf-8");
    const refs = extractChunkReferences(content);

    for (const ref of refs) {
      const resolved =
        relPath === "index.js"
          ? join(serverChunksDir, ref)
          : join(serverChunksDir, ref);

      if (!existsSync(resolved)) {
        errors.push(`❌ Chunk missing: ${ref} (referenced in ${relPath})`);
      }
    }

    if (relPath.startsWith("manifest")) {
      for (const asset of extractClientAssetReferences(content)) {
        const assetPath = join(clientDir, asset);
        if (!existsSync(assetPath)) {
          errors.push(
            `❌ Client asset missing: ${asset} (referenced in manifest)`,
          );
        }
      }
    }
  }

  if (existsSync(clientDir)) {
    const entryDir = join(clientDir, "_app", "immutable", "entry");
    const hasEntryJs =
      existsSync(entryDir) &&
      readdirSync(entryDir).some(
        (name) => name.endsWith(".js") && !name.endsWith(".js.map"),
      );
    if (!hasEntryJs) {
      errors.push(
        "❌ No client entry JS in build/client/_app/immutable/entry/",
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

export interface SsrEvaluation {
  ok: boolean;
  error?: string;
  bytes?: number;
}

/** Validate an SSR HTTP response body. */
export function evaluateSsrResponse(
  status: number,
  html: string,
): SsrEvaluation {
  if (status < 200 || status >= 300) {
    return { ok: false, error: `SSR returned ${status}` };
  }

  if (html.length < SSR_MIN_BYTES) {
    return {
      ok: false,
      error: `SSR returned too little content (${html.length} bytes)`,
    };
  }

  const lower = html.toLowerCase();
  if (!lower.includes("<!doctype html>") && !lower.includes("<html")) {
    return { ok: false, error: "SSR output does not look like HTML" };
  }

  return { ok: true, bytes: html.length };
}

let consecutiveSsrFailures = 0;

/** Reset SSR failure counter (tests). */
export function resetSsrFailureCounter(): void {
  consecutiveSsrFailures = 0;
}

/** Update consecutive failure counter from one SSR check result. */
export function recordSsrCheckResult(ok: boolean): number {
  if (ok) {
    consecutiveSsrFailures = 0;
  } else {
    consecutiveSsrFailures += 1;
  }
  return consecutiveSsrFailures;
}

/** Perform live SSR health probe against the running dashboard. */
export async function checkSsrHealth(
  origin = getSsrOrigin(),
  fetchFn: typeof fetch = fetch,
): Promise<SsrEvaluation> {
  try {
    const res = await fetchFn(`${origin}/`, {
      signal: AbortSignal.timeout(SSR_TIMEOUT_MS),
    });
    const html = await res.text();
    return evaluateSsrResponse(res.status, html);
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Collector-facing build integrity snapshot with alert after 3 failures. */
export async function getBuildIntegrity(
  fetchFn: typeof fetch = fetch,
  origin = getSsrOrigin(),
): Promise<BuildIntegrityData> {
  const result = await checkSsrHealth(origin, fetchFn);
  const failures = recordSsrCheckResult(result.ok);

  return {
    ok: result.ok,
    alert: failures >= SSR_FAILURE_THRESHOLD,
    consecutiveFailures: failures,
    lastCheckAt: Date.now(),
    bytes: result.bytes,
    lastError: result.ok ? undefined : result.error,
    updatedAt: Date.now(),
  };
}
