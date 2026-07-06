#!/usr/bin/env node
/**
 * Noema Dashboard — Data Fetcher
 * 
 * Külön folyamatban gyűjti a Gateway adatokat és írja JSON fájlba.
 * Az SSR page ezt a JSON-t olvassa (azonnali betöltés).
 * Cron job percenként/5 percenként futtatja.
 * 
 * Usage: node scripts/dashboard-data-fetcher.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '..', 'data', 'dashboard-data.json');
const TIMEOUT_SEC = 25;

// Könyvtár biztosítása
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

function runGateway(func, ...args) {
  const cmd = `openclaw gateway tool invoke --tool ${func} ${args.join(' ')}`;
  try {
    const result = execSync(cmd, {
      timeout: TIMEOUT_SEC * 1000,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });
    return JSON.parse(result);
  } catch (err) {
    console.error(`❌ ${func}: ${err.message}`);
    return null;
  }
}

console.log(`🔄 Data fetch started at ${new Date().toISOString()}`);

const start = Date.now();

// All 13 modules in parallel... but execSync is sync, so sequential
// Use Promise.all with child_process.exec for true parallelism later
const data = {
  meta: { loadedAt: Date.now(), generated: true },
  crons: runGateway('noema_getCrons'),
  agents: runGateway('noema_getAgents'),
  health: runGateway('noema_getHealth'),
  h1: runGateway('noema_getH1Data'),
  calendar: runGateway('noema_getCalendar'),
  bills: runGateway('noema_getBills'),
  research: runGateway('noema_getResearch'),
  brainstorm: runGateway('noema_getBrainstorm'),
  noema: runGateway('noema_getNoema'),
  actionQueue: runGateway('noema_getActionQueue'),
  logs: runGateway('noema_getLogs'),
  auditTrail: runGateway('noema_getAuditTrail'),
  decisionTrace: runGateway('noema_getDecisionTrace'),
  devPackages: runGateway('noema_getDevPackages'),
};

// Write immediately even if partial
try {
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2));
  console.log(`✅ Data written to ${OUTPUT} in ${((Date.now() - start) / 1000).toFixed(1)}s`);
} catch (err) {
  console.error(`❌ Write failed: ${err.message}`);
  process.exit(1);
}
