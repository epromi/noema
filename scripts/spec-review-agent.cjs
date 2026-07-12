#!/usr/bin/env node
/**
 * Noema Spec Review Agent — Phase 0 of development pipeline
 * 
 * Validates, reviews, and auto-fixes PKG specs before Cursor implementation.
 * Loops until clean (max 5 rounds), escalating if issues persist.
 * 
 * Usage: node scripts/spec-review-agent.cjs <PKG-ID>
 * Exit: 0 = clean, 1 = issues remain after 5 rounds (escalate)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PKG_ID = process.argv[2];

if (!PKG_ID) {
  console.error('Usage: node spec-review-agent.cjs <PKG-ID>');
  process.exit(2);
}

const MAX_ROUNDS = 5;
const PKGDIR = path.join(ROOT, 'dev/packages');
const pkgDir = fs.readdirSync(PKGDIR).find(d => d.startsWith(PKG_ID));
const SPEC_FILE = pkgDir ? path.join(PKGDIR, pkgDir, 'spec.md') : null;
const INDEX_FILE = path.join(PKGDIR, 'INDEX.md');
const CONTRIBUTING = path.join(ROOT, 'CONTRIBUTING.md');

// ── Rule definitions ──

const PHASE_LIMITS = { S: 4, M: 5, L: 7 };
const REQUIRED_SECTIONS = [
  '🎯 Mit',
  '📐 Scope',
  'Mit érint',
  'Mit NEM érint',
  'Fázisok',
  '✅ Acceptance Criteria'
];
const ALLOWED_SIZES = ['S', 'M', 'L'];
const CORE_MODULES = [
  'crons', 'agents', 'health', 'h1', 'noema', 'research',
  'bills', 'calendar', 'dev-loop-log'
];

/**
 * Run all checks. Returns array of {severity, field, message, fixable, autoFix}
 */
