#!/usr/bin/env node
// Dashboard v4 Generator — pure Node.js
// Run: node projects/dashboard/generate-v4.js
//       (or from Otto Compilation nightly)
'use strict';

const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const W = process.env.WORKSPACE || path.join(require('os').homedir(), '.openclaw/workspace');
const NOW = new Date().toISOString().replace('T',' ').slice(0,19) + ' ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
const HOSTNAME = require('os').hostname();

// ── Helpers ──
const j = JSON.stringify;
const read = (f) => { try { return fs.readFileSync(path.join(W,f),'utf8') } catch { return '' } };
const fSize = (f) => { try { return fs.statSync(path.join(W,f)).size } catch { return 0 } };
const exists = (f) => fs.existsSync(path.join(W,f));
const ageDays = (f) => {
  try { return Math.floor((Date.now() - fs.statSync(path.join(W,f)).mtimeMs) / 864e5) } catch { return 999 }
};
const staleLevel = (d) => d >= 14 ? 7 : d >= 7 ? 3 : 0;

// ── System ──
const uptime = execSync('uptime -p 2>/dev/null || echo "?"',{encoding:'utf8'}).trim().replace('up ','');
const disk = execSync("df -h / | awk 'NR==2{print $5\" used (\"$3\"/\"$2\")\"}' 2>/dev/null || echo '?'",{encoding:'utf8'}).trim();
const ram = execSync("free -h | awk 'NR==2{printf \"%s used / %s total\", $3, $2}' 2>/dev/null || echo '?'",{encoding:'utf8'}).trim();
// System gauge percentages
const cpuPct = parseFloat(execSync("top -bn1 | grep 'Cpu(s)' | awk '{print 100-$8}'",{encoding:'utf8'}).trim())||0;
const ramPct = parseInt(execSync("free | awk 'NR==2{printf \"%.0f\", $3*100/$2}'",{encoding:'utf8'}).trim())||0;
const diskPct = parseInt(execSync("df / | awk 'NR==2{print $5}' 2>/dev/null",{encoding:'utf8'}).replace('%',''))||0;
function gaugeColor(p) { return p>=90?'r':p>=70?'y':'g'; }

