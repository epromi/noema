#!/bin/bash
# Dashboard Generator v3 — single HTML overview page
# Run: bash projects/dashboard/generate.sh (or from Otto Compilation nightly)
set -euo pipefail
WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
OUTFILE="$WORKSPACE/projects/dashboard/dashboard.html"
NOW=$(date '+%Y-%m-%d %H:%M:%S %Z')
HOSTNAME=$(hostname)

# ── Helpers ──
h() { echo "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g'; }
json() { node -e "try{const d=JSON.parse(require('fs').readFileSync('$1','utf8'));console.log(d$2??'—')}catch(e){console.log('—')}" 2>/dev/null || echo "—"; }
yn() { [ "$1" = "1" ] || [ "$1" = "true" ] && echo '<span class="badge badge-err">ERROR</span>' || echo '<span class="badge badge-ok">OK</span>'; }

# ── System ──
UPTIME=$(uptime -p 2>/dev/null | sed 's/up //' || echo "?")
DISK=$(df -h / | awk 'NR==2{print $5" used ("$3"/"$2")"}' 2>/dev/null || echo "?")
MEM=$(free -h | awk 'NR==2{printf "%s used / %s total", $3, $2}' 2>/dev/null || echo "?")

# ── Pipeline data ──
PIPE_JSON=$(node -e "
const fs=require('fs');
const f='$WORKSPACE/memory/research/viktor-benchmark/autoresearch-state.json';
try{
  const d=JSON.parse(fs.readFileSync(f,'utf8'));
  const r=d.repos||[];
  const out={
    total:d.pipelineHealth?.totalCompleted||0,
    recall:d.pipelineHealth?.avgRecallLast10||0,
    pending:r.filter(x=>x.status==='pending').length,
    pendingNeg:r.filter(x=>x.status==='pending-negative').length,
    reTest:r.filter(x=>x.status==='pending'&&x.round>0).length,
    tripped:d.circuitBreaker?.tripped?'TRIPPED':'Normal',
    negDone:d.negativeTests?.total||0,
    negFP:d.negativeTests?.falsePositives||0,
    transfer:d.transferValidation?.totalRun||0,
    blind:(d.cweDiversity?.blindSpots||[]).join(', '),
    failed:r.filter(x=>x.round>0&&(x.recall||'').startsWith('0/')).length,
    done:r.filter(x=>x.status==='done').length,
    avgRecall:d.pipelineHealth?.avgRecallLast10||0,
  };
  // H1 data from same file
  out.h1Submitted=d.transferValidation?.h1FindingsSubmitted||0;
  out.h1Accepted=d.transferValidation?.h1FindingsAccepted||0;
  process.stdout.write(JSON.stringify(out));
}catch(e){process.stdout.write('{}');}
")
eval $(echo "$PIPE_JSON" | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
for(const[k,v] of Object.entries(d)){
  console.log('PIPE_'+k+'=\"'+String(v).replace(/\"/g,'\\\\\"')+'\";');
}
")

# ── Memory stats ──
MEM_FILES=$(find "$WORKSPACE/memory" -type f 2>/dev/null | wc -l)
DAILY_LOGS=$(ls "$WORKSPACE/memory"/????-??-??.md 2>/dev/null | wc -l || echo 0)
LAST_DAILY=$(ls -t "$WORKSPACE/memory"/????-??-??.md 2>/dev/null | head -1 | xargs basename 2>/dev/null | sed 's/\.md//' || echo "—")

# ── Scout ──
SCOUT_LATEST=$(ls -t "$WORKSPACE/memory/research/hacker-intel/" 2>/dev/null | head -1 | sed 's/nightly-intel-//;s/\.md//' || echo "—")

# ── Cortex ──
CORTEX_LATEST=$(ls -t "$WORKSPACE/agents/cortex/proposals/" 2>/dev/null | head -1 | sed 's/\.md//' || echo "—")

# ── H1 from at-a-glance.md (scoped to H1 Dashboard section) ──
H1_OPEN="?"
H1_SIGNAL="?"
H1_REP="?"
if [ -f "$WORKSPACE/memory/at-a-glance.md" ]; then
  H1_SECTION=$(sed -n '/📊 H1 Dashboard/,/##/p' "$WORKSPACE/memory/at-a-glance.md")
  H1_OPEN=$(echo "$H1_SECTION" | grep -oP '\| Open\s*\|\s*\K\d+' | head -1 || echo "?")
  H1_SIGNAL=$(echo "$H1_SECTION" | grep -oP 'Signal\s*\|\s*\K[-0-9.]+' | head -1 || echo "?")
  H1_REP=$(echo "$H1_SECTION" | grep -oP 'Reputation\s*\|\s*\K\d+' | head -1 || echo "?")
fi

# ── Cron agent health (from last known state) ──
PORTER_ERR=0; EDWIN_ERR=0
grep -q '"lastRunStatus":"error"' "$WORKSPACE/memory/state/heartbeat-state.json" 2>/dev/null && EDWIN_ERR=1 || true

cat > "$OUTFILE" << 'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧠</text></svg>">
<title>Alfred Dashboard</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--border:#30363d;--text:#c9d1d9;--muted:#8b949e;--accent:#58a6ff;--green:#3fb950;--yellow:#d2991d;--red:#f85149;--purple:#a371f7;--orange:#db6d28}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;max-width:1200px;margin:0 auto}
h1{font-size:1.4em;margin-bottom:2px}
h2{font-size:1.05em;color:var(--accent);margin:28px 0 12px;border-bottom:1px solid var(--border);padding-bottom:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px}
.card h3{font-size:0.9em;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.4px}
.card.wide{grid-column:1/-1}
.metric{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(48,54,61,0.5)}
.metric:last-child{border-bottom:none}
.metric .label{color:var(--muted);font-size:0.85em}
.metric .value{font-weight:600;font-size:0.9em}
.g{color:var(--green)}.y{color:var(--yellow)}.r{color:var(--red)}.p{color:var(--purple)}.o{color:var(--orange)}.a{color:var(--accent)}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.75em;font-weight:600}
.badge-ok{background:#1a3a1a;color:var(--green)}
.badge-warn{background:#3a2a0a;color:var(--yellow)}
.badge-err{background:#3a0a0a;color:var(--red)}
.avatar{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;font-size:0.8em;margin-right:6px;flex-shrink:0;font-weight:700}
.av-otto{background:#2a1a4a;color:var(--purple)}.av-viktor{background:#1a3a2a;color:var(--green)}.av-scout{background:#3a2a0a;color:var(--orange)}
.av-cortex{background:#1a2a3a;color:var(--accent)}.av-hugo{background:#2a1a2a;color:#d2a8ff}.av-edwin{background:#2a3a1a;color:#7ee787}
.av-porter{background:#3a1a2a;color:#ff7b72}.av-alfred{background:#1a1a3a;color:#79c0ff}
.blindspots{font-size:0.8em;color:var(--yellow);line-height:1.6;word-break:break-all}
.timestamp{color:var(--muted);font-size:0.78em;margin-top:32px;padding-top:16px;border-top:1px solid var(--border);text-align:center}
@media(max-width:600px){body{padding:12px}.grid{grid-template-columns:1fr;gap:10px}}
</style>
</head>
<body>
<h1>🧠 Alfred Dashboard</h1>
<p style="color:var(--muted);font-size:0.85em">OpenClaw Operations Center · HOSTPLACEHOLDER</p>

<h2>🖥️ System</h2>
<div class="grid">
  <div class="card"><h3>Host</h3>
    <div class="metric"><span class="label">Machine</span><span class="value">HOSTNAMEVAL</span></div>
    <div class="metric"><span class="label">Uptime</span><span class="value">UPTIMEVAL</span></div>
  </div>
  <div class="card"><h3>Resources</h3>
    <div class="metric"><span class="label">Disk /</span><span class="value">DISKVAL</span></div>
    <div class="metric"><span class="label">RAM</span><span class="value">MEMVAL</span></div>
  </div>
  <div class="card"><h3>Memory</h3>
    <div class="metric"><span class="label">Files</span><span class="value">MEMFILESVAL</span></div>
    <div class="metric"><span class="label">Daily logs</span><span class="value">DAILYLOGSVAL</span></div>
    <div class="metric"><span class="label">Last log</span><span class="value a">LASTDAILYVAL</span></div>
  </div>
</div>

<h2>🤖 Agents</h2>
<div class="grid">
  ALFREDCARD
  VIKTORCARD
  SCOUTCARD
  OTTOCARD
  HUGOCARD
  CORTEXCARD
  PORTERCARD
  EDWINCARD
</div>

<h2>🧠 Viktor Training Pipeline</h2>
<div class="grid">
  <div class="card"><h3>Overview</h3>
    <div class="metric"><span class="label">Total done</span><span class="value g">PIPETOTAL repos</span></div>
    <div class="metric"><span class="label">Avg recall (L10)</span><span class="value g">PIPERECALL%</span></div>
    <div class="metric"><span class="label">Pending</span><span class="value y">PIPEPENDING</span></div>
    <div class="metric"><span class="label">Failed (0/n recall)</span><span class="value r">PIPEFAILED</span></div>
    <div class="metric"><span class="label">Neg-test pending</span><span class="value">PIPEPENDINGNEG</span></div>
    <div class="metric"><span class="label">Circuit</span><span class="value">CIRCUITBADGE</span></div>
  </div>
  <div class="card"><h3>Quality Control</h3>
    <div class="metric"><span class="label">Negative tests done</span><span class="value">PIPENEGDONE</span></div>
    <div class="metric"><span class="label">False positives</span><span class="value">PIPENEGFP</span></div>
    <div class="metric"><span class="label">Transfer tests</span><span class="value">PIPETRANSFER</span></div>
    <div class="metric"><span class="label">H1 submitted</span><span class="value">PIPEH1SUB</span></div>
    <div class="metric"><span class="label">H1 accepted</span><span class="value g">PIPEH1ACC</span></div>
  </div>
  <div class="card wide"><h3>⚠️ CWE Blind Spots</h3>
    <p class="blindspots">PIPEBLIND</p>
  </div>
</div>

<h2>🏴 HackerOne</h2>
<div class="grid">
  <div class="card"><h3>Stats</h3>
    <div class="metric"><span class="label">Open reports</span><span class="value y">H1OPENVAL</span></div>
    <div class="metric"><span class="label">Signal</span><span class="value">H1SIGNALVAL</span></div>
    <div class="metric"><span class="label">Reputation</span><span class="value">H1REPVAL</span></div>
  </div>
  <div class="card"><h3>Active Programs</h3>
    <div style="font-size:0.83em;line-height:1.6">
      <p>📌 <strong>Matomo</strong> — OAuth2 PKCE</p>
      <p class="y">📌 Chainlink — ConfidentialRelay</p>
      <p class="y">📌 GlotPress — XXE</p>
      <p class="a">🔍 Agoda — next scout</p>
    </div>
  </div>
  <div class="card"><h3>Reports</h3>
    <div class="metric"><span class="label">Accepted ($)</span><span class="value g">1 ($50)</span></div>
    <div class="metric"><span class="label">Duplicate</span><span class="value y">12</span></div>
    <div class="metric"><span class="label">N/A</span><span class="value">3</span></div>
    <div class="metric"><span class="label">Total</span><span class="value">18</span></div>
  </div>
</div>

<h2>📋 Projects</h2>
<div class="grid">
  <div class="card"><h3>Active</h3>
    <div class="metric"><span class="label">Viktor AR Pipeline</span><span class="value g">37 repos</span></div>
    <div class="metric"><span class="label">H1 Bug Bounty</span><span class="value y">2 open</span></div>
    <div class="metric"><span class="label">Dashboard</span><span class="value p">v1 live</span></div>
    <div class="metric"><span class="label">Cortex Opt</span><span class="value">Run #1</span></div>
  </div>
  <div class="card"><h3>Pending / Stalled</h3>
    <div class="metric"><span class="label">Sparkl</span><span class="value r">Stalled (Play Console)</span></div>
    <div class="metric"><span class="label">Cortex P2/P4</span><span class="value y">Decision needed</span></div>
    <div class="metric"><span class="label">P3 neg-test spawn</span><span class="value y">Waiting approval</span></div>
  </div>
  <div class="card"><h3>Work (air-gap)</h3>
    <div class="metric"><span class="label">RCA/ECK</span><span class="value">e-cégkapu</span></div>
    <div class="metric"><span class="label">Perbit</span><span class="value">—</span></div>
    <div class="metric"><span class="label">ITM Planning</span><span class="value">—</span></div>
    <div class="metric"><span class="label">Kiber-kóstoló</span><span class="value">—</span></div>
  </div>
</div>

<p class="timestamp">Generated: NOWPLACEHOLDER · Auto-refresh: 5min</p>
</body>
</html>
HTML

# ── Agent cards ──
ALFRED_CARD="<div class=\"card\"><h3><span class=\"avatar av-alfred\">A</span> Alfred 👔 — Chief of Staff</h3><div class=\"metric\"><span class=\"label\">Role</span><span class=\"value\">Orchestration + decision-making</span></div><div class=\"metric\"><span class=\"label\">Session</span><span class=\"value g\">Active</span></div></div>"
VIKTOR_CARD="<div class=\"card\"><h3><span class=\"avatar av-viktor\">V</span> Viktor 🛡️ — Security Analyst</h3><div class=\"metric\"><span class=\"label\">Repos audited</span><span class=\"value g\">$PIPE_total</span></div><div class=\"metric\"><span class=\"label\">Avg recall</span><span class=\"value g\">$PIPE_recall%</span></div><div class=\"metric\"><span class=\"label\">Neg tests</span><span class=\"value\">$PIPE_negDone done</span></div></div>"
SCOUT_CARD="<div class=\"card\"><h3><span class=\"avatar av-scout\">S</span> Scout 🏕️ — Intel</h3><div class=\"metric\"><span class=\"label\">Last intel</span><span class=\"value a\">$(h "$SCOUT_LATEST")</span></div><div class=\"metric\"><span class=\"label\">Target</span><span class=\"value g\">Matomo OAuth2</span></div></div>"
OTTO_CARD="<div class=\"card\"><h3><span class=\"avatar av-otto\">O</span> Otto 🗄️ — Back Office</h3><div class=\"metric\"><span class=\"label\">Role</span><span class=\"value\">Nightly compilation + KG</span></div><div class=\"metric\"><span class=\"label\">Schedule</span><span class=\"value\">03:00 + 03:35</span></div></div>"
HUGO_CARD="<div class=\"card\"><h3><span class=\"avatar av-hugo\">H</span> Hugo 📚 — Repo Prep</h3><div class=\"metric\"><span class=\"label\">Role</span><span class=\"value\">GitHub Advisory → answer keys</span></div><div class=\"metric\"><span class=\"label\">Schedule</span><span class=\"value\">20:00 nightly</span></div></div>"
CORTEX_CARD="<div class=\"card\"><h3><span class=\"avatar av-cortex\">C</span> Cortex 🧠 — Optimizer</h3><div class=\"metric\"><span class=\"label\">Last run</span><span class=\"value a\">$(h "$CORTEX_LATEST")</span></div><div class=\"metric\"><span class=\"label\">Schedule</span><span class=\"value\">04:30 /3d</span></div></div>"
PORTER_CARD="<div class=\"card\"><h3><span class=\"avatar av-porter\">P</span> Porter 🚪 — Email Triage</h3><div class=\"metric\"><span class=\"label\">Schedule</span><span class=\"value\">06–23 hourly</span></div></div>"
EDWIN_CARD="<div class=\"card\"><h3><span class=\"avatar av-edwin\">E</span> Edwin 🚀 — Jarvis Driver</h3><div class=\"metric\"><span class=\"label\">Role</span><span class=\"value\">Events + monitoring</span></div><div class=\"metric\"><span class=\"label\">Schedule</span><span class=\"value\">09:00 daily</span></div></div>"

# ── Circuit badge ──
if [ "$PIPE_tripped" = "TRIPPED" ]; then
  CIRCUIT_BADGE='<span class="badge badge-err">TRIPPED</span>'
else
  CIRCUIT_BADGE='<span class="badge badge-ok">Normal</span>'
fi

# ── Replace placeholders ──
sed -i \
  -e "s|HOSTPLACEHOLDER|$(h "$HOSTNAME")|" \
  -e "s|HOSTNAMEVAL|$(h "$HOSTNAME")|" \
  -e "s|UPTIMEVAL|$(h "$UPTIME")|" \
  -e "s|DISKVAL|$(h "$DISK")|" \
  -e "s|MEMVAL|$(h "$MEM")|" \
  -e "s|MEMFILESVAL|$MEM_FILES|" \
  -e "s|DAILYLOGSVAL|$DAILY_LOGS|" \
  -e "s|LASTDAILYVAL|$(h "$LAST_DAILY")|" \
  -e "s|NOWPLACEHOLDER|$(h "$NOW")|" \
  -e "s|H1OPENVAL|$(h "$H1_OPEN")|" \
  -e "s|H1SIGNALVAL|$(h "$H1_SIGNAL")|" \
  -e "s|H1REPVAL|$(h "$H1_REP")|" \
  -e "s|PIPETOTAL|$PIPE_total|" \
  -e "s|PIPERECALL|$PIPE_recall|" \
  -e "s|PIPEPENDING|$PIPE_pending|" \
  -e "s|PIPEFAILED|$PIPE_failed|" \
  -e "s|PIPEPENDINGNEG|$PIPE_pendingNeg|" \
  -e "s|PIPENEGDONE|$PIPE_negDone|" \
  -e "s|PIPENEGFP|$PIPE_negFP|" \
  -e "s|PIPETRANSFER|$PIPE_transfer|" \
  -e "s|PIPEH1SUB|$PIPE_h1Submitted|" \
  -e "s|PIPEH1ACC|$PIPE_h1Accepted|" \
  -e "s|CIRCUITBADGE|$CIRCUIT_BADGE|" \
  -e "s|PIPEBLIND|$(h "${PIPE_blind:-—}")|" \
  -e "s|ALFREDCARD|$ALFRED_CARD|" \
  -e "s|VIKTORCARD|$VIKTOR_CARD|" \
  -e "s|SCOUTCARD|$SCOUT_CARD|" \
  -e "s|OTTOCARD|$OTTO_CARD|" \
  -e "s|HUGOCARD|$HUGO_CARD|" \
  -e "s|CORTEXCARD|$CORTEX_CARD|" \
  -e "s|PORTERCARD|$PORTER_CARD|" \
  -e "s|EDWINCARD|$EDWIN_CARD|" \
  "$OUTFILE"

echo "✅ Dashboard: $OUTFILE ($(wc -c < "$OUTFILE") bytes)"
