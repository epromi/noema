#!/usr/bin/env node
/**
 * Post-build integrity gate — fails the pipeline if Vite produced a broken manifest.
 * Usage: node scripts/verify-build.cjs [buildDir]
 */
const fs = require("fs");
const path = require("path");

const BUILD_DIR = path.resolve(process.argv[2] || path.join(__dirname, "..", "build"));
const SERVER_CHUNKS = path.join(BUILD_DIR, "server", "chunks");
const ENTRY = path.join(BUILD_DIR, "index.js");
const CLIENT_DIR = path.join(BUILD_DIR, "client");

const DYNAMIC_IMPORT =
  /import\s*\(\s*['"]\.\/([^'"]+\.js(?:-[A-Za-z0-9_-]+)?\.js)['"]\s*\)/g;
const STATIC_IMPORT = /from\s+['"]\.\/([^'"]+\.js(?:-[A-Za-z0-9_-]+)?\.js)['"]/g;
const INDEX_CHUNK_IMPORT =
  /from\s+['"]\.\/server\/chunks\/([^'"]+\.js(?:-[A-Za-z0-9_-]+)?\.js)['"]/g;
const CLIENT_ASSET = /["'](_app\/[^"']+\.js)["']/g;

/** @param {string} source */
function extractChunkRefs(source) {
  const refs = new Set();
  for (const pattern of [DYNAMIC_IMPORT, STATIC_IMPORT, INDEX_CHUNK_IMPORT]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      refs.add(match[1]);
    }
  }
  return [...refs];
}

/** @param {string} source */
function extractClientAssets(source) {
  const refs = new Set();
  CLIENT_ASSET.lastIndex = 0;
  let match;
  while ((match = CLIENT_ASSET.exec(source)) !== null) {
    refs.add(match[1]);
  }
  return [...refs];
}

/** @param {string} chunksDir */
function findManifestFiles(chunksDir) {
  if (!fs.existsSync(chunksDir)) return [];
  return fs.readdirSync(chunksDir).filter(
    (name) =>
      name.startsWith("manifest.js") &&
      name.endsWith(".js") &&
      !name.endsWith(".js.map"),
  );
}

const errors = [];

if (!fs.existsSync(ENTRY)) {
  errors.push("❌ build/index.js not found");
}

if (!fs.existsSync(CLIENT_DIR)) {
  errors.push("❌ build/client/ not found");
}

if (!fs.existsSync(SERVER_CHUNKS)) {
  errors.push("❌ build/server/chunks/ not found");
}

const manifestFiles = findManifestFiles(SERVER_CHUNKS);
if (manifestFiles.length === 0) {
  errors.push("❌ server/chunks/manifest.js* not found");
}

/** @type {Array<{ baseDir: string, relPath: string }>} */
const scanTargets = [];
if (fs.existsSync(ENTRY)) {
  scanTargets.push({ baseDir: BUILD_DIR, relPath: "index.js" });
}
for (const name of manifestFiles) {
  scanTargets.push({ baseDir: SERVER_CHUNKS, relPath: name });
}

for (const { baseDir, relPath } of scanTargets) {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, "utf-8");

  for (const ref of extractChunkRefs(content)) {
    const chunkPath = path.join(SERVER_CHUNKS, ref);
    if (!fs.existsSync(chunkPath)) {
      errors.push(`❌ Chunk missing: ${ref} (referenced in ${relPath})`);
    }
  }

  if (relPath.startsWith("manifest")) {
    for (const asset of extractClientAssets(content)) {
      const assetPath = path.join(CLIENT_DIR, asset);
      if (!fs.existsSync(assetPath)) {
        errors.push(`❌ Client asset missing: ${asset} (referenced in manifest)`);
      }
    }
  }
}

if (fs.existsSync(CLIENT_DIR)) {
  const entryDir = path.join(CLIENT_DIR, "_app", "immutable", "entry");
  const hasEntry =
    fs.existsSync(entryDir) &&
    fs.readdirSync(entryDir).some((name) => name.endsWith(".js") && !name.endsWith(".js.map"));
  if (!hasEntry) {
    errors.push("❌ No client entry JS in build/client/_app/immutable/entry/");
  }
}

if (errors.length > 0) {
  console.error("🚨 BUILD INTEGRITY CHECK FAILED:");
  for (const err of errors) console.error("  " + err);
  process.exit(1);
}

console.log("✅ Build integrity check passed");
process.exit(0);
