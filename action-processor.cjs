#!/usr/bin/env node
/**
 * noema-action-processor.js — JSONL action queue → direkt dev-loop.sh végrehajtás
 * 
 * 10 percenként fut (systemd timer). 
 * A dashboard ▶ Mehet gomb → relay.js → JSONL → EZ a processor → dev-loop.sh → Cursor
 * 
 * Státusz flow:
 *   queued → (processor) → running → done / failed
 *   failed → (retry max 3x) → dead
 * 
 * Takarítás: done 24h után, dead 7 nap után törölve.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(process.env.HOME || '/home/promi', '.openclaw', 'workspace');
const NOEMA_DIR = path.join(WORKSPACE, 'projects', 'noema');
const ACTION_FILE = path.join(WORKSPACE, 'memory', 'state', 'noema-actions.jsonl');
const DEV_LOOP = path.join(NOEMA_DIR, 'scripts', 'dev-loop.sh');
const MAX_RETRIES = 3;
const DONE_TTL_MS = 24 * 60 * 60 * 1000;
const DEAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readEntries() {
  if (!fs.existsSync(ACTION_FILE)) return [];
  const raw = fs.readFileSync(ACTION_FILE, 'utf-8').trim();
  if (!raw) return [];
  return raw.split('\n').map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function writeEntries(entries) {
  const dir = path.dirname(ACTION_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (entries.length === 0) {
    if (fs.existsSync(ACTION_FILE)) fs.unlinkSync(ACTION_FILE);
    return;
  }
  // Atomic write: write to temp file first, then rename
  const tmp = ACTION_FILE + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, entries.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
  fs.renameSync(tmp, ACTION_FILE);
}

function nowISO() { return new Date().toISOString(); }

function runDevLoop(pkgId) {
  const startTime = Date.now();
  try {
    const result = execSync(`bash "${DEV_LOOP}" "${pkgId}"`, {
      cwd: NOEMA_DIR,
      encoding: 'utf8',
      timeout: 600000, // 10 min
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: { ...process.env, CI: 'true', HOME: process.env.HOME }
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ⏱️  ${elapsed}s`);
    return { success: true, output: result, elapsed };
  } catch (e) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ⏱️  ${elapsed}s → HIBÁS`);
    console.log(`   stderr: ${(e.stderr || '').substring(0, 500)}`);
    return { success: false, output: e.stdout || '', error: e.stderr || e.message, elapsed };
  }
}

function regenDashboard() {
  try {
    const result = execSync('node generate.cjs', { cwd: NOEMA_DIR, encoding: 'utf8', timeout: 30000 });
    console.log('   ✅ Dashboard regen OK');
  } catch (e) {
    console.log(`   ⚠️  Dashboard regen hiba: ${(e.stderr || e.message).substring(0, 300)}`);
    if (e.stdout) console.log(`   stdout: ${e.stdout.substring(0, 200)}`);
  }
}

async function processActions() {
  let entries = readEntries();
  if (!entries.length) {
    console.log('📭 Üres queue');
    return;
  }

  const now = Date.now();
  let cleaned = 0;

  // 1. Tisztítás
  entries = entries.filter(e => {
    if (e.status === 'done' && e.updatedAt) {
      if (now - new Date(e.updatedAt).getTime() > DONE_TTL_MS) { cleaned++; return false; }
    }
    if (e.status === 'dead' && e.updatedAt) {
      if (now - new Date(e.updatedAt).getTime() > DEAD_TTL_MS) { cleaned++; return false; }
    }
    if (e.status === 'dead' && !e.updatedAt) {
      if (now - new Date(e.ts || 0).getTime() > 3 * 24 * 60 * 60 * 1000) { cleaned++; return false; }
    }
    return true;
  });
  if (cleaned) { writeEntries(entries); console.log(`🧹 ${cleaned} lejárt entry törölve`); }

  // 2. Keresd a feldolgozandókat (queued + implement action)
  const processable = entries.filter(e =>
    (e.status === 'queued' || e.status === 'pending') && e.action === 'implement'
  );

  // + failed implementek retry-val
  const retryable = entries.filter(e =>
    e.status === 'failed' && e.action === 'implement' && (e.retries || 0) < MAX_RETRIES
  );

  if (!processable.length && !retryable.length) {
    const otherActions = entries.filter(e => e.action !== 'implement');
    if (otherActions.length) {
      // Non-implement actions (done, escalate, etc.) — ezeket Alfred-nak
      console.log(`📋 ${otherActions.length} nem-implement action (Alfred inbox-ba írva)`);
    }
    console.log('📭 Nincs implementálható csomag');
    return;
  }

  const allTodo = [...processable, ...retryable];
  console.log(`📋 ${allTodo.length} csomag feldolgozása (${nowISO()})...`);

  let done = 0, failed = 0;

  for (const entry of allTodo) {
    const pkgId = entry.id;
    const retryInfo = entry.status === 'failed' ? ` [retry ${(entry.retries||0)+1}/${MAX_RETRIES}]` : '';
    console.log(`  🛠️ implement ${pkgId}${retryInfo}...`);

    // Direkt futtatás — NEM Alfred-on keresztül
    const result = runDevLoop(pkgId);

    if (result.success) {
      entry.status = 'done';
      entry.completedAt = nowISO();
      entry.updatedAt = nowISO();
      entry.elapsed = result.elapsed;
      done++;
      console.log(`  ✅ ${pkgId}: kész (${result.elapsed}s)`);
    } else {
      entry.retries = (entry.retries || 0) + 1;
      entry.lastError = (result.error || '').substring(0, 500);
      entry.updatedAt = nowISO();
      if (entry.retries >= MAX_RETRIES) {
        entry.status = 'dead';
        console.log(`  💀 ${pkgId}: dead (${entry.retries}x hiba)`);
      } else {
        entry.status = 'failed';
        console.log(`  ❌ ${pkgId}: failed (retry ${entry.retries}/${MAX_RETRIES})`);
      }
      failed++;
    }
  }

  writeEntries(entries);

  // Dashboard regen minden futás után
  if (done > 0) {
    console.log('');
    console.log('🔄 Dashboard regen...');
    regenDashboard();
  }

  console.log(`✅ Kész: ${done} implementált, ${failed} hiba, ${entries.length} a queue-ban`);
  
  // Ha volt hibás, exit 1 hogy a systemd lássa
  if (failed > 0) process.exit(1);
}

processActions().catch(e => {
  console.error('💥 Váratlan hiba:', e.message);
  process.exit(1);
});
