# QA Audit: Core Logic & Providers — Noema Dashboard
**Auditor**: Nova (QA subagent)  
**Date**: 2026-08-01  
**Scope**: `src/lib/core/` (24 files), `src/lib/providers/` (4 files), `src/lib/types/` (1 file)  
**Excluded**: `src/lib/stores/` (doesn't exist — zero Svelte stores), `src/lib/providers/types.ts` (provider interface — report only)  
**Total LOC analyzed**: ~6,735 TypeScript lines

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 1 |
| 🟠 MAJOR | 9 |
| 🟡 MEDIUM | 5 |
| 🔵 LOW | 6 |

**Overall assessment**: Type safety is surprisingly clean — zero `any` types found across all audited files. Error handling is consistent and systematic with try/catch + fallback patterns on every data-fetching function. The provider abstraction layer is well-designed. The main issues are: (1) an entire 429-line module is dead code, (2) two type holes in the provider interface force unsafe casts downstream, (3) module-level mutable state creates a server-side concurrency hazard, and (4) several patterns of inefficiency in the Gateway API client.

---

## 🔴 CRITICAL

### O1 — Entire `dev-freedom.ts` is dead code (429 lines, 0 consumers)
**File**: `src/lib/core/dev-freedom.ts` (all 429 lines)  
**Severity**: CRITICAL — complete waste, zero runtime effect

22 exported symbols (`DevFreedomLevel`, `ResearchQueryResult`, `SpecAnalysisJson`, `PromptFillVars`, `PhaseOutputContext`, `parseDevFreedom`, `fillCursorPrompt`, `buildSpecAnalysis`, `extractExpectedFiles`, `validatePhaseOutput`, etc.) — **zero imports from anywhere in the project**.

```
$ grep -rn "from.*dev-freedom" src/ --include='*.ts' --include='*.svelte'
(no results)
```

This was the old dev-loop spec analysis pipeline before the relay-based architecture. It still references `cursor-implement.txt` templates, Phase 0-7 validation (`validatePhaseOutput`), and `buildGardeningPromptSection`. None of this is wired into the current `relay.js` + `generate.cjs` execution path.

**Action**: Delete the file or re-integrate it into the dev-loop pipeline if these functions are still needed.

---

## 🟠 MAJOR

### O2 — Type hole: `CronJob.schedule: unknown` forces unsafe casts everywhere
**File**: `src/lib/providers/types.ts:8`  
**Severity**: MAJOR — cascading type unsafety

```typescript
export interface CronJob {
  schedule: unknown;  // ← should be a discriminated union
}
```

The actual schedule shape is well-defined: `{ kind: 'every' | 'cron' | 'at', expr?: string, at?: string, everyMs?: number }`. Using `unknown` forces 7 downstream locations to cast via `as Record<string, unknown>` (e.g., `utils.ts:44,49`, `crons.ts:22`, `noema.ts:47`). Every cast is a potential runtime crash if the Gateway changes its schedule format.

**Recommended fix**: Replace with:
```typescript
type CronSchedule =
  | { kind: 'cron'; expr: string }
  | { kind: 'every'; everyMs: number }
  | { kind: 'at'; at: string }
  | string; // legacy string schedules
```

### O3 — `Message.content: string | unknown` — missing discriminated union
**File**: `src/lib/providers/types.ts:90`  
**Severity**: MAJOR — forces `asRecord()` casts in decision-trace.ts

Tool call/result messages have structured content (objects with `toolCallId`, `name`, `arguments`, etc.) but the type declares `content: string | unknown`. This forces the `asRecord()` helper in `decision-trace.ts:107-111` and at least 8 `as Record<string, unknown>` casts throughout the decision trace parser.

**Note**: `src/lib/providers/types.ts` is out of scope for auto-fixes per the task brief, but this is the root cause.

### O4 — Unsafe generic cast: `parseJson<T>` returns unvalidated JSON as `T`
**File**: `src/lib/providers/openclaw.ts:107-112`  
**Severity**: MAJOR — silent type corruption

```typescript
function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;  // ← no runtime validation
  } catch {
    return fallback;
  }
}
```

If the Gateway returns valid JSON in a different shape than expected (e.g., a different API version), this function silently returns the wrong type. Example: `parseJson<{ jobs?: CronJob[] }>(raw, { jobs: [] })` — if the API returns `{ "items": [...] }` instead, it's silently treated as `{ jobs: [] }` with zero errors.

**Recommended**: At minimum, add a type-guard parameter. Better: use Zod or similar runtime validation.

### O5 — Module-level mutable state: `consecutiveSsrFailures`
**File**: `src/lib/core/build-integrity.ts:223-237`  
**Severity**: MAJOR — race condition in SSR server context

```typescript
let consecutiveSsrFailures = 0;           // line 223 — module scope!

export function recordSsrCheckResult(ok: boolean): number {
  if (ok) { consecutiveSsrFailures = 0; }   // write
  else    { consecutiveSsrFailures += 1; }   // read-modify-write
  return consecutiveSsrFailures;
}
```

`getBuildIntegrity()` calls `recordSsrCheckResult()` for every request. In a Node.js SSR server handling concurrent requests, this is a classic read-modify-write race condition. Two simultaneous health checks could both observe the same counter value and produce incorrect alert thresholds.

Additionally, this makes `getBuildIntegrity()` a non-pure function — it mutates hidden state on every call, making testing and reasoning about behavior difficult.

**Recommended**: Store the counter externally (file, database, or at minimum use an `Atomics`-based approach).

### O6 — Gateway token cache never expires
**File**: `src/lib/providers/openclaw.ts:38-53`  
**Severity**: MAJOR — permanent stale token after Gateway restart

```typescript
let _gwToken: string | null = null;
async function resolveGatewayToken(): Promise<string> {
  if (_gwToken) return _gwToken;        // ← once set, never refreshed
  // ... read from config
  _gwToken = cfg?.gateway?.auth?.token ?? "";
  return _gwToken ?? "";
}
```

If the Gateway restarts and generates a new auth token (or the config file is updated), the cached `_gwToken` is **permanently stale**. There's no TTL, no retry-on-401 logic, no invalidation mechanism. The only way to refresh is a process restart.

**Recommended**: Add a TTL (e.g., 5 minutes) or retry on HTTP 401 with token refresh.

### O7 — TOCTOU race on `NODE_TLS_REJECT_UNAUTHORIZED`
**File**: `src/lib/providers/openclaw.ts:70-89`  
**Severity**: MAJOR — environment pollution in concurrent server

```typescript
const prevReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;  // read
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";                // write
try {
  const res = await fetch(url, ...);                           // async gap!
} finally {
  if (prevReject !== undefined)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevReject;     // restore
  else
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
}
```

Between the `=` assignment and the `fetch` resolving, a concurrent request could observe the `"0"` value and skip TLS verification. This is a classic TOCTOU (time-of-check-time-of-use) bug. The same pattern appears in `gatewayHealth()` at line 499.

**Recommended**: Pass the reject-unauthorized setting via the `fetch` `agent` option (Node.js `https.Agent`) instead of mutating the global environment.

### O8 — Dynamic import on every `execCommand` call
**File**: `src/lib/providers/openclaw.ts:472-480`  
**Severity**: MAJOR — unnecessary async overhead

```typescript
async execCommand(cmd: string): Promise<string> {
  const { exec } = await import("node:child_process");  // ← dynamic import every call
  const execAsync = promisify(exec);
  ...
}
```

The dynamic `import("node:child_process")` is re-executed on every shell command invocation. `ToolProvider.execCommand` is called by multiple collectors (health, cpu, logs, etc.), so this overhead hits on every data refresh cycle. The import should be hoisted to the top of the module.

**Recommended**: Move `import { exec } from "node:child_process"` to the top-level imports.

### O9 — Redundant `listSessions` calls in decision trace pipeline
**File**: `src/lib/core/decision-trace.ts:345,374,382`  
**Severity**: MAJOR — N+1 API calls

```typescript
// getDecisionTrace() — called for each of up to 15 sessions:
const sessions = await p.session.listSessions({ limit: 500 });  // call #1 per trace

// getDecisionTraceData() — calls listSessions ONCE, then:
await Promise.all(
  selected.map(async (session) => {
    traces[session.key] = await getDecisionTrace(session.key, p);  // calls it AGAIN
  }),
);
```

`getDecisionTrace()` redundantly calls `listSessions()` just to find the `sessionId`/`sessionKey` mapping for `getHistory()`. Since `getDecisionTraceData()` already has the full session list, `getDecisionTrace()` should accept an optional pre-fetched session parameter.

**Actual call count**: 1 (from `getDecisionTraceData`) + N (from each `getDecisionTrace`) = **16 API calls** for 15 sessions instead of the minimum 1.

### O10 — Decision trace functions integrated but never produce data
**Files**: `src/lib/core/decision-trace.ts`, `src/lib/core/index.ts:18,50-55`  
**Severity**: MAJOR — feature is wired in but always returns empty

```typescript
// index.ts getAllData():
const decisionTrace = {
  sessions: [],
  traces: {},
  defaultSessionKey: "",
  updatedAt: Date.now(),
};  // ← always empty, never calls getDecisionTraceData()
```

`getDecisionTrace()` and `getDecisionTraceData()` are fully implemented (420 lines, tested parsing logic), exported from the barrel, and imported in `index.ts` — but **never invoked**. The UI component (`DecisionTrace.svelte`) renders an empty placeholder on every page load. The `+page.server.ts` also creates its own `emptyDecisionTrace()` fallback.

**This is a feature that's built but not turned on**. Either call it or remove the dead integration.

---

## 🟡 MEDIUM

### O11 — Duplicated JSON parse helpers
**Files**: `src/lib/providers/openclaw.ts:107` (`parseJson`), `src/lib/core/utils.ts:97` (`safeParseJson`)  
**Severity**: MEDIUM — two identical implementations

Both functions do exactly the same thing: `JSON.parse(raw) as T` with a fallback on error. The provider has its own copy; the core uses the one from utils. Consolidate.

### O12 — 6 exported agent helpers never imported
**File**: `src/lib/core/agents.ts:15,16,78,86,96,261`  
**Severity**: MEDIUM — dead exports

These exports have zero consumers outside `agents.ts`:
- `SESSION_ACTIVE_MS` (line 15)
- `SESSION_STUCK_MS` (line 16)
- `sessionAgeMs` (line 78)
- `classifySession` (line 86)
- `summarizeAgentSessions` (line 96)
- `getAgentDetail` (line 261)

These are potentially useful helpers, but currently they're dead weight in the barrel export. Either use them or make them private.

### O13 — `console.warn` in production parsing code
**File**: `src/lib/core/action-parse.ts:50,58,64`  
**Severity**: MEDIUM — production noise

Three `console.warn()` calls in the action syntax parser log to stdout on malformed input. In a production dashboard SSR context, these will pollute server logs. Should use a configurable logger or at least gate on `process.env.NODE_ENV`.

### O14 — Duplicate agent emoji data
**Files**: `src/lib/core/agents.ts:18-65` (AGENT_DEFS), `src/lib/components/shared/agent-icons.ts` (AGENT_ICONS)  
**Severity**: MEDIUM — two sources of truth

Agent emojis are defined in two places:
- `agents.ts` `AGENT_DEFS` array (8 agents with full metadata)
- `agent-icons.ts` `AGENT_ICONS` record (12 entries including system/unknown)

These will inevitably diverge. `AGENT_ICONS` includes `nova`, `albert`, `main`, and `system` — agents that aren't in `AGENT_DEFS`. The two sources should be unified.

### O15 — Empty token cache causes perpetual re-fetch on config failure
**File**: `src/lib/providers/openclaw.ts:38-42`  
**Severity**: MEDIUM — repeated I/O on error

When the Gateway config file can't be read, `_gwToken` is set to `""` (empty string, falsy). On subsequent calls, `if (_gwToken)` evaluates to false, and since `_gwTokenPromise` has been reset to `null` (the promise already resolved), a new `readFile()` is triggered. This means every Gateway API call re-reads the config file from disk.

**Fix**: Cache the failure state too — set a flag like `_gwTokenFailed = true` to prevent repeated reads.

---

## 🔵 LOW

### O16 — Recursive directory traversal without stack safety
**File**: `src/lib/core/utils.ts:122-145` (`countFiles`)  
**Severity**: LOW — depth capped at 3

The `walk()` function is recursive. While `maxDepth` is 3, making stack overflow unlikely, an iterative queue would be more predictable. This is fine at current depth limits but could be a footgun if `maxDepth` is ever increased.

### O17 — Hardcoded project path in noema.ts
**File**: `src/lib/core/noema.ts:34`  
**Severity**: LOW — breaks if project is cloned elsewhere

```typescript
const noemaDir = join(workspace, "projects", "noema");
```

If the noema project is cloned to a different directory name, this silently returns garbage data (zero LOC counts, empty changelog). Should use an env var or config.

### O18 — No JSDoc on core functions in 5 files
**Files**: `decision-trace.ts`, `h1.ts`, `index.ts`, `providers/openclaw.ts`, `dev-freedom.ts`  
**Severity**: LOW — documentation gap

14 of 25 files have only the `@file` header comment. Public API functions in `decision-trace.ts` (`parseHistoryMessages`, `detectLoops`, `detectBottlenecks`) and `h1.ts` (`parseH1Programs`, `parseH1Reports`, `parseH1ViktorStatus`) have no `@param`/`@returns` documentation at all. The complex sequence of JSONL message parsing in `parseHistoryMessages` would particularly benefit from docs.

### O19 — `getDecisionTrace` imported in barrel but never used
**File**: `src/lib/core/index.ts:18`  
**Severity**: LOW — lint warning

```typescript
import { getDecisionTrace, getDecisionTraceData } from "./decision-trace.js";
```

`getDecisionTrace` is imported but never called in `index.ts`. Only the import line references it. A tree-shaking bundler would eliminate it, but it's dead code in the barrel.

### O20 — `CRON_GROUPS` constant is internal-only but not clearly marked
**File**: `src/lib/core/utils.ts:5`  
**Severity**: LOW — minor hygiene

`CRON_GROUPS` is a `const` (not `export`) used only by `emptyCronByGroup()`. It's correctly scoped but the name suggests it could be a shared constant. Renaming to `_CRON_GROUPS` or adding a comment would clarify intent.

### O21 — No Svelte stores — state management is purely server-driven
**Directory**: `src/lib/stores/` — **does not exist**  
**Severity**: INFO

The task brief mentioned `src/lib/stores/` as out-of-scope for fixes. This directory does not exist — Noema has zero client-side Svelte stores. All state is fetched server-side via `getAllData()` and passed as page data through SvelteKit's `+page.server.ts` → `+page.svelte` pattern. This is architecturally fine but means there's no client-side reactive state layer.

---

## ✅ What's Good

1. **Zero `any` types** — Impressive type discipline across 6,735 lines. No unsafe escape hatches.
2. **Consistent error handling** — Every data-fetching function returns a typed fallback with `error?: string` instead of throwing. The pattern `try { ... } catch (err) { return { ...fallback, error: String(err) } }` is consistent across all 14 collector functions.
3. **Clean provider abstraction** — The `AllProviders` interface cleanly separates cron, session, agent, messaging, filesystem, and tool concerns. The factory pattern (`getProvider` / `createProvider`) enables mocking for tests.
4. **API-first architecture** — High-frequency calls (cron list, session list, subagent list) use the Gateway REST API (`gatewayApi()`) instead of CLI spawns. Low-frequency/user-initiated calls use CLI. This is a well-reasoned split.
5. **Deduplication via mutex promises** — H1 caching uses pending-promise mutexes (`programsFetchPromise`, `reportsFetchPromise`, `balanceFetchPromise`, `h1DataPromise`) to prevent duplicate API calls during concurrent `getAllData()` + `collector()` runs. Clean pattern.
6. **Pure transforms well-separated** — `parseHistoryMessages`, `detectLoops`, `detectBottlenecks`, `computeSessionScore` are pure functions with no I/O — easy to unit test.
7. **Mutex cleanup** — All H1 fetch mutexes are properly reset in `finally` blocks, preventing permanent deadlocks.
8. **No O(n²) algorithms** — All data transformations operate in linear or O(n log n) time. The biggest concern is the N+1 API call pattern (O9), not algorithmic complexity.

---

## Recommendations (Priority Order)

1. **Delete or re-integrate `dev-freedom.ts`** — 429 lines of dead code is the single biggest finding.
2. **Fix the two type holes** in `providers/types.ts` — `CronJob.schedule` and `Message.content` drive unsafe casts throughout the codebase.
3. **Remove module-level mutable state** from `build-integrity.ts` — the SSR counter should be scoped to the collector or stored externally.
4. **Add Gateway token TTL + 401 retry** — prevent permanent auth failures after Gateway restart.
5. **Fix TLS env mutation** — use `https.Agent` with `rejectUnauthorized: false` instead of global `process.env` mutation.
6. **Hoist `execCommand`'s dynamic import** — unnecessary per-call overhead.
7. **Fix N+1 API calls in decision trace** — pass pre-fetched session list to `getDecisionTrace()`.
8. **Wire up decision trace data collection** — the feature is fully implemented but never called; either activate it or remove the dead integration.
9. **Consolidate duplicate agent emoji data** — pick one source of truth.
