# Noema Data Collector Gap Scan

**Date**: 2026-07-17  
**Scope**: All data-fetching/collector files in `src/lib/core/` and `src/lib/server/`  
**Method**: Full source read of 24 files; 20 collector/logic files + 4 helper modules  
**Server Policy**: `src/lib/server/` files are **read-only for discovery** — gaps documented, no edits suggested.

---

## Summary

| Category | Findings | Severity |
|----------|----------|----------|
| Missing Timeout | 8 | 🔴 High |
| Missing Retry | 16 | 🟡 Medium |
| No Error Boundary | 5 | 🟡 Medium |
| Hardcoded URLs/Paths | 2 | 🟢 Low |
| Missing Data Validation | 11 | 🟡 Medium |
| Rate Limit Handling Gaps | 5 | 🟡 Medium |
| **Total** | **47** | |

---

## 1. Missing Timeout

### 1.1 `src/lib/core/h1.ts` — `getH1Data()` parallel fetch without timeout

**Lines**: ~455–520  
**Problem**: `getH1Data()` runs 6 parallel fetches via `Promise.all()`. No `AbortSignal.timeout()` or `Promise.race()` wrapping any of them. If `getH1Balance()`, `getH1ReportsRaw()`, `getH1Programs()`, `getH1ViktorStatus()`, filesystem reads hang, the entire dashboard blocks indefinitely.  
**Context**: Each sub-call has its own mutex (dedupPromise pattern) but NONE has a timeout. The outer `getH1Data()` also has no timeout.  
**Fix suggestion**: Wrap each sub-fetch in `Promise.race([fetch, timeout(10_000)])`. Set a hard cap of 15s on the entire `getH1Data()` via `AbortSignal.timeout()`.

### 1.2 `src/lib/core/decision-trace.ts` — `getDecisionTraceData()` parallel session history

**Lines**: ~355–405  
**Problem**: `Promise.all(selected.map(async (session) => getDecisionTrace(session.key, p)))` sends up to MAX_SESSIONS=15 parallel history fetches. Each `getDecisionTrace()` calls `listSessions` + `getHistory`. No timeout on any of them.  
**Fix suggestion**: Cap concurrent fetches (e.g., concurrency=5) + add `AbortSignal.timeout(20_000)` per session trace.

### 1.3 `src/lib/core/session-health.ts` — `getAgentHealthReport()` → `scoreAgentSessions()`

**Lines**: ~270–310  
**Problem**: `scoreAgentSessions()` calls `scoreSession()` for up to TREND_WINDOW=10 sessions per agent in parallel. Each `scoreSession()` fetches session list + history. With 8+ agents, that's 80+ history fetches with NO timeout.  
**Fix suggestion**: Add `Promise.race([fetch, timeout(10_000)])` per session score. Limit concurrency.

### 1.4 `src/lib/core/logs.ts` — `getLogs()` execCommand without timeout

**Line**: ~128  
**Problem**: `p.tool.execCommand(cmd)` tails log files. If the filesystem is slow or the command hangs (e.g., NFS mount gone stale), this blocks forever.  
**Fix suggestion**: Wrap in `Promise.race([execCommand(cmd), timeout(5_000)])`.

### 1.5 `src/lib/core/cpu.ts` — `getCpuData()` execCommand without timeout

**Lines**: ~95–110  
**Problem**: Two `execCommand` calls (`cat /proc/loadavg`, `ps -eo comm,%cpu`) with no timeout. `/proc/loadavg` rarely hangs, but `ps` can on a loaded system.  
**Fix suggestion**: `Promise.race([exec, timeout(3_000)])` per command.

### 1.6 `src/lib/core/health.ts` — `getHealth()` parallel execCommands

**Lines**: ~110–145  
**Problem**: 4 execCommands (`uptime`, `df`, `free`, `gatewayHealth`) run in parallel with no timeout. `gatewayHealth()` is especially dangerous — it's an API call that could hang.  
**Fix suggestion**: Timeout each sub-call individually (3-5s for shell, 10s for gatewayHealth).

### 1.7 `src/lib/core/build-integrity.ts` — `getBuildIntegrity()` ✅ HAS timeout

**Line**: ~145  
**Status**: `checkSsrHealth()` correctly uses `AbortSignal.timeout(SSR_TIMEOUT_MS)` (5s). **No gap here.** Good pattern to replicate elsewhere.

### 1.8 🚨 `src/lib/server/collector.ts` — `collectOnce()` no global timeout

