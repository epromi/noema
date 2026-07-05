#!/bin/bash
# Dashboard v4 Generator — powers the multi-tab dashboard
# Run: bash projects/dashboard/generate-v4.sh (or from Otto Compilation nightly)
set -euo pipefail
WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
TEMPLATE="$WORKSPACE/projects/dashboard/dashboard-v4.html"
OUTFILE="$WORKSPACE/projects/dashboard/dashboard-live.html"
NOW=$(date '+%Y-%m-%d %H:%M:%S %Z')
HOSTNAME=$(hostname)

# ── Helpers ──
h() { echo "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g'; }
file_age_days() {  # days since file modification
  [ -f "$1" ] || { echo "999"; return; }
  local s t; s=$(stat -c %Y "$1" 2>/dev/null) || { echo "999"; return; }
  t=$(date +%s); echo $(( (t - s) / 86400 ))
}
stale() {  # 0/3/7 level based on days
  local d=${1:-0}
  [ "$d" -ge 14 ] && echo 7 || [ "$d" -ge 7 ] && echo 3 || echo 0
}

# ── System ──
UPTIME=$(uptime -p 2>/dev/null | sed 's/up //' || echo "?")
DISK=$(df -h / | awk 'NR==2{print $5" used ("$3"/"$2")"}' 2>/dev/null || echo "?")
MEM=$(free -h | awk 'NR==2{printf "%s used / %s total", $3, $2}' 2>/dev/null || echo "?")
MEM_FILES=$(find "$WORKSPACE/memory" -type f 2>/dev/null | wc -l)
DAILY_LOGS=$(ls "$WORKSPACE/memory"/????-??-??.md 2>/dev/null | wc -l || echo 0)
LAST_DAILY=$(ls -t "$WORKSPACE/memory"/????-??-??.md 2>/dev/null | head -1 | xargs basename 2>/dev/null | sed 's/\.md//' || echo "—")

# ── Viktor Pipeline (from JSON) ──
PIPE_DATA=$(node -e "
try{
  const d=JSON.parse(require('fs').readFileSync('$WORKSPACE/memory/research/viktor-benchmark/autoresearch-state.json','utf8'));
  const r=d.repos||[];
  console.log(JSON.stringify({
    total: d.pipelineHealth?.totalCompleted||0,
    recall: d.pipelineHealth?.avgRecallLast10||0,
    pending: r.filter(x=>x.status==='pending').length,
    pendingNeg: r.filter(x=>x.status==='pending-negative').length,
    failed: r.filter(x=>x.round>0&&(x.recall||'').startsWith('0/')).length,
    tripped: d.circuitBreaker?.tripped||false,
    negDone: d.negativeTests?.total||0,
    negFP: d.negativeTests?.falsePositives||0,
    transfer: d.transferValidation?.totalRun||0,
    h1Submitted: d.transferValidation?.h1FindingsSubmitted||0,
    h1Accepted: d.transferValidation?.h1FindingsAccepted||0,
    blind: (d.cweDiversity?.blindSpots||[]).join(', '),
  }))
}catch(e){console.log('{}')}
")

# ── H1 from at-a-glance ──
H1_OPEN="?"; H1_SIGNAL="?"; H1_REP="?"; H1_TRIAL="?"
if [ -f "$WORKSPACE/memory/at-a-glance.md" ]; then
  H1_SECTION=$(sed -n '/📊 H1 Dashboard/,/##/p' "$WORKSPACE/memory/at-a-glance.md" 2>/dev/null || true)
  H1_OPEN=$(echo "$H1_SECTION" | grep -oP '\| Open\s*\|\s*\K\d+' | head -1 || echo "?")
  H1_SIGNAL=$(echo "$H1_SECTION" | grep -oP 'Signal\s*\|\s*\K[-0-9.]+' | head -1 || echo "?")
  H1_REP=$(echo "$H1_SECTION" | grep -oP 'Reputation\s*\|\s*\K\d+' | head -1 || echo "?")
  H1_TRIAL=$(echo "$H1_SECTION" | grep -oP 'Trial\s*\|\s*\K\d+' | head -1 || echo "0")
fi

# ── Action Queue ──
ACTION_QUEUE_JSON='{"auto":[],"alfred":[],"andras":[]}'
if [ -f "$WORKSPACE/memory/state/action-queue.md" ]; then
  ACTION_QUEUE_JSON=$(node -e "
  const fs=require('fs');
  try{
    const t=fs.readFileSync('$WORKSPACE/memory/state/action-queue.md','utf8');
    const out={auto:[],alfred:[],andras:[]};
    let section='';
    for(const line of t.split('\n')) {
      if(line.startsWith('### ⚡ Auto-resolved')) { section='auto'; continue; }
      if(line.startsWith('### 👔 Alfred')) { section='alfred'; continue; }
      if(line.startsWith('### 🧑 András')) { section='andras'; continue; }
      if(line.startsWith('### ✅ Resolved')) { section=''; continue; }
      if(line.startsWith('##')) { section=''; continue; }
      if(!section) continue;
      // Parse items: lines starting with bullet points or action IDs
      const m=line.match(/^[-*]\s+\*\*(.+?)\*\*\s*(.*)/);
      if(m) out[section].push({id:m[1],desc:m[2]});
      const m2=line.match(/└──\s+(.+)/);
      if(m2) {
        const last=out[section][out[section].length-1];
        if(last) last.meta=(last.meta||'')+' '+m2[1].trim();
      }
    }
    console.log(JSON.stringify(out));
  }catch(e){console.log('{\"auto\":[],\"alfred\":[],\"andras\":[]}')}
  ")
fi

# ── Otto Timeline (last 5 nightly reviews) ──
TIMELINE_JSON='[]'
TIMELINE_JSON=$(node -e "
const fs=require('fs'),path=require('path');
try{
  const dir='$WORKSPACE/memory/nightly';
  const files=fs.readdirSync(dir).filter(f=>f.startsWith('nightly-review-')).sort().reverse().slice(0,5);
  const out=[];
  for(const f of files) {
    const t=fs.readFileSync(path.join(dir,f),'utf8');
    // Extract title line and summary
    const lines=t.split('\n');
    const title=lines[0]?.replace(/^#\s*/,'')||f;
    const date=f.replace('nightly-review-','').replace('.md','');
    const summary=lines.slice(1,4).join(' ').substring(0,200);
    // Extract step entries (N+ items)
    const steps=[];
    for(const l of lines) {
      const sm=l.match(/^- \[(x| )\]\s+(N\+\d+):\s+(.+)/);
      if(sm) steps.push({status:sm[1]==='x'?'✅':'⬜',label:sm[3]});
    }
    out.push({title,time:date,summary,steps,status:title.includes('SUCCESS')?'ok':'warn'});
  }
  console.log(JSON.stringify(out));
}catch(e){console.log('[]')}
")

# ── Agent Heatmap (7-day) ──
HEATMAP_JSON=$(node -e "
const fs=require('fs'),path=require('path');
const now=new Date();
const agents=[
  {id:'otto',name:'Otto',dir:'$WORKSPACE/agents/back-office/status.md',cron:'745964aa'},
  {id:'viktor',name:'Viktor',dir:'$WORKSPACE/agents/security-analyst/status.md'},
  {id:'scout',name:'Scout',dir:'$WORKSPACE/agents/scout/status.md'},
  {id:'porter',name:'Porter',dir:'$WORKSPACE/agents/porter/status.md',cron:'dc91353b'},
  {id:'edwin',name:'Edwin',dir:'$WORKSPACE/agents/jarvis-driver/status.md',cron:'b17b3b17'},
  {id:'hugo',name:'Hugo',dir:'$WORKSPACE/agents/prep-agent/status.md'},
  {id:'cortex',name:'Cortex',dir:'$WORKSPACE/agents/cortex/status.md'},
  {id:'alfred',name:'Alfred',dir:'$WORKSPACE/memory/2026-07-02.md'},
];
const cols=[];
for(let i=6;i>=0;i--) {
  const d=new Date(now); d.setDate(d.getDate()-i);
  cols.push(d.toISOString().slice(0,10));
}
const rows=[];
for(const a of agents) {
  const cells=[];
  let lastDate=null;
  for(const col of cols) {
    // Check if we have a daily log or status entry for this date
    const dailyPath='$WORKSPACE/memory/'+col+'.md';
    if(fs.existsSync(dailyPath)) {
      const d=fs.readFileSync(dailyPath,'utf8');
      const hasMention=d.includes(a.name)||d.includes(a.id);
      cells.push(hasMention?'g':'x');
    } else {
      cells.push('x');
    }
  }
  rows.push({name:a.name+' '+({otto:'🗄️',viktor:'🛡️',scout:'🏕️',porter:'🚪',edwin:'🚀',hugo:'📚',cortex:'🧠',alfred:'👔'}[a.id]||''),cells});
}
console.log(JSON.stringify({columns:cols,rows}));
")

# ── Open Loops (from tasks.md) ──
LOOPS_JSON='[]'
if [ -f "$WORKSPACE/memory/logistics/tasks.md" ]; then
  LOOPS_JSON=$(node -e "
  const fs=require('fs');
  try{
    const t=fs.readFileSync('$WORKSPACE/memory/logistics/tasks.md','utf8');
    const out=[];
    let inOL=false;
    for(const line of t.split('\n')) {
      if(line.includes('🔓 Open Loops')) { inOL=true; continue; }
      if(inOL && (line.startsWith('##')||line.startsWith('---'))) break;
      if(!inOL) continue;
      const m=line.match(/^\s*[-*]\s+OL-\d+.*📅\s*(.+)/);
      if(m) {
        const age=m[1];
        const sev=age.includes('d')?(parseInt(age)>=14?'red':parseInt(age)>=7?'yellow':'green'):'green';
        out.push({id:line.match(/(OL-\d+)/)?.[1]||'',desc:line.substring(0,100),age,severity:sev});
      }
    }
    console.log(JSON.stringify(out));
  }catch(e){console.log('[]')}
  ")
fi

# ── Bills ──
BILLS_JSON='[]'
if [ -f "$WORKSPACE/memory/logistics/tasks.md" ]; then
  BILLS_JSON=$(node -e "
  const fs=require('fs');
  try{
    const t=fs.readFileSync('$WORKSPACE/memory/logistics/tasks.md','utf8');
    const out=[];
    let inBills=false;
    for(const line of t.split('\n')) {
      if(line.includes('💰')) { inBills=true; continue; }
      if(inBills && (line.startsWith('##')||line.startsWith('---'))) break;
      if(!inBills) continue;
      const m=line.match(/^\s*[-*]\s+(.+)/);
      if(m) out.push({desc:m[1],status:'✅ '});
    }
    console.log(JSON.stringify(out));
  }catch(e){console.log('[]')}
  ")
fi

# ── Daily Log Streak ──
LOG_STREAK=$(node -e "
const fs=require('fs');
const now=new Date();
const out=[];
for(let i=0;i<14;i++) {
  const d=new Date(now); d.setDate(d.getDate()-i);
  const ds=d.toISOString().slice(0,10);
  const p='$WORKSPACE/memory/'+ds+'.md';
  out.unshift((fs.existsSync(p)?'🟢':'🔴')+' '+ds);
}
console.log(out.slice(-14).join('<br>'));
")

# ── Research Activity ──
RESEARCH_ACT=$(node -e "
const fs=require('fs'),path=require('path');
const dir='$WORKSPACE/memory/research';
let total=0,recent=0;
try{
  function count(dir,depth){
    if(depth>3) return;
    const entries=fs.readdirSync(dir,{withFileTypes:true});
    for(const e of entries) {
      if(e.name.startsWith('.')) continue;
      if(e.isDirectory()) count(path.join(dir,e.name),depth+1);
      else { total++; if(Date.now()-fs.statSync(path.join(dir,e.name)).mtimeMs<7*864e5) recent++; }
    }
  }
  count(dir,0);
}catch(e){}
console.log('📄 '+total+' research files<br>🆕 '+recent+' in last 7 days<br>📂 active + archive');
")

# ── Key Decisions ──
KEY_DECISIONS=$(node -e "
const fs=require('fs'),path=require('path');
const lines=[];
for(let i=0;i<3;i++) {
  const d=new Date(); d.setDate(d.getDate()-i);
  const p='$WORKSPACE/memory/'+d.toISOString().slice(0,10)+'.md';
  if(fs.existsSync(p)) {
    const t=fs.readFileSync(p,'utf8');
    const dl=t.split('\n').filter(l=>l.includes('Decision')||l.includes('Döntés')||l.includes('[10]')||l.includes('[9]')).slice(0,2);
    for(const l of dl) lines.push('📅 '+d.toISOString().slice(0,10)+' — '+l.substring(0,120));
  }
}
console.log(lines.slice(0,8).join('<br>')||'No recent decisions');
")

# ── Critical Alerts ──
ALERTS=$(node -e "
const fs=require('fs');
const out=[];
const now=new Date(),today=now.toISOString().slice(0,10);

// Check daily log gap
const yest=['memory'];
for(let i=1;i<=3;i++) {
  const d=new Date(now); d.setDate(d.getDate()-i);
  const p='$WORKSPACE/memory/'+d.toISOString().slice(0,10)+'.md';
  if(!fs.existsSync(p)) out.push({severity:'critical',text:'Missing daily log: '+d.toISOString().slice(0,10)});
}

// Check action queue
const aq='$WORKSPACE/memory/state/action-queue.md';
if(fs.existsSync(aq)) {
  const t=fs.readFileSync(aq,'utf8');
  const reds=(t.match(/🔴/g)||[]).length;
  if(reds>0) out.push({severity:'critical',text:reds+' 🔴 items in Action Queue need attention'});
}

// Edwin errors
const hb='$WORKSPACE/memory/state/heartbeat-state.json';
try{
  const h=JSON.parse(fs.readFileSync(hb,'utf8'));
  if(h.edwin&&h.edwin.consecutiveErrors>2) out.push({severity:'critical',text:'Edwin has '+h.edwin.consecutiveErrors+' consecutive errors'});
}catch(e){}

// H1 trials
if('$H1_TRIAL'==='0'||'$H1_TRIAL'==='?') out.push({severity:'warning',text:'H1 trial reports: 0 — Signal gating active'});

console.log(JSON.stringify(out));
")

# ── Assemble Final JSON Payload ──
PAYLOAD=$(node -e "
const D={
  generated: '$NOW',
  system: {
    hostname: '$HOSTNAME',
    uptime: '$UPTIME',
    disk: '$DISK',
    ram: '$MEM',
    memFiles: $MEM_FILES,
    dailyLogs: $DAILY_LOGS,
    lastDaily: '$LAST_DAILY',
  },
  alerts: $ALERTS,
  metrics: {
    agentsHealthy: 'CHECK',
    agentsCritical: 'CHECK',
    viktorAudits: $PIPE_DATA? $PIPE_DATA.total : 0,
    viktorRecall: $PIPE_DATA? $PIPE_DATA.recall : 0,
    h1Open: '$H1_OPEN',
    h1Trials: '$H1_TRIAL',
    openLoops: 'CHECK',
    loopsCritical: 'CHECK',
    lastOtto: 'CHECK',
    ottoStatus: 'CHECK',
  },
  edwinRecovery: {
    lastError: 'CHECK',
    consecutive: 'CHECK',
    retriesToday: 'CHECK',
    timeout: 300,
    status: 'CHECK',
  },
  scoutSpawn: {
    lastSpawn: 'CHECK',
    lastCount: 'CHECK',
    autoSpawn: true,
  },
  timeline: $TIMELINE_JSON,
  actionQueue: $ACTION_QUEUE_JSON,
  agentHeatmap: $HEATMAP_JSON,
  agents: CHECK_AGENTS,
  viktor: $PIPE_DATA?JSON.parse('$PIPE_DATA'):null,
  h1: {
    open: '$H1_OPEN',
    signal: '$H1_SIGNAL',
    reputation: '$H1_REP',
    trial: '$H1_TRIAL',
    programs: '📌 <strong>Matomo</strong> — OAuth2 PKCE<br>📌 <span class=\"y\">Chainlink</span> — ConfidentialRelay',
  },
  openLoops: $LOOPS_JSON,
  bills: $BILLS_JSON,
  logStreak: '$LOG_STREAK',
  researchActivity: '$RESEARCH_ACT',
  keyDecisions: '$KEY_DECISIONS',
};
process.stdout.write(JSON.stringify(D));
" 2>&1)

# ── Now generate the final HTML by replacing placeholder ──
cp "$TEMPLATE" "$OUTFILE"

# Escape JSON for inline script
ESCAPED=$(echo "$PAYLOAD" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n')

sed -i "s|DATA_JSON_PLACEHOLDER|$ESCAPED|" "$OUTFILE"

echo "✅ Dashboard v4: $OUTFILE ($(wc -c < "$OUTFILE") bytes, $(wc -l < "$OUTFILE") lines)"
