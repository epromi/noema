#!/usr/bin/env node
/**
 * spawn-review-agent.js — Phase 5g: Spawn review sub-agent via Gateway API
 * 
 * A dev-loop.sh Phase 5 után hívja. Bemenet: PKG_ID, review log path.
 * 
 * A sub-agent:
 *   1. Olvassa a review log-ot
 *   2. Auto-fix: lint, format, missing tests, low coverage
 *   3. Ha a fix sikerül → re-run test + coverage
 *   4. Ha nem sikerül → Telegram értesítés Andrásnak részletes hibajelentéssel
 *   5. Végső státusz: mit fixált, mi maradt nyitva
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Config ─────────────────────────────────────────────────────────────────
const GATEWAY_HOST = process.env.OPENCLAW_GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = process.env.OPENCLAW_GATEWAY_PORT || 18789;
const WORKSPACE = path.join(os.homedir(), '.openclaw', 'workspace');
const NOEMA_DIR = path.join(WORKSPACE, 'projects', 'noema');

const PKG_ID = process.argv[2];
const REVIEW_LOG = process.argv[3];
const NOTIFY_TARGET = process.argv[4] || '8794234536';

if (!PKG_ID || !REVIEW_LOG) {
  console.error('Usage: spawn-review-agent.js <PKG_ID> <review_log_path> [telegram_target]');
  process.exit(1);
}

// ── Auth ───────────────────────────────────────────────────────────────────
function getToken() {
  if (process.env.OPENCLAW_GATEWAY_TOKEN) return process.env.OPENCLAW_GATEWAY_TOKEN;
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config?.gateway?.auth?.token || null;
  } catch { return null; }
}

function invokeTool(tool, args, sessionKey, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    if (!token) return reject(new Error('No gateway token'));

    const payload = JSON.stringify({ tool, args, sessionKey: sessionKey || 'agent:alfred:main' });

    const req = https.request({
      hostname: GATEWAY_HOST, port: GATEWAY_PORT, path: '/tools/invoke', method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: timeoutMs
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

// ── Read review log ────────────────────────────────────────────────────────
let reviewContent = '';
try { reviewContent = fs.readFileSync(REVIEW_LOG, 'utf-8'); } catch {
  reviewContent = '(review log not found)';
}

// Summary stats
const passCount = (reviewContent.match(/✅/g) || []).length;
const warnCount = (reviewContent.match(/⚠️/g) || []).length;
const failCount = (reviewContent.match(/❌/g) || []).length;

// Check what needs fixing
const needsLintFix = reviewContent.includes('Lint/formátum hibák') || reviewContent.includes('Lint/format issues persist');
const hasMissingTests = reviewContent.includes('core module(s) without test file');
const hasLowCoverage = reviewContent.includes('below') && reviewContent.includes('threshold');
const hasArchViolation = reviewContent.includes('ARCHITECTURE VIOLATIONS') || reviewContent.includes('SVELTE LEAK') || reviewContent.includes('SYSTEM CALL');
const hasSecrets = reviewContent.includes('Potential secrets');
const hasDangerousPatterns = reviewContent.includes('Dangerous patterns');

// ── Build sub-agent task ───────────────────────────────────────────────────
const taskPrompt = `## 🔍 AUTOMATIC REVIEW & FIX: ${PKG_ID}

**Context**: You are a review sub-agent spawned by the Noema dev-loop pipeline. Package ${PKG_ID} was just implemented by Cursor. The automated deep review found issues that need fixing.

**Review Log**: ${REVIEW_LOG}

**Summary**:
- ✅ Pass: ${passCount}
- ⚠️  Warnings: ${warnCount}  
- ❌ Failures: ${failCount}

${needsLintFix ? '- 🔧 LINT/FORMAT issues detected — auto-fixable' : ''}
${hasMissingTests ? '- 🔧 MISSING TEST FILES detected — partly auto-fixable' : ''}
${hasLowCoverage ? '- ⚠️  LOW COVERAGE — may need additional tests' : ''}
${hasArchViolation ? '- ⛔ ARCHITECTURE VIOLATIONS — needs manual review' : ''}
${hasSecrets ? '- 🚨 SECRETS IN CODE — needs immediate attention' : ''}
${hasDangerousPatterns ? '- ⚠️  DANGEROUS PATTERNS (eval, innerHTML) — review needed' : ''}

## YOUR TASK

### Phase 1: Auto-Fix (what you CAN fix automatically)
1. **Lint/Format**: Run \`cd ${NOEMA_DIR} && git pull --rebase && npx eslint --fix --quiet src/ && npx prettier --write "src/**/*.{ts,svelte,js,cjs}"\`
2. **Missing Tests**: For each core module without a test file, generate a basic test stub (NOT empty — include imports, describe block, at least one real test)
3. **Low Coverage**: Add additional test cases targeting untested branches
4. After fixes: run \`cd ${NOEMA_DIR} && pnpm test --coverage\` to verify
5. **Commit fixes**: \`cd ${NOEMA_DIR} && git add -A && git commit -m "🔧 Review fixes: ${PKG_ID} (lint+tests+coverage)" && git push\`

### Phase 2: Validation
1. Re-run: \`cd ${NOEMA_DIR} && npx eslint --quiet src/\`
2. Check ALL core files now have test files
3. Verify coverage is ≥70%

### Phase 3: Report
1. Send a Telegram message to ${NOTIFY_TARGET} with:
   - What was fixed (✅)
   - What could NOT be fixed (⚠️)
   - What needs MANUAL review (⛔)
2. Format: 
\`\`\`
🧠 Review completed: ${PKG_ID}
✅ Fixed: [list]
⚠️  Warnings (still present): [list]
⛔ Manual review needed: [list]
📊 Coverage: XX% → YY%
📋 Full log: logs/review-${PKG_ID}.log
\`\`\`

### CRITICAL RULES
- Use exec to run commands in ${NOEMA_DIR}
- Use message tool to send Telegram to ${NOTIFY_TARGET}
- DO NOT modify files outside ${NOEMA_DIR}/src/ and ${NOEMA_DIR}/tests/
- DO NOT rewrite already-passing code
- DO NOT modify existing test files that are already passing — only ADD new test files for missing coverage
- Only modify src/ files for lint/format fixes — don't change logic
- If auto-fix makes something worse, REVERT the fix
- MAX 5 minutes total — if you can't fix it in that time, report it as ⚠️
- ALWAYS send the final Telegram report, even if everything is clean

**Working directory**: ${NOEMA_DIR}
**Review log path**: ${REVIEW_LOG}`;

