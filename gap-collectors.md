# GAP SCAN: Data Collectors & Server

**Date:** 2026-08-02
**Auditor:** Alfred
**Scope:** `src/lib/core/` (26 files), `src/lib/server/` (4 files), `src/hooks.server.ts`, `src/lib/providers/openclaw.ts`, SSE endpoints

---

## Summary

| Category | Findings | Severity |
|----------|----------|----------|
| Collectors without timeout | 1 | MEDIUM |
| Collectors without retry | 2 | MEDIUM |
| Collectors without error boundary | 3 | LOW–MEDIUM |
| Hardcoded secrets/URLs | 4 | LOW–HIGH |
| Missing data validation | 8 | MEDIUM |
| Rate limit handling gaps | 3 | MEDIUM |
| SSE endpoint robustness | 5 | MEDIUM–HIGH |
| hooks.server.ts gaps | 2 | LOW |

**Overall:** 28 findings. Most critical: TLS verification disabled, no per-collector timeout, no retry anywhere, no max SSE client cap.

---

## 1. Collectors Without Timeout

### 1.1 `collector.ts:collectOnce()` — no outer timeout

```ts
// src/lib/server/collector.ts:31
async collectOnce() {
  // getProvider() → getAllData() → Promise.all([13 fetches])
  // No timeout wrapping. A hanging Gateway call (e.g. sessions_list)
  // will block the entire collection cycle indefinitely.
}
```

**Impact:** If any collector hangs (e.g. Gateway unresponsive but TCP connection not yet timed out), the 60s cycle stalls. `collectPromise` mutex means no retry until the hung promise resolves/rejects.

**Fix:** Wrap `getAllData(providers)` in `Promise.race` with a timeout (e.g. 20s). The provider layer already has per-call timeouts (`gatewayApi` 10-15s, `runCmd` 30s), but a net-level hang (DNS, TCP connect) can exceed those.

**Severity:** MEDIUM — provider timeouts provide a safety net, but the collector itself has no circuit breaker.

### 1.2 `health.ts:getHealth()` — execCommand timeout inconsistency

```ts
// src/lib/core/health.ts:103-117
await p.tool.execCommand('uptime -p 2>/dev/null')           // no timeout override
await p.tool.execCommand('df -h / | awk ...')               // no timeout override
await p.tool.execCommand('free -h | awk ...')               // no timeout override
```

`execCommand` uses the config `timeoutMs` (default 30s). But these are trivial local shell commands that should complete in <1s. A 30s timeout is excessive — a stuck command blocks the health panel.

**Severity:** LOW — trivial commands rarely hang, but 30s is wasteful.

---

## 2. Collectors Without Retry

### 2.1 Zero retry anywhere in the collection pipeline

```ts
// src/lib/server/collector.ts:44
setInterval(() => {
  void collectOnce();   // If this fails → no retry. Next try: 60s later.
}, COLLECT_INTERVAL_MS);
```

No collector in `src/lib/core/` implements retry. Transient failures (Gateway restart, network blip, file lock) result in 60s of stale data.

**Examples:**
- `getCrons()` — Gateway API call → no retry on failure
- `getAgents()` — Gateway `sessions_list` + `listSubagents` → no retry
- `getCalendar()` — `gogCommand` → no retry
- `getH1Data()` — 3x `h1Command` + memor reads → no retry
- `getHealth()` — 4x `execCommand` + `gatewayHealth` → no retry

**Impact:** Every collection cycle is all-or-nothing for each module. A single Gateway 503 causes a 60s gap.

**Fix:** Add a lightweight retry wrapper in `collector.ts` that retries failed `getAllData` calls 2-3 times with 500ms/1s/2s backoff before giving up.

**Severity:** MEDIUM — 60s staleness is acceptable for a dashboard, but avoidable.

### 2.2 `h1.ts` in-memory cache deduplication is not retry

```ts
// src/lib/core/h1.ts:48-49
if (programsFetchPromise) return programsFetchPromise;
```

This is mutex deduplication (prevents concurrent duplicate API calls), NOT retry. If the first call fails, subsequent calls get the stale cache, not a fresh retry.

**Severity:** LOW — intentional design; stale data > no data. But worth noting.

---

## 3. Collectors With No Error Boundary

### 3.1 `collector.ts:startCollector()` — fire-and-forget, errors silently swallowed

```ts
// src/lib/server/collector.ts:43-45
setInterval(() => {
  void collectOnce();  // Errors in collectOnce are unhandled promises
}, COLLECT_INTERVAL_MS);
```