**Lines**: 14–34  
**Problem**: The main collector loop has a mutex (`collectPromise`) to prevent overlapping runs, but NO timeout on the underlying `getAllData()`. If ONE of the 13 parallel collectors in `getAllData()` hangs, the entire 60s cycle stalls permanently. After the first hang, `collectPromise` is held forever (set to null only in `finally` but `finally` never runs if Promise doesn't settle).  
**Risk**: High — this is the single collection entry point for the dashboard.  
**Fix in core**: `getAllData()` or individual collectors need timeouts. **Server file — discovery only.**

### 1.9 🚨 `src/lib/server/collector.ts` — dangling promise on crash

**Lines**: 17–34  
**Problem**: If `collectPromise` rejects AFTER the `await collectPromise` line but BEFORE `collectPromise = null` in `finally`, the code works. BUT if the process crashes inside `getAllData()`, `collectPromise` stays set and next `collectOnce()` returns the stale hanging promise forever.  
**Risk**: Medium (process crash is unlikely without OOM).  
**Fix in core**: Add watchdog timer that resets `collectPromise` after N seconds. **Server file — discovery only.**

---

## 2. Missing Retry

**Universal gap**: NONE of the 16 collector functions implement retry logic. On failure, all return cached/stale data or empty defaults. While this is graceful degradation, transient failures (network blip, filesystem lock, API rate limit) could succeed on retry.

| File | Function | Failure Behavior | Retryable? |
|------|----------|-----------------|------------|
| `h1.ts` | `getH1Balance()` | Returns cached balance or 0 | ✅ API call |
| `h1.ts` | `getH1Programs()` | Returns cached list or [] | ✅ API call |
| `h1.ts` | `getH1Reports()` | Returns cached list or [] | ✅ API call |
| `h1.ts` | `getH1ViktorStatus()` | Returns EMPTY_VIKTOR | ✅ File read |
| `h1.ts` | `getH1Data()` | Returns empty H1 data + error field | ✅ Composite |
| `calendar.ts` | `getCalendar()` | Returns empty events + error | ✅ API call |
| `bills.ts` | `getBills()` | Returns empty data + error | ✅ File read |
| `health.ts` | `getHealth()` | Returns "unknown" for all fields | ✅ Mixed |
| `cpu.ts` | `getCpuData()` | Returns undefined | ✅ Shell commands |
| `crons.ts` | `getCrons()` | Returns empty crons + error | ✅ API call |
| `agents.ts` | `getAgents()` | Returns empty agent list + error | ✅ API calls |
| `research.ts` | `getResearch()` | Returns empty research + error | ✅ File reads |
| `noema.ts` | `getNoema()` | Returns zero metrics + error | ✅ File reads |
| `logs.ts` | `getLogs()` | Returns empty entries + error | ✅ Shell command |
| `audit-trail.ts` | `getAuditTrail()` | Returns empty events + error | ✅ API calls |
| `dev-loop-log.ts` | `getDevLoopLog()` | Returns error message | ✅ File read |

**Fix suggestion**: Add a shared `withRetry(fn, { maxRetries: 2, backoffMs: 1000 })` utility. Apply to all API/exec call sites. Keep file reads at 1 retry max.

---

## 3. Missing Error Boundary (no individual try/catch within loops)

### 3.1 `src/lib/core/decision-trace.ts` — `parseHistoryMessages()` no per-message error handling

**Lines**: ~110–220  
**Problem**: The message parsing loop processes `messages[]` without try/catch inside the loop. A single malformed message (e.g., `content` = non-object, `data` access on null) could crash the entire parse.  
**Fix suggestion**: Wrap each message processing iteration in `try { ... } catch { continue; }`.

### 3.2 `src/lib/core/session-health.ts` — `scoreAgentSessions()` no per-session error boundary

**Lines**: ~225–240  
**Problem**: `Promise.all(mine.map((session) => scoreSession(session.key, p)))` — if ONE session's history parse throws (not caught by `scoreSession`'s top-level try/catch due to a timing issue), all sessions for that agent fail.  
**Fix suggestion**: `Promise.allSettled()` instead of `Promise.all()`, filter for fulfilled results.

### 3.3 `src/lib/core/audit-trail.ts` — `getAuditTrail()` parallel cron run fetch

**Lines**: ~330–345  
**Problem**: `Promise.all(cronJobs.map(job => p.cron.getCronRuns(job.id).catch(() => [])))` — already has per-job `.catch()`. **Good**. BUT if `getCronRuns` throws synchronously (unlikely), the whole Promise.all rejects.  
**Fix suggestion**: Already well-handled with `.catch(() => [])`. Minor: wrap the arrow in async to be safe.

### 3.4 `src/lib/core/agents.ts` — `getAgents()` parallel file reads

