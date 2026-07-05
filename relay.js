#!/usr/bin/env node
/**
 * noema-relay.js — Dashboard → unified JSONL action queue + static file server
 * 
 * HTTP server localhost:18998-on. A dashboard böngészőből POST-ol ÉS innen is szolgáljuk ki.
 * 
 * Endpointok:
 *   GET  /              — Dashboard v4 HTML kiszolgálása (fixes file:// CORS issue)
 *   GET  /health        — Health check
 *   POST /action        — Új action append VAGY proposed→queued update
 *   POST /action/update — Létező entry státusz update
 * 
 * Entry státuszok:
 *   proposed → queued → processing → done | failed
 *   pending  → processing → done | failed
 *   failed   → (processor retry) → processing | dead
 * 
 * A Dashboard Research cron ÍRJA a proposed entry-ket,
 * a dashboard gombok UPDATE-lik (queued), a processor küldi (processing),
 * Alfred implementálja → done.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const RELAY_PORT = 18998;
const WORKSPACE = path.join(process.env.HOME || '/home/promi', '.openclaw', 'workspace');
const ACTION_FILE = path.join(WORKSPACE, 'memory', 'state', 'noema-actions.jsonl');
const DASHBOARD_FILE = path.join(WORKSPACE, 'projects', 'dashboard', 'dashboard-live.html');

// ── File I/O ---------------------------------------------------------------
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

function mimeType(ext) {
  const map = { '.html':'text/html; charset=utf-8', '.js':'application/javascript',
    '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };
  return map[ext] || 'application/octet-stream';
}

// ── Server -----------------------------------------------------------------
const server = http.createServer((req, res) => {
  // ── GET / — Serve dashboard HTML (fixes file:// CORS issue) ──
  if (req.method === 'GET' && (req.url === '/' || req.url === '/dashboard')) {
    try {
      const html = fs.readFileSync(DASHBOARD_FILE, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Dashboard not found. Run: node projects/dashboard/generate-v4.js');
    }
  }

  // ── GET /health ──
  if (req.method === 'GET' && req.url === '/health') {
    const exists = fs.existsSync(ACTION_FILE);
    const entries = exists ? readEntries() : [];
    const pending = entries.filter(e => e.status === 'pending' || e.status === 'queued').length;
    const failed = entries.filter(e => e.status === 'failed' || e.status === 'dead').length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok', uptime: process.uptime(),
      queue: { total: entries.length, pending, failed },
      dashboard: fs.existsSync(DASHBOARD_FILE)
    }));
  }

  // ── OPTIONS (CORS preflight) ──
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // ── Collect body for POST/PATCH ──
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    let body = {};
    if (req.method === 'POST' || req.method === 'PATCH') {
      try { 
        const raw = Buffer.concat(chunks).toString();
        if (raw) body = JSON.parse(raw);
      } catch { 
        res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    }

    // ── POST /action — Create new OR transition proposed→queued ──
    if (req.method === 'POST' && req.url === '/action') {
      const { action, id, description } = body;
      if (!action || !id) {
        res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Missing action or id' }));
      }

      const entries = readEntries();
      const existing = entries.find(e => e.id === id);

      if (existing) {
        if (existing.status === 'proposed') {
          // User clicking "▶ Mehet" on a proposed item
          existing.status = 'queued';
          existing.updatedAt = nowISO();
          writeEntries(entries);
          console.log(`✅ ${id}: proposed → queued`);
          res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: true, id, status: 'queued' }));
        } else if (existing.status === 'dead') {
          // Allow re-creating dead entries
          entries.splice(entries.indexOf(existing), 1);
          entries.push({ id, action, description: (description || '').substring(0, 200), status: 'pending', ts: nowISO(), updatedAt: nowISO() });
          writeEntries(entries);
          console.log(`♻️ ${id}: dead → pending (recreated)`);
          res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: true, id, status: 'pending' }));
        } else {
          // Already exists and active — skip
          console.log(`⏭️ ${id}: már ${existing.status}, skip`);
          res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: true, id, status: existing.status, skipped: true }));
        }
      }

      // New entry
      const ts = nowISO();
      const newEntry = { id, action, description: (description || '').substring(0, 200), status: 'pending', ts, updatedAt: ts };
      entries.push(newEntry);
      writeEntries(entries);
      console.log(`📝 ${action} ${id} → pending`);
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, id, status: 'pending' }));
    }

    // ── POST /action/update — External status update (Alfred marks done, etc.) ──
    if ((req.method === 'PATCH' || req.method === 'POST') && req.url === '/action/update') {
      const { id, status } = body;
      if (!id || !status) {
        res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Missing id or status' }));
      }

      const entries = readEntries();
      const entry = entries.find(e => e.id === id);
      if (entry) {
        entry.status = status;
        entry.updatedAt = nowISO();
        writeEntries(entries);
        console.log(`🔄 ${id}: → ${status}`);
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, id, status }));
      }

      res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: `Entry ${id} not found` }));
    }

    // ── 404 ──
    res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Use GET / GET /health POST /action POST /action/update' }));
  });
});

server.listen(RELAY_PORT, '127.0.0.1', () => {
  console.log(`📝 Dashboard Relay v2: http://127.0.0.1:${RELAY_PORT}`);
  console.log(`   Dashboard: http://127.0.0.1:${RELAY_PORT}/`);
  console.log(`   Health:    http://127.0.0.1:${RELAY_PORT}/health`);
  console.log(`   Queue:     ${ACTION_FILE}`);
});