The `void` operator suppresses the floating promise, but there's no `.catch()` to log errors. If `collectOnce` throws, the error vanishes.

**Fix:** Add `.catch(err => console.error('[noema] collect failed:', err))`.

**Severity:** LOW — SSE clients keep showing last cached data.

### 3.2 `getAllData()` — `Promise.all` with 13 independent fetches

```ts
// src/lib/core/index.ts:37-51
const [crons, agents, health, h1, calendar, bills, research, ...] =
  await Promise.all([...]);
```

Each collector catches its own errors internally, so `Promise.all` rejection is unlikely. However, if one collector's error catch has a bug (e.g. re-throwing), the entire `Promise.all` fails.

**Fix:** Use `Promise.allSettled` instead of `Promise.all` for defense-in-depth.

**Severity:** LOW — individual collectors all have try/catch.

### 3.3 `decision-trace.ts:getDecisionTraceData()` — N concurrent history fetches

```ts
// src/lib/core/decision-trace.ts:325
await Promise.all(
  selected.map(async (session) => {
    traces[session.key] = await getDecisionTrace(session.key, p);
  }),
);
```

Loads up to 15 session histories concurrently. Each history file could be MBs. No concurrency limit, no rate limiting. If Gateway is under load, this can spike memory and CPU.

**Severity:** MEDIUM — only runs on-demand (user clicks Decision Trace tab), not in collector cycle.

### 3.4 `pkg-watcher.ts` — fs.watch error handling incomplete

```ts
// src/lib/server/pkg-watcher.ts:66-69
try {
  watchers.push(watch(INDEX_FILE, onChange));
  watchers.push(watch(PKG_DIR, { recursive: false }, onChange));
} catch (err) {
  stopPkgWatcher();
  console.error("[pkg-watcher] Nem sikerült indítani:", err);
}
```

`fs.watch` can emit `'error'` events on the watcher object itself (e.g. file deleted, permissions change). These are never listened for — only the initial `watch()` call is try/caught.

**Fix:** Add `.on('error', ...)` to each watcher.

**Severity:** LOW — watchers are best-effort convenience.

---

## 4. Hardcoded Secrets/URLs

### 4.1 ⚠️ HIGH: TLS verification disabled for Gateway API

```ts
// src/lib/providers/openclaw.ts:92-93
const prevReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
```

This sets a **process-global** environment variable to disable TLS certificate validation for ALL HTTPS connections in the Node.js process, not just the Gateway call. It's restored after the fetch, but during the fetch window, any concurrent HTTPS request in the same process has TLS verification disabled.

Also used in `gatewayHealth()` (line 359).

**Impact:** If the dashboard handles any outbound HTTPS requests concurrently (unlikely for a local dashboard, but possible in future), they'd have no TLS verification.

**Fix:** Use `https.Agent` with `rejectUnauthorized: false` scoped to the request, not a global env mutation.

**Severity:** HIGH — global TLS disable is a security anti-pattern, even on localhost.

### 4.2 Medium: Hardcoded Gateway URL

```ts
// src/lib/providers/openclaw.ts:48
const GATEWAY_URL = "http://localhost:18789/tools/invoke";
```

The port 18789 is hardcoded. If Gateway changes ports, all providers break. No env var override like `NOEMA_GATEWAY_URL`.

**Fix:** Add `process.env.NOEMA_GATEWAY_URL ?? "http://localhost:18789/tools/invoke"`.

**Severity:** MEDIUM — Gateway port is stable, but no configurability.

### 4.3 LOW: Hardcoded relay port

```ts
// src/routes/api/action/+server.ts:4
const RELAY = "http://127.0.0.1:18998";
```

Hardcoded relay port. If the relay changes ports, dashboard actions break silently.

**Fix:** `process.env.NOEMA_RELAY_URL ?? "http://127.0.0.1:18998"`.

**Severity:** LOW — relay is internal.

### 4.4 LOW: Hardcoded SSR origin

```ts
// src/lib/core/build-integrity.ts:20-22
export function getSsrOrigin(): string {
  const fromEnv = process.env.ORIGIN ?? process.env.NOEMA_ORIGIN;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const port = process.env.PORT ?? "8080";
  return `http://127.0.0.1:${port}`;
}
```

Defaults to port 8080. While configurable via `ORIGIN`/`PORT`, the fallback is undocumented and could collide in dev.

**Severity:** LOW — env-configurable.

---

## 5. Missing Data Validation

### 5.1 `calendar.ts` — unchecked JSON shape

```ts
// src/lib/core/calendar.ts:14-18
const parsed = JSON.parse(raw) as { events?: CalendarEvent[] } | CalendarEvent[];
const events: CalendarEvent[] = Array.isArray(parsed)
  ? parsed
  : (parsed.events ?? []).map((e) => ({ ... }));