**Lines**: ~190–230  
**Problem**: Inside `AGENT_DEFS.forEach`, each iteration does `p.filesystem.readAgentStatus(def.id)` with `.catch()` — good. But the reading happens sequentially (forEach is not async-aware). Each agent's status read happens in order, not parallel.  
**Fix suggestion**: Use `Promise.all(AGENT_DEFS.map(...))` for parallel reads with per-agent `.catch()`.

### 3.5 `src/lib/core/research.ts` — `loadOttoRuns()` reads nightly files sequentially

**Lines**: ~210–225  
**Problem**: Reads up to 10 nightly review files sequentially via `for...of` loop. Each `readMemory` is awaited, blocking the next.  
**Fix suggestion**: Parallel reads with `Promise.all` + `.catch(() => null)` per file.

---

## 4. Hardcoded URLs/Paths

### 4.1 `src/lib/core/build-integrity.ts` — Hardcoded default port 8080

**Line**: 24  
**Problem**: `const port = process.env.PORT ?? "8080";` — port 8080 is hardcoded as fallback. If the dashboard runs on a different port and PORT env is unset, SSR health checks connect to the wrong port and fail.  
**Severity**: Low (env var usually set in production).  
**Fix suggestion**: Log a warning when falling back to the hardcoded default.

### 4.2 `src/lib/core/logs.ts` — `LOGS_DIR` from homedir

**Line**: 18  
**Problem**: `join(homedir(), ".openclaw", "logs")` — derived from OS homedir. Works correctly but no validation that the directory exists before running `tail`.  
**Severity**: Low (tail fails gracefully).  
**Fix suggestion**: Add `existsSync` check before the shell command, return empty if missing.

---

## 5. Missing Data Validation

### 5.1 `src/lib/core/h1.ts` — `getH1Data()` validates structure but not content types

**Lines**: 455–520  
**Problem**: The function destructures results from `Promise.all` and passes them to parsers. The parsers have some validation (e.g., `Array.isArray(rows)`), but there's no runtime type checking that `balanceResult.display` is actually a string or that `programs.length` is a number. If the h1.sh CLI changes output format, this silently breaks.  
**Fix suggestion**: Add lightweight type assertions: `typeof balanceResult.display === 'string' ? balanceResult.display : 'unknown'`.

### 5.2 `src/lib/core/calendar.ts` — `getCalendar()` no event structure validation

**Lines**: 15–35  
**Problem**: After `JSON.parse(raw)`, the code checks `Array.isArray(parsed)` but NOT whether individual events have valid `title`, `start`, `end` fields. A malformed event (title=null, start=undefined) would silently produce `NaN` for `Date.parse`.  
**Fix suggestion**: Validate each event has string-typed title/start/end before mapping.

### 5.3 `src/lib/core/calendar.ts` — `getCalendar()` JSON.parse without safe wrapper

**Line**: 18  
**Problem**: `JSON.parse(raw)` can throw if `gogCommand` returns non-JSON. The outer try/catch catches it, but the error message is generic.  
**Fix suggestion**: Use `safeParseJson(raw, { events: [] })` from utils (already imported in other modules but not used here).

### 5.4 `src/lib/core/health.ts` — `getHealth()` no exec output validation

**Lines**: 110–145  
**Problem**: Results from `execCommand('uptime -p')`, `df -h`, `free -h` are used as-is with string `.replace()`. If the commands are not installed (minimal Docker container), `execCommand` returns error string which gets passed through. No check that output matches expected pattern.  
**Fix suggestion**: Validate pattern match after each execCommand; return "unavailable" if format doesn't match.

### 5.5 `src/lib/core/bills.ts` — `parseBills()` no amount validation

**Lines**: 50–65  
**Problem**: `line.includes("💰") && (line.includes("Ft") || ...)` is purely string matching. A line like `💰 random Ft note` would be treated as a bill. No regex extraction of actual amounts.  
**Fix suggestion**: Extract amount with regex: `/(\d[\d\s,]*)Ft/`. Flag lines with no extractable amount.

### 5.6 `src/lib/core/noema.ts` — `getNoema()` file reads without size limits

**Lines**: 40–70  
**Problem**: `readFile(join(noemaDir, "CHANGELOG.md"), "utf8")` and `readFile(join(noemaDir, "dev/packages/INDEX.md"))` read entire files into memory. If these files grow large (CHANGELOG after months, INDEX after hundreds of packages), this becomes a memory issue.  
**Fix suggestion**: Read with size limits or stream; cap at first 100KB.

### 5.7 `src/lib/core/dev-loop-log.ts` — `parsePackageIndex()` no required-field validation