function runChecks(spec, indexData) {
  const issues = [];
  const pkgId = PKG_ID;

  // 1. Required sections
  for (const sec of REQUIRED_SECTIONS) {
    if (!spec.includes(sec)) {
      issues.push({
        severity: 'error',
        field: 'structure',
        message: `Missing required section: ${sec}`,
        fixable: true,
        autoFix: 'add-section',
        section: sec
      });
    }
  }

  // 2. Size declaration
  const sizeMatch = spec.match(/\*\*Size:\*\*\s*([SML])/);
  const size = sizeMatch ? sizeMatch[1] : null;
  if (!size) {
    issues.push({
      severity: 'error',
      field: 'metadata',
      message: 'Missing Size declaration (**Size:** S|M|L)',
      fixable: false
    });
  } else if (!ALLOWED_SIZES.includes(size)) {
    issues.push({
      severity: 'error',
      field: 'metadata',
      message: `Invalid size: ${size}. Must be S, M, or L`,
      fixable: false
    });
  }

  // 3. Phase count
  const phases = (spec.match(/^\| \*\*Phase \d+\*\*/gm) || []).length;
  const maxPhases = PHASE_LIMITS[size] || 7;
  if (phases > maxPhases) {
    issues.push({
      severity: 'error',
      field: 'phases',
      message: `Phase count violation: ${size}-size but ${phases} phases (max ${maxPhases})`,
      fixable: false,
      hint: 'Merge phases or reclassify as larger size'
    });
  }
  if (phases === 0 && size !== 'S') {
    issues.push({
      severity: 'warning',
      field: 'phases',
      message: 'No phases defined',
      fixable: false
    });
  }

  // 4. Dependency check
  const depsMatch = spec.match(/\*\*Depends on:\*\*\s*(.+)/);
  const deps = depsMatch ? depsMatch[1] : '';
  const depPkgs = [...deps.matchAll(/PKG-(\d+)/g)].map(m => `PKG-${m[1]}`);

  // Check if all listed dependency PKGs have spec files
  const allPkgDirs = fs.readdirSync(PKGDIR).filter(d => d.match(/^PKG-\d{3}/));
  for (const dp of depPkgs) {
    if (!allPkgDirs.some(d => d.startsWith(dp))) {
      issues.push({
        severity: 'warning',
        field: 'dependencies',
        message: `References non-existent package: ${dp}`,
        fixable: false
      });
    }
    // Check circular dependency
    if (dp === pkgId) {
      issues.push({
        severity: 'error',
        field: 'dependencies',
        message: `Self-referential dependency: ${dp}`,
        fixable: false
      });
    }
  }

  // 5. Scope correctness — check for wrong target
  const scopeSection = spec.match(/### Mit érint\n([\s\S]*?)(?=\n###)/);
  if (scopeSection) {
    const scopeFiles = [...scopeSection[1].matchAll(/`([^`]+)`/g)].map(m => m[1]);
    const legacyTargets = ['generate.cjs', 'relay.cjs'];
    const svelteTargets = ['src/lib/', 'src/routes/', '$lib/'];

    const hasLegacy = scopeFiles.some(f => legacyTargets.includes(f) || f.endsWith('.html'));
    const hasSvelte = scopeFiles.some(f => svelteTargets.some(t => f.startsWith(t)));

    if (hasSvelte && hasLegacy) {
      issues.push({
        severity: 'warning',
        field: 'scope',
        message: 'Mixed legacy + SvelteKit targets — is this intentional?',
        fixable: false,
        hint: 'Most packages should target one or the other, not both'
      });
    }
  }

  // 6. Not-scope section
  const notScopeSection = spec.match(/### Mit NEM érint\n([\s\S]*?)(?=\n###|$)/);
  if (!notScopeSection) {
    issues.push({
      severity: 'warning',
      field: 'scope',
      message: 'Missing "Mit NEM érint" section — helps prevent scope creep',
      fixable: true,
      autoFix: 'add-not-scope',
      placeholder: '- `generate.cjs` — semmi (legacy data pipeline)\n- `relay.cjs` — semmi (legacy relay)'
    });
  } else {
    const notScope = notScopeSection[1];
    // If legacy PKG, should mention it doesn't touch SvelteKit
    // If SvelteKit PKG, should mention it doesn't touch legacy
    const hasLegacyMention = notScope.includes('generate.cjs');
    if (!hasLegacyMention) {
      issues.push({
        severity: 'info',
        field: 'scope',
        message: 'Consider adding legacy files to "Mit NEM érint" for clarity',
        fixable: false
      });
    }
  }

  // 7. Acceptance criteria — at least 3 points
  const acSection = spec.match(/## ✅ Acceptance Criteria\n([\s\S]*?)(?=\n##|\n---|$)/);
  if (acSection) {
    const acItems = [...acSection[1].matchAll(/^\d+\./gm)];
    if (acItems.length < 3) {
      issues.push({
        severity: 'warning',
        field: 'acceptance',
        message: `Only ${acItems.length} acceptance criteria (recommend ≥3)`,
        fixable: false
      });
    }
  }

  // 8. Unique component file check (no overlap with other PKGs)
  const allSpecs = allPkgDirs
    .filter(d => d !== pkgDir)
    .map(d => {
      const s = path.join(PKGDIR, d, 'spec.md');
      return fs.existsSync(s) ? fs.readFileSync(s, 'utf8') : '';
    })
    .join('\n');

  const myComponents = [...spec.matchAll(/tabs\/(\w+\.svelte)/g)].map(m => m[1]);
  const otherComponents = [...allSpecs.matchAll(/tabs\/(\w+\.svelte)/g)].map(m => m[1]);
  const duplicates = myComponents.filter(c => otherComponents.includes(c));

  if (duplicates.length > 0) {
    issues.push({
      severity: 'error',
      field: 'scope',
      message: `Component overlap with other PKGs: ${duplicates.join(', ')}`,
      fixable: false,
      hint: 'Each tab component should be owned by exactly one PKG'
    });
  }

  // 9. Check if core data sources mentioned in Mit section actually exist
  const mitSection = spec.match(/\*\*Mit\*\*:\s*(.+)/);
  if (mitSection) {
    const mentionedModules = CORE_MODULES.filter(m => 
      spec.toLowerCase().includes(`${m}.ts`) || 
      spec.toLowerCase().includes(`get${m.charAt(0).toUpperCase() + m.slice(1)}`)
    );
    // This is an info check — just report what modules are referenced
    if (mentionedModules.length === 0) {
      issues.push({
        severity: 'info',
        field: 'data',
        message: 'No core module references found — does this PKG have a data source?',
        fixable: false
      });
    }
  }

  // 10. Depends on mentions PKG IDs that should be marked as prerequisites
  // Check if dep PKGs are done/absorbed or still need to be implemented
  for (const dp of depPkgs) {
    const dpDirs = allPkgDirs.filter(d => d.startsWith(dp));
    if (dpDirs.length > 0) {
      const dpSpec = path.join(PKGDIR, dpDirs[0], 'spec.md');
      if (fs.existsSync(dpSpec)) {
        // Check index for status of this dep
        if (indexData) {
          const dpStatus = indexData[dp] || '';
          const isReady = dpStatus.startsWith('✅') || dpStatus.startsWith('⏭️') || dpStatus.startsWith('❌');
          if (!isReady) {
            issues.push({
              severity: 'warning',
              field: 'dependencies',
              message: `Dependency ${dp} is not yet done (${dpStatus}) — should be completed first`,
              fixable: false,
              hint: 'Consider sequencing this PKG after the dependency'
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Auto-fix simple issues in the spec file
 */
function autoFix(spec, issues) {
  let fixed = spec;
  const fixes = issues.filter(i => i.fixable && i.autoFix);

  for (const issue of fixes) {
    if (issue.autoFix === 'add-section') {
      // Add missing section as an h2 with placeholder
      fixed += `\n\n## ${issue.section}\n\n_Placeholder — to be filled._\n`;
    }
    if (issue.autoFix === 'add-not-scope') {
      if (issue.placeholder) {
        fixed = fixed.replace(
          /(### Mit NEM érint\n)/,
          '$1' + issue.placeholder + '\n'
        );
      }
    }
  }

  return fixed;
}

/**
 * Parse INDEX.md to get package statuses
 */
function parseIndex() {
  if (!fs.existsSync(INDEX_FILE)) return {};
  const content = fs.readFileSync(INDEX_FILE, 'utf8');
  const statuses = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const m = line.match(/^\|\s*(PKG-\d{3})\s*\|[^|]*\|\s*(\S+)/);
    if (m) {
      statuses[m[1]] = m[2];
    }
  }
  return statuses;
}

