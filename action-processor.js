#!/usr/bin/env node
/**
 * noema-action-processor.js — JSONL action queue feldolgozó
 * 
 * 10 percenként fut (systemd timer). Kezeli a teljes lifecycle-t:
 * 
 * Státusz flow:
 *   proposed     → (user klikk) → queued → (processor) → processing → (Alfred) → done
 *   pending      → (processor)  → processing → done
 *   failed       → (processor retry, max 3x) → dead
 * 
 * Takarítás: done entry-k 24h után törlődnek.
 *            dead entry-k 7 nap után törlődnek.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(process.env.HOME || '/home/promi', '.openclaw', 'workspace');
const ACTION_FILE = path.join(WORKSPACE, 'memory', 'state', 'noema-actions.jsonl');
const GATEWAY_HOST = '127.0.0.1';
const GATEWAY_PORT = 18789;
const MAX_RETRIES = 3;
const DONE_TTL_MS = 24 * 60 * 60 * 1000;   // 24 óra
const DEAD_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 nap

const ACTION_EMOJI = {
  implement: '🛠️', done: '✅', escalate: '🔥', restart: '🔄',
  trigger: '⚡', investigate: '🔍', activate: '▶️', paid: '💰'
};

// ── Helpers -----------------------------------------------------------------
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
  fs.writeFileSync(ACTION_FILE, entries.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
}

function nowISO() { return new Date().toISOString(); }

function getToken() {
  if (process.env.OPENCLAW_GATEWAY_TOKEN) return process.env.OPENCLAW_GATEWAY_TOKEN;
  try {
    const config = JSON.parse(fs.readFileSync(
      path.join(process.env.HOME || '/home/promi', '.openclaw', 'openclaw.json'), 'utf-8'));
    return config?.gateway?.auth?.token || null;
  } catch (e) { return null; }
}

function gatewayInvoke(tool, args) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    if (!token) return reject(new Error('No gateway token'));

    const payload = JSON.stringify({ tool, args });

    const req = https.request({
      hostname: GATEWAY_HOST, port: GATEWAY_PORT,
      path: '/tools/invoke', method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 202) resolve(true);
        else reject(new Error(`Gateway ${res.statusCode}: ${body.substring(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

function notifyAlfred(message) {
  // Write to Alfred's inbox — guaranteed delivery, zero deadlock risk.
  // Alfred picks it up during session startup hooks + periodic inbox checks.
  const INBOX_FILE = path.join(WORKSPACE, 'memory', 'state', 'alfred-inbox.jsonl');
  const dir = path.dirname(INBOX_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(INBOX_FILE, JSON.stringify({
    ts: nowISO(), source: 'noema-processor', message, read: false
  }) + '\n', 'utf-8');
  console.log('   📥 Inbox: írva');
  return Promise.resolve(true);
}

// ── Main --------------------------------------------------------------------
async function processActions() {
  let entries = readEntries();
  if (!entries.length) {
    console.log('📭 Üres queue');
    return;
  }

  const now = Date.now();
  let cleaned = 0;

  // 1. Clean up old entries
  entries = entries.filter(e => {
    if (e.status === 'done' && e.updatedAt) {
      const age = now - new Date(e.updatedAt).getTime();
      if (age > DONE_TTL_MS) { console.log(`🧹 ${e.id}: done >24h, törölve`); cleaned++; return false; }
    }
    if (e.status === 'dead' && e.updatedAt) {
      const age = now - new Date(e.updatedAt).getTime();
      if (age > DEAD_TTL_MS) { console.log(`🧹 ${e.id}: dead >7d, törölve`); cleaned++; return false; }
    }
    // Also clean dead entries without updatedAt (orphans, keep 3d)
    if (e.status === 'dead' && !e.updatedAt) {
      const age = now - new Date(e.ts || 0).getTime();
      if (age > 3 * 24 * 60 * 60 * 1000) { console.log(`🧹 ${e.id}: dead orphan >3d, törölve`); cleaned++; return false; }
    }
    return true;
  });
  if (cleaned) writeEntries(entries);

  // 2. Find processable entries: pending, queued, OR failed (with retries left)
  const processable = entries.filter(e => 
    e.status === 'pending' || e.status === 'queued' ||
    (e.status === 'failed' && (e.retries || 0) < MAX_RETRIES)
  );
  if (!processable.length) {
    console.log('📭 Nincs feldolgozandó action');
    return;
  }

  console.log(`📋 ${processable.length} action feldolgozása (${nowISO()})...`);

  let sent = 0, failed = 0;

  for (const entry of processable) {
    const emoji = ACTION_EMOJI[entry.action] || '📌';
    const msg = `${emoji} noema ${entry.action} ${entry.id}\n${entry.description || ''}`;
    const retryInfo = entry.status === 'failed' ? ` [retry ${(entry.retries || 0) + 1}/${MAX_RETRIES}]` : '';

    console.log(`  ➤ ${entry.action} ${entry.id} (${entry.status})${retryInfo}...`);

    try {
      await notifyAlfred(msg);
      entry.status = 'processing';
      entry.sentAt = nowISO();
      entry.updatedAt = nowISO();
      sent++;
      console.log(`  ✅ ${entry.id}: → processing`);
    } catch (e) {
      entry.retries = (entry.retries || 0) + 1;
      entry.lastError = e.message;
      entry.updatedAt = nowISO();
      if (entry.retries >= MAX_RETRIES) {
        entry.status = 'dead';
        console.log(`  💀 ${entry.id}: dead (${entry.retries}x hiba): ${e.message}`);
      } else {
        entry.status = 'failed';
        console.log(`  ❌ ${entry.id}: failed (${entry.retries}/${MAX_RETRIES}): ${e.message}`);
      }
      failed++;
    }
  }

  writeEntries(entries);
  console.log(`✅ Kész: ${sent} küldve, ${failed} hiba, ${entries.length} a queue-ban`);
}

processActions().catch(e => {
  console.error('💥 Váratlan hiba:', e.message);
  process.exit(1);
});