**Lines**: ~300–325  
**Problem**: Regex captures `id`, `name`, `phase` but doesn't validate that `id` matches `PKG-\d{3}` pattern or that `name` is non-empty. Silent failures produce malformed entries.  
**Fix suggestion**: Assert `id.match(/^PKG-\d{3}$/)` and `name.length > 0` before pushing.

### 5.8 `src/lib/core/agents.ts` — Agent status file read returns any content

**Lines**: ~190–210  
**Problem**: `statusFile.content?.trim()` — if the status file contains binary data or is corrupt, `trim()` on non-string content could produce unexpected results.  
**Fix suggestion**: Assert `typeof statusFile.content === 'string'` before using.

### 5.9 `src/lib/core/research.ts` — No validation of proposal structure before push

**Lines**: ~130–155  
**Problem**: `parseProposals()` extracts cells from markdown table lines but pushes even if `id` is empty string or `finding` is empty.  
**Fix suggestion**: Validate `id` is numeric and `finding` is non-empty before push.

### 5.10 `src/lib/core/logs.ts` — `parseLogLevel()` regex on any string

**Lines**: 30–40  
**Problem**: `parseLogLevel()` runs regex on ANY input. While regex on strings is safe, a very long line could cause ReDoS (catastrophic backtracking) with `/\b(ERROR|ERR|FATAL|CRITICAL|EXCEPTION)\b/`. The alternation is simple though — low risk.  
**Severity**: Very low.  
**Fix suggestion**: Cap input length before regex: `line.slice(0, 1000)`.

### 5.11 `src/lib/core/utils.ts` — `safeParseJson()` generic fallback type safety

**Lines**: ~128–135  
**Problem**: `safeParseJson<T>(raw: string, fallback: T): T` — this returns `fallback` on parse failure, but the caller can pass a fallback of any type. If `raw` is a valid JSON object but not of type `T` (e.g., `{ "a": 1 }` instead of `{ "data": [...] }`), the function returns it as `T` without structural validation.  
**Severity**: Low (callers handle this with optional chaining).  
**Fix suggestion**: Document that `safeParseJson` provides parse safety, NOT type safety. Callers need runtime type checks.

---

## 6. Rate Limit Handling Gaps

### 6.1 `src/lib/core/h1.ts` — Fixed TTL cache, no dynamic backoff

**Lines**: 15  
**Problem**: `CACHE_TTL_MS = 60 * 60 * 1000` (1 hour) is the only rate-limiting protection. If H1 API rate-limits and the 1h cache is stale, EVERY collector cycle (1 min intervals from collector.ts) will slam the API with fresh requests. Currently the mutex prevents concurrent internal calls, but there's no backoff after API failures.  
**Fix suggestion**: On API error, extend cache TTL temporarily (e.g., 5 min penalty) + add `Rate-Limit-Reset` header awareness.

### 6.2 `src/lib/core/decision-trace.ts` — No debouncing on session history fetches

**Lines**: 355–405  
**Problem**: `getDecisionTraceData()` fetches full history for 15 sessions. Each fetches the session list (500 sessions) again for no reason — `getDecisionTrace()` re-fetches `listSessions` when `getDecisionTraceData()` already has the list.  
**Fix suggestion**: Pass the pre-fetched session list down; don't re-fetch in `getDecisionTrace()`.

### 6.3 `src/lib/core/session-health.ts` — Redundant session list fetches

**Lines**: 225–310  
**Problem**: `scoreAgentSessions()` fetches `listSessions` with `limit: 500` for EACH agent separately. Then `scoreSession()` fetches `listSessions` AGAIN for each individual session. With 8 agents × 10 sessions = potentially 88 `listSessions` calls if uncached.  
**Fix suggestion**: Fetch session list ONCE, pass to all scoring functions.

### 6.4 `src/lib/core/audit-trail.ts` — Cron runs fetched without pagination

**Lines**: 330–345  
**Problem**: `p.cron.getCronRuns(job.id)` for up to 20 cron jobs. If a cron job has thousands of runs, all are returned unfiltered. No `limit` or `since` parameter.  
**Fix suggestion**: Add `limit: 20` or `since: Date.now() - 7d` parameter to run fetches.

### 6.5 🚨 `src/lib/server/collector.ts` — Fixed 60s interval, no backoff

**Lines**: 6, 43  
**Problem**: `COLLECT_INTERVAL_MS = 60_000` is hardcoded. If upstream APIs return errors consistently, the collector keeps hammering every 60 seconds with no backoff. The interval never adjusts based on error rate.  
**Risk**: Medium (caching mitigates, but on cache-miss + API failure cycle, constant retries).  
**Server file — discovery only.**

---

