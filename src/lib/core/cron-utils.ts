/**
 * Cron schedule utility functions — ESM version of lib/cron-schedule.cjs
 * Used by SvelteKit SSR components (CJS imports don't work in Vite dev mode).
 */

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseLastRun(lastStr: string | null | undefined): Date | null {
  if (!lastStr || lastStr === '—') return null;
  const m = lastStr.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0);
  const m2 = lastStr.match(/(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (m2) {
    const year = new Date().getFullYear();
    return new Date(year, +m2[1] - 1, +m2[2], +m2[3], +m2[4], 0);
  }
  const d = new Date(lastStr);
  return isNaN(d.getTime()) ? null : d;
}

export function isSpanningSched(sched: string): boolean {
  if (!sched || sched === '—' || sched === 'auto') return false;
  if (/^\d{1,2}-\d{1,2}/.test(sched)) return true;
  if ((sched.match(/,/g) || []).length >= 2) return true;
  if (/every\s+\d+\s*h/i.test(sched)) return true;
  return false;
}

export function parseDisplayMinutes(sched: string): number | null {
  if (!sched || sched === '—' || sched === 'auto') return null;
  const hm = sched.match(/(\d{1,2}):(\d{2})/);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  const range = sched.match(/^(\d{1,2})-/);
  if (range) return parseInt(range[1], 10) * 60;
  const comma = sched.match(/^(\d{1,2}),/);
  if (comma) return parseInt(comma[1], 10) * 60;
  return null;
}

export function computeNextRun(sched: string, lastRunStr: string | null, now: Date = new Date()): number | null {
  if (!sched || sched === '—' || sched === 'auto') return null;
  const nowMs = now.getTime();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (sched.includes('+')) {
    const candidates: number[] = [];
    for (const part of sched.split('+')) {
      const m = part.trim().match(/(\d{1,2}):(\d{2})/);
      if (!m) continue;
      const d = new Date(today);
      d.setHours(+m[1], +m[2], 0, 0);
      if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1);
      candidates.push(d.getTime());
    }
    return candidates.length ? Math.min(...candidates) : null;
  }
  const dayMatch = sched.match(/(\d{1,2}):(\d{2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i);
  if (dayMatch) {
    const targetDay = DAY_NAMES.indexOf(dayMatch[3].toLowerCase().slice(0, 3));
    const d = new Date(now);
    d.setHours(+dayMatch[1], +dayMatch[2], 0, 0);
    let daysAhead = (targetDay - d.getDay() + 7) % 7;
    if (daysAhead === 0 && d.getTime() <= nowMs) daysAhead = 7;
    d.setDate(d.getDate() + daysAhead);
    return d.getTime();
  }
  const intervalMatch = sched.match(/(\d{1,2}):(\d{2})\s+\/(\d+)d/);
  if (intervalMatch) {
    const h = +intervalMatch[1], min = +intervalMatch[2], intervalDays = +intervalMatch[3];
    let base = new Date(today);
    base.setHours(h, min, 0, 0);
    const last = parseLastRun(lastRunStr);
    if (last) base = new Date(last.getTime() + intervalDays * 86400000);
    while (base.getTime() <= nowMs) base.setDate(base.getDate() + intervalDays);
    return base.getTime();
  }
  const everyMatch = sched.match(/every\s+(\d+)\s*h/i);
  if (everyMatch) {
    const intervalMs = +everyMatch[1] * 3600000;
    const last = parseLastRun(lastRunStr);
    if (last) { let next = last.getTime() + intervalMs; while (next <= nowMs) next += intervalMs; return next; }
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    const step = +everyMatch[1];
    const aligned = d.getHours() - (d.getHours() % step) + step;
    d.setHours(aligned, 0, 0, 0);
    if (d.getTime() <= nowMs) d.setTime(d.getTime() + intervalMs);
    return d.getTime();
  }
  const rangeHourly = sched.match(/^(\d{1,2})-(\d{1,2})\s+hourly/i);
  if (rangeHourly) {
    const start = +rangeHourly[1], end = +rangeHourly[2], h = now.getHours();
    if (h >= start && h < end) {
      const d = new Date(now);
      d.setMinutes(0, 0, 0);
      d.setHours(h + 1);
      if (d.getHours() > end) { const t = new Date(today); t.setDate(t.getDate() + 1); t.setHours(start, 0, 0, 0); return t.getTime(); }
      return d.getTime();
    }
    const t = new Date(today);
    if (h >= end) t.setDate(t.getDate() + 1);
    t.setHours(start, 0, 0, 0);
    return t.getTime();
  }
  if (/^\d{1,2}(,\d{1,2})+$/.test(sched.trim())) {
    return Math.min(...sched.split(',').map(hr => { const d = new Date(today); d.setHours(+hr.trim(), 0, 0, 0); if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1); return d.getTime(); }));
  }
  const hm = sched.match(/(\d{1,2}):(\d{2})/);
  if (hm) { const d = new Date(today); d.setHours(+hm[1], +hm[2], 0, 0); if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1); return d.getTime(); }
  return null;
}

export function formatCountdown(nextMs: number | null, nowMs: number = Date.now()): string {
  if (!nextMs) return '—';
  const diff = nextMs - nowMs;
  if (diff < 0) return 'overdue';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60), rem = mins % 60;
  if (hrs < 24) return rem ? `in ${hrs}h ${rem}m` : `in ${hrs}h`;
  const days = Math.floor(hrs / 24), remHrs = hrs % 24;
  return remHrs ? `in ${days}d ${remHrs}h` : `in ${days}d`;
}

export function formatTimeLabel(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
}

export function formatClock(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

export function cronPeriod(mins: number): string {
  if (mins >= 9999) return 'auto';
  if (mins < 360) return 'night';
  if (mins < 480) return 'morning';
  if (mins < 1080) return 'day';
  return 'evening';
}