```

If `gog calendar events list --json` changes output format (e.g. nested structure, renamed keys), the parser silently produces broken event objects with empty strings for `title`/`start`/`end`.

**Fix:** Use a Zod or simple runtime validator that logs warnings on unexpected shapes.

**Severity:** MEDIUM — calendar is external dependency (gog CLI).

### 5.2 `bills.ts` — overly broad regex matching

```ts
// src/lib/core/bills.ts:47
if (line.includes("💰") && (line.includes("Ft") || line.includes("maradék") || line.includes("utal"))) {
```

These regex patterns can match unrelated markdown content. No structural validation against the expected table format.

**Severity:** LOW — reads from a file András maintains; format drift is unlikely but possible.

### 5.3 `noema.ts:parseChangelog()` — regex splitting fragile

```ts
// src/lib/core/noema.ts:104
const entries = content.split(/^## (\d{4}-\d{2}-\d{2})/gm);
```

If CHANGELOG.md uses a different heading format (e.g. `## v1.2.3 - 2026-08-02`), the regex fails. Silently returns "—".

**Severity:** LOW — internal file, but common format drift risk.

### 5.4 `dev-loop-log.ts:parsePackageIndex()` — narrow regex

```ts
// src/lib/core/dev-loop-log.ts:281
const match = line.match(/^\|\s*(PKG-\d{3})\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
```

If INDEX.md adds columns or changes order, ALL packages silently disappear from the Noema tab.

**Fix:** Emit a warning when 0 packages parsed from a non-empty INDEX.md.

**Severity:** MEDIUM — INDEX.md is machine-generated but format changes = broken tab.

### 5.5 `health.ts` — shell command output parsing is fragile

```ts
// src/lib/core/health.ts:106-117
'df -h / | awk \'NR==2{print $5" used ("$3"/"$2")"}\''
'free -h | awk \'NR==2{printf "%s used / %s total", $3, $2}\''
```

Locale-dependent output (`df -h` can vary by system locale). No validation that output matches expected format.

**Severity:** LOW — runs on a known system. But `LC_ALL=C` prefix would make it locale-safe.

### 5.6 `h1.ts:parseH1FromAtAGlance()` — regex fallback chain

```ts
// src/lib/core/h1.ts:182-210
const open = h1Section.match(/\|\s*Open\s*\|\s*(\d+)/)?.[1]
  ?? h1Section.match(/(\d+)\s+Open/)?.[1]
  ?? atAGlance.match(/(\d+)\s+Open/)?.[1]
  ?? "?";
```

Multiple fallback regex attempts on unstructured markdown. If the at-a-glance.md format changes, all fall through to "?". No warning that parsing degraded.

**Severity:** MEDIUM — this is the primary H1 data source; silent degradation means stale dashboard.

### 5.7 `decision-trace.ts:parseHistoryMessages()` — message format brittleness

```ts
// src/lib/core/decision-trace.ts:104-170
// Handles: tool.call/tool.result trajectory format
//         assistant/toolResult content block format
//         toolUse/toolResult Anthropic-style format
```

Three different message parsing paths depending on role/content shape. If OpenClaw changes its session serialization format, all three paths could fail differently.

**Fix:** Version the session format or add format detection with warnings.

**Severity:** LOW — on-demand only, not in collector cycle.

### 5.8 `logs.ts:parseTailOutput()` — relies on `tail` command format

```ts
// src/lib/core/logs.ts:83
const SOURCE_MARKER = /^==>\s+(.+?)\s+<==$/;
```

If `tail` output format changes (e.g. different OS, different tail version), source detection breaks. All lines get `source: undefined`.

**Severity:** LOW — local system, stable tool.

---

## 6. Rate Limit Handling Gaps

### 6.1 No rate limiting on Gateway API calls

The collector cycle fires `Promise.all` with all 13 modules simultaneously. This means:
- `sessions_list` (limit: 500) + `listCrons` + `listSubagents` all hit Gateway at once

Gateway has no rate limiting built in, but this burst pattern means:
1. If any call times out, the entire `Promise.all` waits
2. No backpressure — if Gateway is slow, we just add more load

**Fix:** Use a concurrency-limited `Promise.all` with max 4-5 concurrent Gateway calls, or add a per-Gateway rate limiter in `openclaw.ts`.

**Severity:** MEDIUM — Gateway is local; unlikely to be overwhelmed. But defense-in-depth missing.

### 6.2 `h1.ts` — no rate limiting on HackerOne API calls

```ts
// getH1Data() fires concurrently:
getH1Balance(p)    // → h1.sh balance
getH1ReportsRaw(p) // → h1.sh my-reports
getH1Programs(p)   // → h1.sh programs
```

HackerOne API has rate limits. No backoff, no retry-after handling. If H1 returns 429, all three calls fail simultaneously.

**Fix:** Add a 429 handler in the `h1Command` wrapper that respects `Retry-After`.

**Severity:** MEDIUM — H1 rate limits are generous, but when hit, dashboard goes blank for an hour.

### 6.3 `decision-trace.ts` — concurrent session history reads

```ts
// src/lib/core/decision-trace.ts:325
await Promise.all(selected.map(s => getDecisionTrace(s.key, p)));
```

Reads up to 15 session JSONL files concurrently. Each file can be 500KB-2MB. No concurrency cap. This is on-demand, not in collector, but could spike I/O.

**Severity:** LOW — on-demand only.

---

## 7. SSE Endpoint Robustness

### 7.1 🔴 HIGH: No max client limit

```ts
// src/lib/server/sse.ts:5
const clients = new Set<SseSendFn>();
```

An attacker (or buggy client) can open thousands of SSE connections. Each connection holds memory (controller, ping timer, encoder). No cap.

**Fix:** Add `MAX_CLIENTS = 100` and reject new connections.

**Severity:** HIGH — trivial DoS vector.

### 7.2 MEDIUM: No per-client heartbeat tracking

```ts
// src/lib/server/sse.ts:14-17
export function broadcast(data: DashboardData): void {
  for (const send of [...clients]) {
    try { send(data); } catch { clients.delete(send); }
  }
}
```

Dead clients are only detected when `send()` throws during broadcast. If no broadcast happens for a while (e.g. collector is stuck), dead clients accumulate memory.

**Fix:** Track last successful send per client. Periodically prune clients with no successful sends in `> 2 * PING_MS`.

**Severity:** MEDIUM — collector runs every 60s, so dead clients are cleaned within 60s.

### 7.3 MEDIUM: `JSON.stringify` blocking on large payload

```ts
// src/routes/api/events/+server.ts:9
function formatEvent(data: DashboardData): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}
```

`DashboardData` can be ~100-200KB (especially with log entries, session histories in decision traces). `JSON.stringify` is synchronous and can block the event loop for 5-20ms per broadcast × N clients.

If 50 clients are connected, that's 50 × 10ms = 500ms of blocking per broadcast cycle.

**Fix:** Consider incremental updates (SSE patches) or compress payload.

**Severity:** MEDIUM — only problematic at scale (>20 clients).

### 7.4 LOW: No CORS headers on SSE endpoint

```ts
// src/routes/api/events/+server.ts:36-41
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  },
});
```

No `Access-Control-Allow-Origin` header. Since the dashboard is same-origin (SvelteKit serves both HTML and API), this is fine today. But if the dashboard is ever served on a different port/domain, SSE will fail with CORS errors.

**Severity:** LOW — same-origin today.

### 7.5 LOW: No `Last-Event-ID` support

The SSE endpoint doesn't handle the `Last-Event-ID` header. On reconnect, the client gets the current cache (which is good), but if data changed between disconnect and reconnect, events are lost.

**Severity:** LOW — 60s collector cycle makes missed events rare.

---

## 8. hooks.server.ts Gaps

### 8.1 No graceful shutdown

```ts
// src/hooks.server.ts:7-12
if (!serverServicesStarted) {
  serverServicesStarted = true;
  startCollector();  // Starts setInterval + fs.watch
  startPkgWatcher(); // Starts fs.watch
}
```

When SvelteKit shuts down:
- The `setInterval` from `startCollector()` leaks — timer keeps running on a dead server
- `fs.watch` watchers leak — file handles stay open
- No `process.on('SIGTERM', ...)` or SvelteKit shutdown hook

**Fix:** Register cleanup in a shutdown hook:
```ts
// In hooks.server.ts or app.d.ts
process.on('SIGTERM', () => { stopCollector(); stopPkgWatcher(); });
// Or use SvelteKit's built-in shutdown via server hooks (Kit 2.x)
```

**Severity:** LOW — server restarts via systemd kill the process, so leaks are short-lived.

### 8.2 No startup health verification

```ts
// src/hooks.server.ts:10-11
startCollector();
startPkgWatcher();
```

Both are started fire-and-forget. If `startCollector()` fails (e.g. Gateway unreachable), the dashboard loads with empty/fallback data and no alert. The user only discovers the issue by looking at empty widgets.

**Fix:** Log startup status explicitly; consider a small /api/health endpoint that checks collector readiness.

**Severity:** LOW — errors are visible in dashboard UI (empty widgets, "No data" errors).

---

## 9. Additional Findings

### 9.1 `openclaw.ts:gatewayApi()` — error message may contain token

```ts
// src/lib/providers/openclaw.ts:109-112
throw new Error(
  json?.error?.message ?? `Gateway API failed (${res.status})`,
);
```

Only Gateway error messages are exposed. The token is sent via `Authorization` header, not in the URL or body, so it's not leaked. But the error message includes raw status — fine.

**Severity:** NONE — verified safe.

### 9.2 `collector.ts` — race condition on `collectPromise`

```ts
// src/lib/server/collector.ts:14
if (collectPromise) return collectPromise;
```

Two rapid calls to `collectOnce()` within the same tick will share the same promise. This is intentional (dedup). But the first call sets `collectPromise`, and the second returns it immediately. If the first call's provider layer is slow, the second caller gets the Promise and awaits — fine.

**Severity:** NONE — this is correct mutex behavior.

### 9.3 `build-integrity.ts` — mutable module-level state

```ts
// src/lib/core/build-integrity.ts:156
let consecutiveSsrFailures = 0;
```

Module-level mutable state that persists across requests in SSR. If multiple requests hit the SSR health check simultaneously, the counter could be incremented multiple times for a single failure. Not a serious bug (worst case: alert fires slightly too early), but not thread-safe.

**Severity:** LOW — single-threaded Node.js, but concurrent requests via async interleaving could race.

### 9.4 `cache.ts` / `sse.ts` — no expiration on in-memory cache

```ts
// src/lib/server/cache.ts:8-10
export function setCache(data: DashboardData): void {
  cache = data;
  cacheAt = Date.now();
}
```

`cacheAt` is set but never used for TTL checking. The cache is only invalidated by the next `setCache` call. If the collector stops running (e.g. crash), SSE clients get the same stale data forever with no indication of staleness.

**Fix:** Add TTL check in `getCache()` — return `null` if `Date.now() - cacheAt > 2 * COLLECT_INTERVAL_MS`.

**Severity:** LOW — collector is reliable.

---

## Priority Ranking

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 🔴 P0 | 7.1 No max SSE client limit | 5 min | DoS vulnerability |
| 🔴 P0 | 4.1 Global TLS disable | 15 min | Security anti-pattern |
| 🟡 P1 | 1.1 No per-collector timeout | 10 min | Hung collector = stale dashboard |
| 🟡 P1 | 2.1 Zero retry on collection failure | 20 min | Transient failures = 60s gap |
| 🟡 P1 | 9.4 No cache TTL check | 5 min | Stale data silently served |
| 🟡 P1 | 7.3 JSON.stringify blocking | 30 min | Scale bottleneck |
| 🟠 P2 | 6.1 No Gateway call concurrency limit | 15 min | Burst pressure on Gateway |
| 🟠 P2 | 6.2 H1 API rate limit handling | 20 min | API 429 = blank H1 tab |
| 🟠 P2 | 5.4 INDEX.md parsing brittle | 10 min | Silent feature breakage |
| 🟠 P2 | 3.2 Promise.all → allSettled | 5 min | Defense in depth |
| 🟢 P3 | 3.3 N concurrent history reads | 10 min | On-demand only |
| 🟢 P3 | 7.2 SSE dead client tracking | 15 min | Self-healing in 60s |
| 🟢 P3 | 8.1 No graceful shutdown | 15 min | Process cleanup |
| 🟢 P3 | 4.2/4.3 Hardcoded URLs | 10 min | Configurability |
| 🟢 P3 | 5.x Various validation gaps | 30 min | Format drift hardening |
| 🟢 P3 | 3.4 fs.watch error events | 5 min | Edge case |

---

## Recommended Quick Wins (Today)

1. **Add `MAX_CLIENTS = 100` to `sse.ts`** — 1 line
2. **Replace global `NODE_TLS_REJECT_UNAUTHORIZED` with per-request `https.Agent`** — ~10 lines
3. **Add `.catch()` to `startCollector` interval** — 1 line
4. **Add cache TTL check in `getCache()`** — 3 lines
5. **Wrap `collectOnce` body in `Promise.race(timer)`** — 5 lines

**Total effort:** ~30 min. Eliminates 4 high-severity findings.