// ── Spawn sub-agent ────────────────────────────────────────────────────────
async function main() {
  console.log(`🧠 Spawning review agent for ${PKG_ID}...`);
  console.log(`   Pass: ${passCount} | ⚠️  ${warnCount} | ❌ ${failCount}`);
  console.log(`   Needs lint fix: ${needsLintFix}`);
  console.log(`   Missing tests: ${hasMissingTests}`);
  console.log(`   Low coverage: ${hasLowCoverage}`);
  console.log(`   Arch violations: ${hasArchViolation}`);

  if (warnCount === 0 && failCount === 0) {
    console.log('   → No issues detected — skipping review agent');
    process.exit(0);
  }

  try {
    const result = await invokeTool('sessions_spawn', {
      agentId: 'albert',
      task: taskPrompt,
      label: `review-${PKG_ID}`,
      mode: 'run',
      context: 'isolated',
      runTimeoutSeconds: 300
    });

    if (result?.body?.ok) {
      const data = typeof result.body.result.content[0].text === 'string'
        ? JSON.parse(result.body.result.content[0].text)
        : result.body.result;
      console.log(`✅ Review agent spawned: ${data?.childSessionKey || data?.status}`);
    } else {
      console.error('❌ Spawn failed:', JSON.stringify(result?.body?.error || result));
      
      // Fallback: send summary to Telegram directly
      console.log('   → Fallback: sending Telegram notification...');
      const summary = `🧠 Review needed: ${PKG_ID}\n✅ ${passCount} pass | ⚠️ ${warnCount} warn | ❌ ${failCount} fail\n📋 Log: ${REVIEW_LOG}`;
      await invokeTool('message', {
        action: 'send',
        channel: 'telegram',
        target: NOTIFY_TARGET,
        message: summary
      });
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Spawn error:', err.message);
    process.exit(1);
  }
}

main();