/**
 * Format review report
 */
function formatReport(pkgId, round, issues) {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  let report = `\n## 🔍 Spec Review: ${pkgId} — Round ${round}/${MAX_ROUNDS}\n\n`;
  
  if (issues.length === 0) {
    report += `✅ **ALL CLEAR** — 0 issues found.\n`;
    return report;
  }

  report += `| Severity | Count |\n|----------|-------|\n`;
  if (errors.length) report += `| ❌ Error | ${errors.length} |\n`;
  if (warnings.length) report += `| ⚠️ Warning | ${warnings.length} |\n`;
  if (infos.length) report += `| ℹ️ Info | ${infos.length} |\n`;
  report += `\n`;

  for (const issue of [...errors, ...warnings, ...infos]) {
    const icon = { error: '❌', warning: '⚠️', info: 'ℹ️' }[issue.severity] || '•';
    report += `${icon} **${issue.field}**: ${issue.message}\n`;
    if (issue.hint) report += `   ↳ ${issue.hint}\n`;
  }

  return report;
}

// ── Main ──

console.log(`🔍 Spec Review Agent: ${PKG_ID}`);
console.log(`   Spec: ${SPEC_FILE || 'NOT FOUND'}`);
console.log(`   Max rounds: ${MAX_ROUNDS}`);
console.log();