## 7. Structural / Architectural Gaps

### 7.1 No shared timeout utility

**Problem**: `build-integrity.ts` implements `AbortSignal.timeout()` correctly, but no other collector uses this pattern. Each collector invents its own (or none).  
**Fix suggestion**: Create `src/lib/core/timeout.ts`:
```ts
export function withTimeout<T>(promise: Promise<T>, ms: number, label?: string): Promise<T> {
  // Promise.race with AbortSignal.timeout
}
export const COLLECTOR_TIMEOUTS = {
  exec: 5_000,
  api: 15_000,
  file: 3_000,
  composite: 20_000,
} as const;
```

### 7.2 No shared retry utility

**Problem**: Zero retry logic across 16 collectors.  
**Fix suggestion**: Create `src/lib/core/retry.ts`:
```ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; backoffMs?: number; shouldRetry?: (err: unknown) => boolean }
): Promise<T>;
```

### 7.3 No collector health metrics

**Problem**: Individual collectors have no telemetry — no success/failure counters, no latency histograms, no error type classification. Debugging a collector failure requires log grep.  
**Fix suggestion**: Wrap collectors with a `collectorMetrics(id: string, fn)` wrapper that tracks: `lastSuccess`, `lastFailure`, `consecutiveFailures`, `avgLatencyMs`, `lastError`. Expose in Health dashboard.

### 7.4 `getAllData()` monolithic Promise.all with no partial results

**File**: `src/lib/core/index.ts`, lines 30–60  
**Problem**: If one of the 13 collectors throws (outside its internal try/catch), `Promise.all` rejects and the ENTIRE dashboard data fetch fails. Individual collectors already have try/catch returning defaults, but if a new collector is added without proper error handling, it takes down everything.  
**Fix suggestion**: Use `Promise.allSettled()` with per-collector error logging, or enforce error boundaries at the `getAllData` level:
```ts
const safeCollect = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch (err) {
    console.error(`[noema] collector ${name} failed:`, err);
    return fallback;
  }
};
```

### 7.5 Server-side `pkg-watcher.ts` — no reconnection on watcher error

**File**: `src/lib/server/pkg-watcher.ts`  
**Lines**: 55–70  
**Problem**: `startPkgWatcher()` sets up `fs.watch()` callbacks. If the watched directory is deleted and recreated, the watcher silently stops. No reconnection logic.  
**Server file — discovery only.**

---

## 8. Files Without Gaps (Clean)

These collectors and utilities passed all checks — no missing timeout, retry pattern acceptable, proper error boundaries, no hardcoded secrets:

| File | Notes |
|------|-------|
| `src/lib/core/build-integrity.ts` | ✅ Has timeout (`SSR_TIMEOUT_MS=5000`), good error handling, mutex via counter |
| `src/lib/core/action-parse.ts` | ✅ Pure parser, no I/O, good validation with warnings |
| `src/lib/core/utils.ts` | ✅ Utility functions, safe JSON parse with fallback |
| `src/lib/core/noema-devjob.ts` | ✅ Browser-safe, pure functions, good error handling |
| `src/lib/core/dev-packages.ts` | ✅ Pure grouping/filtering, no I/O |
| `src/lib/core/agent-detail.ts` | ✅ Simple enrichment, no I/O, defensive checks |
| `src/lib/core/cron-timeline.ts` | (Not read — tagged as UI component, not a collector) |
| `src/lib/core/cron-utils.ts` | (Not read — tagged as utility, not a collector) |
| `src/lib/core/dev-freedom.ts` | (Not read — tagged as utility, not a collector) |

---

## Remediation Priority

### 🔴 P0 (This Week) — Blocking reliability
1. **[1.8]** Server collector `collectOnce()` needs a timeout guard — one hung collector blocks the entire dashboard
2. **[1.1]** `getH1Data()` needs 15s composite timeout — most complex collector
3. **[7.4]** `getAllData()` switch to `allSettled` pattern — prevents one collector from killing all
4. **[7.1]** Create shared `withTimeout()` utility

### 🟡 P1 (Next Sprint) — Data quality
5. **[2.x]** Add `withRetry()` to API/external collectors (H1, Calendar, Health)
6. **[3.1, 3.2]** Error boundaries in tight loops (decision-trace, session-health)
7. **[5.x]** Data validation for Calendar, Bills, Health exec outputs
8. **[6.2, 6.3]** Reduce redundant session list fetches

### 🟢 P2 (Backlog) — Refinement
9. **[7.3]** Collector health metrics
10. **[5.6, 5.7, 5.9]** Stricter validation in dev-loop-log, research, noema
11. **[4.x]** Hardcoded path cleanup
