#!/bin/bash
# Dump cron job status to filesystem for Noema dashboard
# Called by system crontab every 3 minutes to avoid Gateway API timeout in SSR
set -e

# Cron has minimal PATH — use absolute paths
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="$HOME"

OUTDIR="/home/promi/projects/noema/data/cron-state"
mkdir -p "$OUTDIR"

# Dump all cron jobs as JSON
$HOME/.local/bin/openclaw cron list --json 2>/dev/null > "$OUTDIR/_all.json.tmp" && mv "$OUTDIR/_all.json.tmp" "$OUTDIR/_all.json"

# Write individual job status files for per-job dashboard views
python3 -c "
import json, os, sys
try:
    data = json.load(open('$OUTDIR/_all.json'))
    jobs = data.get('jobs', [])
    for job in jobs:
        jid = job.get('id', 'unknown')
        fname = os.path.join('$OUTDIR', f'{jid}.json')
        with open(fname + '.tmp', 'w') as f:
            json.dump(job, f, indent=2)
        os.rename(fname + '.tmp', fname)
    # Write index
    index = {
        'updated': __import__('time').time(),
        'total': len(jobs),
        'enabled': sum(1 for j in jobs if j.get('enabled')),
        'errors': sum(1 for j in jobs if j.get('lastRunStatus') == 'error'),
        'disabled': sum(1 for j in jobs if not j.get('enabled'))
    }
    with open('$OUTDIR/_index.json.tmp', 'w') as f:
        json.dump(index, f)
    os.rename('$OUTDIR/_index.json.tmp', '$OUTDIR/_index.json')
    print(f'Dumped {len(jobs)} cron jobs')
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null