if (!SPEC_FILE) {
  console.error(`❌ Spec file not found for ${PKG_ID}`);
  process.exit(1);
}

let originalSpec = fs.readFileSync(SPEC_FILE, 'utf8');
const indexData = parseIndex();
let allIssuesFixed = false;

for (let round = 1; round <= MAX_ROUNDS; round++) {
  const currentSpec = fs.readFileSync(SPEC_FILE, 'utf8');
  const issues = runChecks(currentSpec, indexData);
  
  console.log(formatReport(PKG_ID, round, issues));

  if (issues.length === 0) {
    allIssuesFixed = true;
    break;
  }

  // Only error-severity issues are blockers; warnings are informational
  const errors = issues.filter(i => i.severity === 'error');
  const fixable = issues.filter(i => i.fixable);

  if (errors.length === 0) {
    // No errors, only warnings/infos — pass with notes
    console.log(`ℹ️  Only warnings/infos remain — clean enough to proceed.\n`);
    allIssuesFixed = true;
    break;
  }

  if (fixable.length > 0) {
    console.log(`🔧 Auto-fixing ${fixable.length} issues...`);
    const fixed = autoFix(currentSpec, fixable);
    fs.writeFileSync(SPEC_FILE, fixed, 'utf8');
    console.log(`   Wrote fixed spec (${fixed.length} bytes)\n`);
  } else {
    console.log(`⚠️  ${errors.length} error(s) remain but none are auto-fixable.\n`);
    break;
  }
}

// ── Final result ──

if (allIssuesFixed) {
  console.log(`✅ ${PKG_ID} passed review — ready for ▶ Mehet.\n`);
  // Write pass stamp file
  const stampDir = path.join(ROOT, 'logs', 'reviews');
  fs.mkdirSync(stampDir, { recursive: true });
  fs.writeFileSync(
    path.join(stampDir, `${PKG_ID}-passed.txt`),
    new Date().toISOString() + ' — All checks passed\n'
  );
  process.exit(0);
}

const finalIssues = runChecks(fs.readFileSync(SPEC_FILE, 'utf8'), indexData);
const errCount = finalIssues.filter(i => i.severity === 'error').length;
const warnCount = finalIssues.filter(i => i.severity === 'warning').length;
const infoCount = finalIssues.filter(i => i.severity === 'info').length;

if (errCount === 0) {
  // Only warnings/infos remain — acceptable, proceed
  if (warnCount > 0 || infoCount > 0) {
    console.log(`✅ ${PKG_ID} passed with ${warnCount}⚠️ ${infoCount}ℹ️ — ready for ▶ Mehet.`);
    console.log(`   Non-critical issues found but none block implementation.`);
  }
  const stampDir = path.join(ROOT, 'logs', 'reviews');
  fs.mkdirSync(stampDir, { recursive: true });
  fs.writeFileSync(
    path.join(stampDir, `${PKG_ID}-passed.txt`),
    new Date().toISOString() + ` — Passed with ${warnCount} warnings, ${infoCount} infos\n`
  );
  process.exit(0);
}

console.log(`❌ ${PKG_ID} has ${errCount} unresolved errors after ${MAX_ROUNDS} rounds.`);
console.log(`📢 ESCALATE to András — manual review needed.\n`);

// Write fail stamp
const failStampDir = path.join(ROOT, 'logs', 'reviews');
fs.mkdirSync(failStampDir, { recursive: true });
fs.writeFileSync(
  path.join(failStampDir, `${PKG_ID}-failed.txt`),
  new Date().toISOString() + ` — ${errCount} errors after ${MAX_ROUNDS} rounds\n`
);
process.exit(1);