// ── Weather ──
let weather = null;
try {
  const w = JSON.parse(execSync('curl -s --max-time 5 "wttr.in/Budapest?format=j1" 2>/dev/null',{encoding:'utf8'}));
  const c = w.current_condition[0];
  weather = {temp:c.temp_C,desc:c.weatherDesc[0].value,humidity:c.humidity,wind:c.windspeedKmph,icon:''};
} catch {}
const memFiles = fs.readdirSync(path.join(W,'memory'),{recursive:true}).filter(f=>!f.startsWith('.')).length;
const dailyLogs = fs.readdirSync(path.join(W,'memory')).filter(f=>/^\d{4}-\d{2}-\d{2}\.md$/.test(f)).length;
const lastDaily = fs.readdirSync(path.join(W,'memory')).filter(f=>/^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().pop()?.replace('.md','')||'—';

// ── Viktor Pipeline ──
let viktor = {};
try { viktor = JSON.parse(read('memory/research/viktor-benchmark/autoresearch-state.json')||'{}') } catch {}
const vr = viktor.repos || [];

// Parse gap files for real recall data (state may not have per-repo recall yet)
let gapRecallTotal=0, gapRecallX=0, gapRecallY=0, gapFailed=0;
const gapCwes = new Set();
try {
  const gapDir = path.join(W,'memory/research/viktor-benchmark/results');
  const gapFiles = fs.readdirSync(gapDir).filter(f=>f.endsWith('-gap.md')&&f.startsWith('ar-'));
  for (const gf of gapFiles) {
    const c = fs.readFileSync(path.join(gapDir,gf),'utf8');
    const rm = c.match(/Recall.*?(\d+)\/(\d+)\s*\((\d+)%\)/);
    if (rm) {
      gapRecallX += parseInt(rm[1]); gapRecallY += parseInt(rm[2]);
      if (parseInt(rm[1]) < parseInt(rm[2])) gapFailed++;
    }
    for (const m of c.matchAll(/CWE-(\d+)/g)) gapCwes.add('CWE-'+m[1]);
  }
  gapRecallTotal = gapRecallY > 0 ? Math.round(gapRecallX/gapRecallY*100) : 0;
} catch {}

// Get recall from state if available, fall back to gap files
const recallFromState = (() => {
  const withData = vr.filter(r=>r.recallX!=null&&r.recallY!=null&&r.recallY>0);
  if (withData.length>0) {
    const sx=withData.reduce((s,r)=>s+r.recallX,0), sy=withData.reduce((s,r)=>s+r.recallY,0);
    return {pct:Math.round(sx/sy*100), failed:withData.filter(r=>r.recallX<r.recallY).length};
  }
  return {pct:gapRecallTotal, failed:gapFailed};
})();

// ── Recall Trend from Cortex Runs ──
let recallTrend = [];
try {
  const cortexStatus = read('agents/cortex/status.md')||'';
  const runBlocks = cortexStatus.split(/(?=## Run #\d+ Summary)/g);
  for (const block of runBlocks) {
    const rm = block.match(/Run #(\d+).*?(\d{4}-\d{2}-\d{2})/s);
    const pct = block.match(/Avg recall\s*\|\s*(\d+\.?\d*)%/);
    if (rm && pct) {
      recallTrend.push({run: parseInt(rm[1]), date: rm[2], recall: parseFloat(pct[1])});
    }
  }
  recallTrend.sort((a,b)=>a.run-b.run);
} catch {}

const viktorData = {
  total: viktor.totalCompleted || vr.filter(x=>x.status==='done').length,
  recall: recallFromState.pct,
  pending: vr.filter(x=>x.status==='ready'||x.status==='pending').length,
  active: vr.filter(x=>x.status==='active').length,
  activeLabel: viktor.activeLabel || '',
  failed: recallFromState.failed,
  circuit: viktor.circuitBreaker?.tripped ? 'TRIPPED' : 'Normal',
  negDone: vr.filter(x=>x.type==='negative-test'&&x.status==='done').length,
  negFP: vr.filter(x=>x.type==='negative-test').reduce((s,r)=>s+(r.falsePositives||0),0),
  transfer: vr.filter(x=>x.type==='transfer-test').length || 0,
  h1Submitted: viktor.transferValidation?.h1FindingsSubmitted || 0,
  h1Accepted: viktor.transferValidation?.h1FindingsAccepted || 0,
  blind: gapCwes.size > 0 ? [...gapCwes].sort().slice(0,15).join(', ') : '—',
  recallTrend: recallTrend,
};

// ── H1 Report Timeline ──
const h1Timeline = [];
try {
  const h1f = path.join(W,'h1-api-data');
  const h1files = fs.readdirSync(h1f).filter(f=>f.startsWith('my-reports-')).sort().reverse();
  if (h1files[0]) {
    const h1Data = JSON.parse(fs.readFileSync(path.join(h1f,h1files[0]),'utf8'));
    const stateColors = {resolved:'g','triaged':'y','not-applicable':'r','duplicate':'p','new':'a','closed':'r'};
    for (const r of (h1Data.data||[]).slice(0,10)) {
      const a=r.attributes;
      const state = a.state;
      const days = Math.floor((Date.now()-new Date(a.created_at))/864e5);
      h1Timeline.push({
        id: r.id, title: a.title, state, stateColor: stateColors[state]||'muted',
        created: a.created_at?.slice(0,10),
        triaged: a.triaged_at?.slice(0,10)||'—',
        bounty: a.bounty_awarded_at?'💰':'', days
      });
    }
  }
} catch {}

// ── Cron Grid ──
const cronGrid = [];
try {
  const cronOut = execSync('openclaw cron list 2>/dev/null',{encoding:'utf8'}).trim();
  const lines = cronOut.split('\n');
  for (let i=1;i<lines.length;i++) {
    const line = lines[i];
    if (line.length<50) continue;
    const uuid = line.substring(0,36).trim();
    const rest = line.substring(36);
    // Find status: always one of 'ok' or 'error' preceded/followed by 2+ spaces
    const statusMatch = rest.match(/\s{2,}(ok|error)\s{2,}/);
    const status = statusMatch ? statusMatch[1] : 'ok';
    // Extract name: everything before 'cron ' (schedule starts there)
    let name = rest;
    const cronIdx = rest.indexOf('cron ');
    if (cronIdx > 0) name = rest.substring(0,cronIdx).trim();
    else { /* no cron pattern, name is first segment before 2+ spaces */
      const firstGap = rest.indexOf('  ');
      if (firstGap>0) name = rest.substring(0,firstGap).trim();
    }
    // Last run: the time field before status (e.g., "2h ago", "23h ago")
    const lastMatch = rest.match(/(\d+[hmd]+\s+ago)/);
    const last = lastMatch ? lastMatch[1] : '—';
    // Next run: find "in Xh", "in Xm", "in Xd" pattern
    const nextMatch = rest.match(/in\s+(\d+[hmd])/);
    const next = nextMatch ? 'in '+nextMatch[1] : '—';
    // Agent: second-to-last space-separated block (before the final '-') 
    const parts = rest.trim().split(/\s{2,}/);
    let agent = 'system';
    const knownAgents = ['alfred','porter','edwin','scout','viktor','otto','albert','cortex','hugo','main','null'];
    for (let j=parts.length-1;j>=0;j--) {
      const pa = parts[j].trim();
      if (knownAgents.includes(pa)) { agent = pa==='null'?'system':pa; break; }
    }
    // Normalize truncated names with a known-name map
    const nameMap = {
      'Autoresearch Orchestrator': 'Autoresearch Orchestrator',
      'Autoresearch Orchestr...': 'Autoresearch Orchestrator',
      'Nightly Hacker Intel': 'Nightly Hacker Intel',
      'Nightly Staff Review ...': 'Nightly Staff Review (Core)',
      'Proactive compaction ...': 'Proactive Compaction',
      'Mid-day proactive com...': 'Mid-day Proactive Compact',
      'Stand-up Prep (Friday...': 'Stand-up Prep (Friday)',
      'Stand-up Prep (Tuesda...': 'Stand-up Prep (Tuesday)',
      'Cortex Pipeline Optim...': 'Cortex Pipeline Optimizer',
      'KG Weekly Validation ...': 'KG Weekly Validation',
      'Idle Brainstorming Tr...': 'Idle Brainstorming Trigger',
      'Proactive Evening Com...': 'Proactive Evening Compact',
      'Alíz zsebpénz emlékez...': 'Alíz zsebpénz emlékeztető',
      // CLI name variations
      'Edwin — Continuous Co...': 'Edwin CCM (7-23)',
      'Edwin — Continuous Context Monitor': 'Edwin CCM (7-23)',
      'Edwin — Morning Study': 'Edwin Morning Study',
      'Edwin — Morning Study...': 'Edwin Morning Study',
      'Daily Nightly Backup': 'Nightly Backup',
      'Autoexecutor (02:00 o...': 'Autoexecutor A (02:00)',
      'Autoexecutor (07:00 o...': 'Autoexecutor B (07:00)',
      'Dashboard v4 Refresh ...': 'Dashboard Refresh (2h)',
      'Dashboard v4 Refresh (2h)': 'Dashboard Refresh (2h)',
      'Dashboard v4 Refresh ... every 2h': 'Dashboard Refresh (2h)',
      'Dashboard Research & ...': 'Dashboard Research & Auto-Fix',
      'Hourly Email Triage': 'Porter Hourly Triage',
      'Morning Backup (7 AM)': 'Morning Backup',
      'Morning Backup (7 AM)...': 'Morning Backup',
      'Friday Week in Review': 'Week in Review (Friday)',
      'Daytime Fact Sync (4x...': 'Daytime Fact Sync',
      'Nightly Staff Review ...': 'Nightly Staff Review (Core)',
      'KG Extractor (Nightly...': 'KG Extractor',
      'Hugo Repo Prep (Night...': 'Hugo Repo Prep',
      'Edwin CCM (Hourly 7-2...': 'Edwin CCM (7-23)',
      'Edwin — Weekly Strate...': 'Weekly Strategic Brief',
      'Otto — Nightly Staff ...': 'Nightly Staff Review (Core)',
      'Otto — Nightly Compil...': 'Nightly Staff Review (Compile)',
    };
    name = nameMap[name] || name;
    // Distinguish two Nightly Staff Review jobs
    if (name === 'Nightly Staff Review (Core)' && cronGrid.length > 0 && cronGrid.some(c=>c.name==='Nightly Staff Review (Core)')) {
      name = 'Nightly Staff Review (Compile)';
    }
    // Schedule + description lookup (manually curated — SSOT for dashboard)
    const cronDetail = {
      'Autoresearch Orchestrator': {sched:'01:30 daily', desc:'🧠 Viktor benchmark loop — spawns Viktor for blind repo audits, tracks recall stats'},
      'Nightly Hacker Intel': {sched:'01:30 daily', desc:'🔍 Albert — CVE/exploit intelligence gathering, H1 program scanning'},
      'Autoexecutor A (02:00)': {sched:'02:00 daily', desc:'⚡ Action tracker AUTOEXECUTE items (Flash) — off-peak 00-03'},
      'Otto Core Analysis': {sched:'02:30 daily', desc:'🗄️ Memory audit + agent status + KG consistency check'},
      'Cortex Pipeline Optimizer': {sched:'06:30 /3d', desc:'🧠 System optimization proposals for Viktor pipeline + agent fleet'},
      'Edwin Morning Study': {sched:'05:00 daily', desc:'📚 Capability research: news, self-improvement, local context'},
      'Otto Compilation': {sched:'06:00 daily', desc:'🗄️ Nightly review → Telegram (bilingual metrics + explanation)'},
      'Nightly Staff Review (Core)': {sched:'02:30 daily', desc:'🗄️ Memory audit + agent status + KG consistency check'},
      'Nightly Staff Review (Compile)': {sched:'06:00 daily', desc:'🗄️ Nightly review → Telegram (bilingual metrics + explanation)'},
      'Porter Hourly Triage': {sched:'06-23 hourly', desc:'🚪 Gmail scan: categorize, bill detection → calendar+tasks'},
      'Autoexecutor B (07:00)': {sched:'07:00 daily', desc:'⚡ Action tracker AUTOEXECUTE items (Flash) — off-peak 06-08'},
      'Morning Backup': {sched:'07:05 daily', desc:'💾 Workspace snapshot backup (rsync)'},
      'Edwin CCM (7-23)': {sched:'07-23 hourly', desc:'👁️ Cross-domain pattern detection — 6 pattern types, silence by default'},
      'Daytime Fact Sync': {sched:'12,15,18,21', desc:'📋 Fact consolidation from daily logs into SSOT files'},
      'Stand-up Prep (Friday)': {sched:'15:30 Fri', desc:'📋 Friday scrum stand-up preparation'},
      'Stand-up Prep (Tuesday)': {sched:'15:30 Tue', desc:'📋 Tuesday scrum stand-up preparation'},
      'Week in Review (Friday)': {sched:'17:00 Fri', desc:'📊 Weekly review + metrics compilation'},
      'Alíz zsebpénz emlékeztető': {sched:'16:00 Thu', desc:'💰 Alíz weekly pocket money reminder'},
      'Hugo Repo Prep': {sched:'20:00 daily', desc:'📚 Advisory → answer key preparation for Viktor audits'},
      'KG Extractor': {sched:'21:00 daily', desc:'🧩 Knowledge graph extraction from daily logs'},
      'Brainstorming Trigger': {sched:'22:00 daily', desc:'💡 Research-backed action item generation (Flash)'},
      'Idle Brainstorming Trigger': {sched:'22:00 daily', desc:'💡 Research-backed action item generation (Flash)'},
      'Dashboard Refresh (2h)': {sched:'every 2h', desc:'🔄 Dashboard HTML regeneration from live data'},
      'Dashboard Research & Auto-Fix': {sched:'01:00 daily', desc:'🛠️ Dashboard analysis + web research + auto-fix (Flash, off-peak)'},
      'Nightly Backup': {sched:'23:05 daily', desc:'💾 File-level backup (rsync to dated folder)'},
      'KG Weekly Validation': {sched:'10:00 Sun', desc:'🧩 Knowledge graph weekly audit + dedup'},
      'Weekly Strategic Brief': {sched:'20:00 Sun', desc:'📊 Edwin weekly strategy briefing'},
      'Proactive Compaction': {sched:'auto', desc:'🗜️ Session context compaction (automatic trigger)'},
      'Mid-day Proactive Compact': {sched:'auto', desc:'🗜️ Mid-day session compaction'},
      'Proactive Evening Compact': {sched:'auto', desc:'🗜️ Evening session compaction'},
      'Hourly Email Triage': {sched:'06-23 hourly', desc:'🚪 Gmail scan: categorize, bill detection → calendar+tasks'},
      'Edwin — Continuous Context Monitor': {sched:'07-23 hourly', desc:'👁️ Cross-domain pattern detection — 6 pattern types, silence by default'},
    };
    const detail = cronDetail[name] || {};
    cronGrid.push({id: uuid.substring(0,8), name, status: status==='ok'?'g':status==='error'?'r':'y', last, next, agent, sched: detail.sched||'—', desc: detail.desc||'—'});
  }
} catch {}

// ── H1 from at-a-glance ──
let h1Open='?', h1Signal='?', h1Rep='?', h1Trial='0';
try {
  const ag = read('memory/at-a-glance.md');
  // Try to find structured H1 section, fall back to scattered data
  const hs = (ag.match(/📊 H1 Dashboard[\s\S]*?(?=\n## |\n---|$)/)?.[0]||ag);
  h1Open = hs.match(/\|\s*Open\s*\|\s*(\d+)/)?.[1] || hs.match(/(\d+)\s+Open/)?.[1] || ag.match(/(\d+)\s+Open/)?.[1] || '?';
  h1Signal = ag.match(/Signal[\s:]+([-0-9.]+)/)?.[1] || ag.match(/Signal\s*\|\s*([-0-9.]+)/)?.[1] || '?';
  h1Rep = ag.match(/Reputation[\s:]+(\d+)/)?.[1] || ag.match(/Reputation\s*\|\s*(\d+)/)?.[1];
  if (!h1Rep || h1Rep==='?') {
    // Fallback: try nightly core output
    try {
      const nco = read('memory/state/nightly-core-output.md');
      const repMatch = nco.match(/Reputation[\s:*]+(\d+)/);
      if (repMatch) h1Rep = repMatch[1];
    } catch {}
  }
  h1Rep = h1Rep || '?';
  h1Trial = ag.match(/Trial\s*\|\s*(\d+)/)?.[1] || ag.match(/trial reports?:?\s*(\d+)/i)?.[1] || '0';
  // Also try: "2 Open" from "18 reports, 2 Open"
  if (h1Open==='?') h1Open = ag.match(/reports?,\s*(\d+)\s+Open/)?.[1] || '?';
} catch {}

// ── Action Queue ──
const aq = {auto:[], alfred:[], andras:[]};
try {
  const aqText = read('memory/state/action-queue.md');
  let section = '';
  for (const line of aqText.split('\n')) {
    if (line.match(/^#{1,3}\s*⚡.*Auto-resolved/)) { section='auto'; continue }
    if (line.match(/^#{1,3}\s*👔.*Alfred/)) { section='alfred'; continue }
    if (line.match(/^#{1,3}\s*🧑.*András/)) { section='andras'; continue }
    if (line.match(/^#{1,3}\s*✅.*Resolved/)||(line.startsWith('#')&&!line.startsWith('#'))) { section=''; continue }
    if (!section) continue;
    // Format A: "- [ ] [07-02] [P0] verify_trial — description"
    const m = line.match(/^[-*]\s+\[(.)\] \[(\d{2}-\d{2})\] \[(P\d)\]\s+(\S+)\s+—\s+(.*)/);
    if (m) {
      if (m[1] === 'x' || m[1] === 'X') continue; // skip done items
      aq[section].push({id:m[4], desc:m[5]||'', meta:`[${m[2]}] ${m[3]}`}); continue
    }
    // Format B: "- [x] action — description" (simpler, no date/priority)
    const m3 = line.match(/^[-*]\s+\[(.)\]\s+(\S+)\s+[—\-]\s+(.*)/);
    if (m3) {
      if (m3[1] === 'x' || m3[1] === 'X') continue;
      aq[section].push({id:m3[2], desc:m3[3]||'', meta:'auto'}); continue;
    }
    const m2 = line.match(/└──\s+(.+)/);
    if (m2 && aq[section].length) aq[section][aq[section].length-1].meta = m2[1].trim();
  }
} catch {}

// ── Otto Timeline (last 5) ──
const timeline = [];
try {
  const nightlyDir = path.join(W,'memory/nightly');
  const files = fs.readdirSync(nightlyDir).filter(f=>f.startsWith('nightly-review-')).sort().reverse().slice(0,5);
  for (const f of files) {
    const t = fs.readFileSync(path.join(nightlyDir,f),'utf8');
    const lines = t.split('\n');
    const title = lines[0]?.replace(/^#\s*/,'') || f;
    const date = f.replace('nightly-review-','').replace('.md','');
    // Find first non-metadata line for summary
    let summaryStart = 1;
    for (let si=1; si<lines.length && si<10; si++) {
      if (lines[si].startsWith('**') || lines[si].startsWith('>') || lines[si].length<3 || lines[si].trim()==='---') { summaryStart++; continue }
      break;
    }
    const summary = lines.slice(summaryStart, summaryStart+3).join(' ').substring(0,200);
    const steps = [];
    for (const l of lines) {
      const sm = l.match(/^- \[(x| )\]\s+(N\+\d+):\s+(.+)/);
      if (sm) steps.push({status:sm[1]==='x'?'✅':'⬜', label:sm[3]});
    }
    timeline.push({title, time:date, summary, steps, status: title.includes('FAILED')||title.includes('ERROR')?'err':'ok'});
  }
} catch {}

// ── Agent Heatmap (7-day) ──
const agentDefs = [
  {id:'otto',name:'Otto',emoji:'🗄️'},
  {id:'viktor',name:'Viktor',emoji:'🛡️'},
  {id:'scout',name:'Scout',emoji:'🏕️'},
  {id:'porter',name:'Porter',emoji:'🚪'},
  {id:'edwin',name:'Edwin',emoji:'🚀'},
  {id:'hugo',name:'Hugo',emoji:'📚'},
  {id:'cortex',name:'Cortex',emoji:'🧠'},
  {id:'alfred',name:'Alfred',emoji:'👔'},
];
const heatCols = [];
const now = new Date();
for (let i=6;i>=0;i--) {
  const d = new Date(now); d.setDate(d.getDate()-i);
  heatCols.push(d.toISOString().slice(0,10));
}
const heatRows = [];
for (const a of agentDefs) {
  let lastMention = null;
  const cells = [];
  for (const col of heatCols) {
    const dp = path.join(W,'memory',col+'.md');
    let cell = 'x';
    try {
      const dText = fs.readFileSync(dp,'utf8');
      if (dText.includes(a.name)||dText.includes(a.id)) cell = 'g';
    } catch {}
    cells.push(cell);
  }
  heatRows.push({name:`${a.name} ${a.emoji}`, cells});
}

// ── Agent Cards ──
const agents = agentDefs.map(a => {
  const statusFiles = {otto:'agents/back-office/status.md',viktor:'agents/security-analyst/status.md',scout:'agents/scout/status.md',porter:'agents/porter/status.md',edwin:'agents/jarvis-driver/status.md',hugo:'agents/prep-agent/status.md',cortex:'agents/cortex/status.md',alfred:`memory/${lastDaily}.md`};
  const sf = statusFiles[a.id];
  const days = ageDays(sf);
  const sl = staleLevel(days);
  let status='green', statusText='Active';
  if (sl >= 7) { status='red'; statusText=`Stale (${days}d)` }
  else if (sl >= 3) { status='yellow'; statusText=`Aging (${days}d)` };
  const schedules = {otto:'03:00 + 03:35',viktor:'On-demand',scout:'On-demand (auto-spawn)',porter:'06-23 hourly',edwin:'09:00 daily',hugo:'20:00 nightly',cortex:'06:30 /3d',alfred:'Active (main)'};
  const roles = {otto:'Back Office — Nightly compilation + KG',viktor:'Security Analyst — Repo audit pipeline',scout:'Intel — H1 program discovery',porter:'Email Triage — Gmail filtering',edwin:'Jarvis Driver — Events + monitoring',hugo:'Repo Prep — Advisory → answer keys',cortex:'Optimizer — System tuning',alfred:'Chief of Staff — Orchestration'};
  return {
    id:a.id, name:a.name, emoji:a.emoji,
    status, statusText, staleLevel:sl,
    lastRun: days===999?'Never':`${days}d ago`,
    schedule: schedules[a.id]||'—',
    role: roles[a.id]||'—',
    extra: (days>=7 ? `<div class="metric"><span class="lbl r">⚠ Stale</span><span class="val r">${days}d without update</span></div>` : ''),
  };
});

// ── Open Loops ──
const openLoops = [];
try {
  const tasks = read('memory/logistics/tasks.md');
  let inOL = false, olHeaderDone = false;
  for (const line of tasks.split('\n')) {
    if (line.match(/^##\s*🔓.*Open Loops/)) { inOL=true; olHeaderDone=false; continue }
    if (inOL && (line.startsWith('## ')||line.startsWith('---'))) break;
    if (!inOL) continue;
    if (line.includes('|')&&line.includes('Első említés')) { olHeaderDone=true; continue }
    if (line.includes('|')&&line.includes('---')) continue;
    if (!olHeaderDone) continue;
    const cells = line.split('|').map(c=>c.trim()).filter(c=>c);
    if (cells.length >= 3 && cells[0].match(/^OL-\d+/)) {
      const id = cells[0], desc = cells[1], lastActivity = cells[3]||'', status = cells[4]||'';
      if (status.includes('✅')||status.includes('Lezárva')) continue;
      const sev = status.includes('🔴')?'red':status.includes('🚩')?'yellow':'green';
      openLoops.push({id, desc:desc.substring(0,100), age:lastActivity, severity:sev});
    }
  }
} catch {}

// ── Bills ──
const bills = [];
try {
  const tasks = read('memory/logistics/tasks.md');
  let billIdx = 0;
  for (const line of tasks.split('\n')) {
    if (line.includes('💰')&&(line.includes('Ft')||line.includes('maradék')||line.includes('utal'))) {
      billIdx++;
      bills.push({id:'bill-'+billIdx, desc:line.replace(/^\s*[-*]\s*\[?\s*[x ]\s*\]?\s*/,'').substring(0,120), status:'💰'});
    }
  }
} catch {}

// ── Daily Log Streak ──
const logStreakLines = [];
for (let i=13;i>=0;i--) {
  const d = new Date(now); d.setDate(d.getDate()-i);
  const ds = d.toISOString().slice(0,10);
  logStreakLines.push((exists('memory/'+ds+'.md')?'🟢':'🔴')+' '+ds);
}
const logStreak = logStreakLines.join('<br>');

// ── Research Activity ──
let researchCount = 0, researchRecent = 0;
function countResearch(dir,depth=0) {
  if (depth>3) return;
  try {
    for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) countResearch(path.join(dir,e.name),depth+1);
      else {
        researchCount++;
        try { if (Date.now()-fs.statSync(path.join(dir,e.name)).mtimeMs < 7*864e5) researchRecent++ } catch {}
      }
    }
  } catch {}
}
countResearch(path.join(W,'memory/research'));
const researchActivity = `📄 ${researchCount} research files<br>🆕 ${researchRecent} in last 7 days<br>📂 active + archive`;

// ── Key Decisions ──
const decisions = [];
for (let i=0;i<3;i++) {
  const d = new Date(); d.setDate(d.getDate()-i);
  const dp = path.join(W,'memory',d.toISOString().slice(0,10)+'.md');
  try {
    const t = fs.readFileSync(dp,'utf8');
    const dl = t.split('\n').filter(l=>l.includes('Decision')||l.includes('Döntés')||l.includes('[10]')||l.includes('[9]')).slice(0,3);
    for (const l of dl) decisions.push(`📅 ${d.toISOString().slice(0,10)} — ${l.substring(0,120).trim()}`);
  } catch {}
}

// ── Critical Alerts ──
const alerts = [];
// Daily log gap
for (let i=1;i<=3;i++) {
  const d = new Date(); d.setDate(d.getDate()-i);
  const ds = d.toISOString().slice(0,10);
  if (!exists('memory/'+ds+'.md')) alerts.push({id:'daily-log-'+ds, severity:'critical', text:`Missing daily log: ${ds}`});
}
// Open loops critical
const olCritical = openLoops.filter(ol=>ol.severity==='red').length;
if (olCritical>0) alerts.push({id:'open-loops-critical', severity:'critical', text:`${olCritical} 🔴 Open Loops — 14+ days stale`});
// Agent staleness
const staleAgents = agents.filter(a=>a.staleLevel>=7);
if (staleAgents.length>0) alerts.push({id:'agents-stale', severity:'critical', text:`${staleAgents.length} agents critically stale: ${staleAgents.map(a=>a.name).join(', ')}`});
// H1 trials
if (h1Trial==='0'||h1Trial==='?') alerts.push({id:'h1-trial-gate', severity:'warning', text:'H1 trial reports: 0 — Signal gating blocks new programs'});
// Edwin errors
try {
  const hb = JSON.parse(read('memory/state/heartbeat-state.json')||'{}');
  const edwinErrs = hb.edwin?.consecutiveErrors || 0;
  if (edwinErrs>2) alerts.push({id:'edwin-errors', severity:'critical', text:`Edwin has ${edwinErrs} consecutive errors — recovery needed`});
} catch {}

// ── Edwin Recovery ──
let edwinRecovery = {lastError:'—',consecutive:0,retriesToday:0,timeout:300,status:'Unknown'};
try {
  const hb = JSON.parse(read('memory/state/heartbeat-state.json')||'{}');
  const er = hb.edwin || {};
  edwinRecovery = {
    lastError: er.lastError || '—',
    consecutive: er.consecutiveErrors || 0,
    retriesToday: er.retriesToday || 0,
    timeout: er.timeout || 300,
    status: (er.consecutiveErrors||0)>2 ? '<span class="badge b-e">Stuck</span>' : '<span class="badge b-ok">OK</span>'
  };
} catch {}

// ── Scout Auto-spawn ──
let scoutSpawn = {lastSpawn:'Never',lastCount:'—',autoSpawn:true};
try {
  const css = read('agents/scout/status.md');
  const lastRun = css.match(/Last run.*?(\d{4}-\d{2}-\d{2})/i);
  if (lastRun) scoutSpawn.lastSpawn = lastRun[1];
} catch {}

// ── Metrics ──
const healthyAgents = agents.filter(a=>a.status==='green').length;
const criticalAgents = agents.filter(a=>a.status==='red').length;
const metrics = {
  agentsHealthy: `${healthyAgents}/${agents.length}`,
  agentsCritical: `${criticalAgents} critical`,
  viktorAudits: viktorData.total,
  viktorRecall: viktorData.recall,
  h1Open: h1Open,
  h1Trials: h1Trial,
  openLoops: openLoops.length,
  loopsCritical: olCritical,
  lastOtto: timeline.length>0 ? '#'+timeline[0].title.match(/#(\d+)/)?.[1]||'—' : '—',
  ottoStatus: timeline.length>0 && timeline[0].status==='ok' ? '✅ OK' : '⚠️ Issues',
};

// ── Brainstorming Action Tracker ──
const brainstorming = {autoexec:[], autonotify:[], approval:[], weekend:[], backlog:[]};
let brainstormPending = 0;
try {
  const bat = read('memory/brainstorming/action-tracker.md');
  let section = '';
  for (const line of bat.split('\n')) {
    if (line.match(/^## ⚡ AUTOEXECUTE/)) { section = 'autoexec'; continue }
    if (line.match(/^## 🔔 AUTO_NOTIFY/)) { section = 'autonotify'; continue }
    if (line.match(/^## ✋ APPROVAL_NEEDED/)) { section = 'approval'; continue }
    if (line.match(/^## 🔧 WEEKEND_BUILD/)) { section = 'weekend'; continue }
    if (line.match(/^## 📋 BACKLOG/)) { section = 'backlog'; continue }
    if (line.match(/^## /)) { section = ''; continue }
    if (!section) continue;
    // Match table rows: | ID | STATUS | DESC | SOURCE | AGE |
    const m = line.match(/^\|\s*(BA-\d+|BN-\d+|AP-\d+|WB-\d+|BL-\d+)\s*\|\s*(⬜|✅|⏳|🔄)\s*[^|]*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\S+)/);
    if (m) {
      const isDone = m[2] === '✅';
      const isWaiting = m[2] === '⏳';
      if (!isDone) brainstormPending++;
      brainstorming[section].push({
        id:m[1], done:isDone, waiting:isWaiting,
        desc:m[3].trim().substring(0,100),
        source:m[4].trim().substring(0,80),
        age:m[5]
      });
    }
  }
} catch {}
const bsSections = [
  {key:'autoexec', label:'⚡ AUTOEXECUTE', color:'var(--green)', bgColor:'var(--g-bg)', desc:'Alfred executes, no approval needed'},
  {key:'autonotify', label:'🔔 AUTO_NOTIFY', color:'var(--accent)', bgColor:'#1a2a3a', desc:'Alfred executes + reports, András sees result'},
  {key:'approval', label:'✋ APPROVAL NEEDED', color:'var(--yellow)', bgColor:'var(--y-bg)', desc:'András decides before work starts'},
  {key:'weekend', label:'🔧 WEEKEND BUILD', color:'var(--purple)', bgColor:'#2a1a4a', desc:'András builds, 2-4h'},
  {key:'backlog', label:'📋 BACKLOG', color:'var(--muted)', bgColor:undefined, desc:'Interesting, not now'},
];

// ── Dashboard Research ──
const dashResearch = (() => {
  try {
    const dir = path.join(W,'memory/research/noema');
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(f=>f.endsWith('.md')).sort().reverse();
    if (files.length===0) return null;
    const latest = files[0];
    const content = fs.readFileSync(path.join(dir,latest),'utf8');
    const date = latest.replace('.md','');
    // Count table rows within a section (between its header and next ### or end)
    const countRows = (sectionHeader) => {
      const startIdx = content.indexOf(`### ${sectionHeader}`);
      if (startIdx === -1) return 0;
      const afterStart = content.indexOf('\n', startIdx);
      const nextSection = content.indexOf('\n### ', afterStart+1);
      const sectionEnd = nextSection === -1 ? content.length : nextSection;
      const section = content.substring(afterStart, sectionEnd);
      return (section.match(/^\| \d+ \|.*\|/gm)||[]).length;
    };
    const autoFixCount = countRows('🔧 AUTO-FIX');
    const proposeCount = countRows('📋 PROPOSE');
    const ideaCount = countRows('💡 IDEA');
    // Top proposals (extract only from PROPOSE section)
    const proposals = [];
    const propStart = content.indexOf('### 📋 PROPOSE');
    if (propStart !== -1) {
      const propEnd = content.indexOf('\n### ', propStart+1);
      const propSection = content.substring(propStart, propEnd === -1 ? content.length : propEnd);
      const lines = propSection.split('\n').filter(l=>l.match(/^\| \d+ \|/));
      for (const l of lines) {
        const parts = l.split('|').map(s=>s.trim()).filter(Boolean);
        if (parts.length>=3) proposals.push({id:'P-'+parts[0], finding:parts[1], priority:parts[3]||'🟢'});
      }
    }
    // Merge JSONL statuses into proposals
    try {
      const jsonlPath = path.join(W,'memory/state/noema-actions.jsonl');
      if (fs.existsSync(jsonlPath)) {
        const actions = fs.readFileSync(jsonlPath,'utf8').trim().split('\n')
          .filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);
        for (const p of proposals) {
          const match = actions.find(a=>a.id===p.id);
          if (match) {
            p.status = match.status;
            p.updatedAt = match.updatedAt;
          }
        }
        // Also include non-proposal actions for status tracking (done, escalate, etc.)
        const actionItems = actions.filter(a=>a.action!=='implement' && a.status!=='done' && a.status!=='dead');
        if (actionItems.length) dashResearch._actionItems = actionItems;
      }
    } catch(e) { /* ignore jsonl errors */ }
    return { date, latestFile: latest, autoFixCount, proposeCount, ideaCount, total:autoFixCount+proposeCount+ideaCount, proposals:proposals.slice(0,8) };
  } catch(e) { return { error: e.message }; }
})();

// ── Assemble Payload ──
const payload = JSON.stringify({
  generated: NOW,
  system: { hostname: HOSTNAME, uptime, disk, ram, memFiles, dailyLogs, lastDaily,
    cpuPct, ramPct, diskPct, cpuColor: gaugeColor(cpuPct), ramColor: gaugeColor(ramPct), diskColor: gaugeColor(diskPct) },
  weather,
  alerts,
  metrics,
  edwinRecovery,
  scoutSpawn,
  timeline,
  dashboardResearch: dashResearch,
  cronGrid,
  h1Timeline,
  actionQueue: aq,
  agentHeatmap: { columns: heatCols, rows: heatRows },
  agents: agents.map(a=>({id:a.id,name:a.name,emoji:a.emoji,status:a.status,statusText:a.statusText,staleLevel:a.staleLevel,lastRun:a.lastRun,schedule:a.schedule,role:a.role,extra:a.extra})),
  viktor: viktorData,
  h1: {
    open: h1Open, signal: h1Signal, reputation: h1Rep, trial: h1Trial,
    programs: (() => {
      try {
        const sc = read('agents/scout/status.md');
        const lines = sc.split('\n');
        let inTable = false;
        const rows = [];
        for (const l of lines) {
          if (l.match(/^## Accessible Programs/)) { inTable = true; continue; }
          if (inTable && l.match(/^## /)) break;
          if (inTable && l.match(/^\|.*\|.*\|/) && !l.includes('---') && !l.includes('Type')) {
            rows.push(l.replace(/^\|\s*/, '').replace(/\s*\|\s*$/, ''));
          }
        }
        if (rows.length > 0) return rows.join('<br>');
      } catch {}
      return '⛔ Signal ' + (h1Signal||'?') + ' — Ruby (BBP) + Rails (VDP) only';
    })()
  },
  openLoops,
  bills,
  brainstorming: { sections: bsSections.map(s => ({...s, items: brainstorming[s.key]})), pending: brainstormPending },
  logStreak,
  researchActivity,
  keyDecisions: decisions.slice(0,8).join('<br>') || 'No recent decisions',
  // ── 🧠 Noema Product Data ──
  noema: (() => {
    const pf = (f) => { try { return fs.statSync(path.join(W,f)).size } catch { return 0 } };
    const pl = (f) => { try { return fs.readFileSync(path.join(W,f),'utf8').split('\n').length } catch { return 0 } };
    const genLines = pl('projects/noema/generate.cjs'); const relayLines = pl('projects/noema/relay.js');
    const procLines = pl('projects/noema/action-processor.js');
    const totalLoc = genLines + relayLines + procLines;
    const genSize = pf('projects/noema/generate.cjs'); const relaySize = pf('projects/noema/relay.js');
    const procSize = pf('projects/noema/action-processor.js');
    const htmlSize = pf('projects/noema/dashboard.html');
    const totalSize = genSize + relaySize + procSize + htmlSize;

    // CHANGELOG
    let changelogHtml = '—';
    try {
      const cl = fs.readFileSync(path.join(W,'projects/noema/CHANGELOG.md'),'utf8');
      const entries = cl.split(/^## (\d{4}-\d{2}-\d{2})/gm);
      const clItems = [];
      for (let i = 1; i < entries.length; i += 2) {
        if (clItems.length >= 3) break;
        const date = entries[i];
        const content = (entries[i+1]||'').trim().split('\n').filter(l => l.startsWith('-')||l.startsWith('###')).slice(0,4);
        clItems.push(`<div style="margin-bottom:8px"><strong style="color:var(--accent)">${date}</strong><br>${content.map(l => `<span style="color:var(--muted);font-size:0.88em">${l.trim()}</span>`).join('<br>')}</div>`);
      }
      changelogHtml = clItems.join('') || changelogHtml;
    } catch {}

    // Architecture diagram
    const arch = `  generate.cjs ──► dashboard.html\n   (${(genSize/1024).toFixed(1)}KB)       (${(htmlSize/1024).toFixed(1)}KB)\n       ▲                  │\n  22+ data srcs      HTTP :8080\n       │                  │\n  relay.js ◄── Browser gombok\n   (${(relaySize/1024).toFixed(1)}KB)          :18998\n       │\n  action-processor.js\n   (${(procSize/1024).toFixed(1)}KB)      10p timer\n       │\n  dev-loop.sh ──► Cursor`;

    // Code metrics HTML
    const codeMetrics = `
      <div class="metric"><span class="lbl">generate.cjs</span><span class="val">${genLines} sor · ${(genSize/1024).toFixed(1)}KB</span></div>
      <div class="metric"><span class="lbl">relay.js</span><span class="val">${relayLines} sor · ${(relaySize/1024).toFixed(1)}KB</span></div>
      <div class="metric"><span class="lbl">action-processor.js</span><span class="val">${procLines} sor · ${(procSize/1024).toFixed(1)}KB</span></div>
      <div class="metric"><span class="lbl">dashboard.html (kimenet)</span><span class="val">${(htmlSize/1024).toFixed(1)}KB</span></div>
      <div class="metric" style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px"><span class="lbl">Összes forráskód</span><span class="val a">${totalLoc} sor · ${((totalSize-htmlSize)/1024).toFixed(1)}KB</span></div>`;

    // Product health scoring
    let healthScore = 85; let healthLabel = '';
    // Has README, CHANGELOG, 3 crons active
    healthLabel = `${totalLoc} LOC · 5 fájl · 3 cron`;

    // QA metrics
    let qaLatest = '⏳'; let qaLabel = 'első futás ma 03:00';
    let qaReportHtml = '⏳ Első Noema QA futás ma éjjel 03:00-kor. Még nincs adat.';

    // Project crons
    const noemaCronIds = ['cbc7d5d6','3b4ea5d3','eed1df55'];
    let cronListHtml = '';
    let cronHealthy = 0;
    try {
      const cronStatus = JSON.parse(execSync('openclaw cron list --json 2>/dev/null',{encoding:'utf8',timeout:3000})||'[]');
      for (const c of noemaCronIds) {
        const found = cronStatus.find(cs => cs.id && cs.id.startsWith(c));
        const status = found ? (found.state==='idle'||found.state==='active'?'🟢':'🟡') : '🔴';
        if (status === '🟢') cronHealthy++;
        const lastRun = found?.lastRunAtMs ? new Date(found.lastRunAtMs).toISOString().substring(11,16) : '—';
        const name = {'cbc7d5d6':'Refresh (2h)','3b4ea5d3':'Research (01:00)','eed1df55':'QA (03:00)'}[c]||c;
        cronListHtml += `<div class="metric"><span class="lbl">${status} ${name}</span><span class="val">${lastRun}</span></div>`;
      }
      healthScore = Math.round(healthScore * (cronHealthy/3));
    } catch { cronListHtml = '<span style="color:var(--muted)">Cron lekérdezés sikertelen</span>'; }

    // Development packages from INDEX.md
    let packagesHtml = '';
    let activePropCount = 0;
    try {
      const indexMd = fs.readFileSync(path.join(W,'projects/noema/dev/packages/INDEX.md'),'utf8');
      // Parse table rows: | PKG-XXX | Name | F0 | ... | S | 1h | DEP |
      const rows = indexMd.split('\n').filter(l => l.match(/^\| PKG-\d{3}\s*\|/));
      const sizeColors = { S: 'var(--green)', M: 'var(--yellow)', L: 'var(--accent)', XL: 'var(--red)' };
      for (const row of rows) {
        const cols = row.split('|').map(c => c.trim()).filter(c => c);
        if (cols.length < 5) continue;
        const [pkgId, name, phase, , size] = cols;
        const deps = cols[cols.length-1] || '—';
        const isDone = phase.startsWith('✅');
        const sizeBadge = `<span style="color:${sizeColors[size]||''};font-weight:700;font-size:0.82em">${size}</span>`;
        const borderColor = isDone ? 'var(--green)' : 'var(--accent)';
        const bgStyle = isDone ? 'opacity:0.6' : '';
        packagesHtml += `<div style="font-size:0.88em;padding:6px 8px;margin-bottom:3px;background:var(--card);border-left:3px solid ${borderColor};border-radius:3px;line-height:1.5;display:flex;align-items:center;gap:8px;${bgStyle}">`;
        packagesHtml += `<span style="flex:1"><strong>${pkgId}</strong> ${name} ${sizeBadge} <span style="color:var(--muted);font-size:0.82em">${deps!=='—'?'→ '+deps:''}</span></span>`;
        if (isDone) {
          packagesHtml += `<span style="color:var(--green);font-weight:700;font-size:0.82em;white-space:nowrap">✅ KÉSZ</span>`;
        } else {
          packagesHtml += `<button onclick="sendAction('implement','${pkgId}','${pkgId}: ${name.replace(/'/g,"\\'")}',this,'▶ Mehet')" style="cursor:pointer;background:var(--green);color:#fff;border:none;border-radius:4px;padding:2px 10px;font-size:0.82em;font-weight:700;white-space:nowrap;flex-shrink:0">▶ Mehet</button>`;
          activePropCount++;
        }
        packagesHtml += '</div>';
      }
    } catch (e) { packagesHtml = '<span style="color:var(--red)">Package index hiba: '+e.message+'</span>'; }
    
    // Research proposals from nightly cron (secondary)
    let researchHtml = '';
    try {
      const rd = path.join(W,'memory/research/noema');
      if (fs.existsSync(rd)) {
        const rf = fs.readdirSync(rd).sort().reverse().slice(0,3);
        const researchLines = [];
        for (const f of rf) {
          const content = fs.readFileSync(path.join(rd,f),'utf8');
          const props = content.match(/📋 PROPOSE.*/g) || [];
          if (props.length > 0) researchLines.push(...props.map(p => p.trim()));
        }
        if (researchLines.length > 0) {
          researchHtml = '<hr style="margin:10px 0;border-color:var(--border)"><div style="font-size:0.85em;color:var(--muted);margin-bottom:4px">🔮 Research cron javaslatok (hamarosan):</div>';
          researchHtml += researchLines.slice(0,8).map(l => `<div style="font-size:0.84em;opacity:0.7">${l}</div>`).join('');
        }
      }
    } catch {}

    return {
      healthScore, healthLabel,
      cronsHealthy: cronHealthy||0, cronsTotal: 3, cronHealth: (cronHealthy||0)/3,
      qaLatest, qaLabel, qaScore: qaLatest==='⏳'?'?':'g',
      activeProposals: activePropCount, proposalsLabel: activePropCount>0?activePropCount+' csomag':'pending',
      architecture: arch, codeMetrics,
      projectCrons: cronListHtml||'—',
      changelog: changelogHtml,
      qaReport: qaReportHtml,
      proposals: packagesHtml + researchHtml
    };
  })()
});

// ── Inject into template ──
const template = fs.readFileSync(path.join(W,'projects/noema/archive/v4.html'),'utf8');
const escaped = payload.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
const html = template.replace("'DATA_JSON_PLACEHOLDER'", "'"+escaped+"'");
const outFile = path.join(W,'projects/noema/dashboard.html');
fs.writeFileSync(outFile, html);

console.log(`✅ Dashboard v4: ${outFile} (${Buffer.byteLength(html)} bytes)`);

// ── Also update the legacy dashboard.html symlink for Otto ──
const legacyFile = path.join(W,'projects/noema/dashboard.html');
try { fs.unlinkSync(legacyFile) } catch {}
fs.writeFileSync(legacyFile, html);
console.log(`✅ Legacy dashboard: ${legacyFile} (symlinked)`);
