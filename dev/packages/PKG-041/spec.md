# PKG-041: Generalize Dev-Loop for Multi-Project Use

**Státusz**: 📋 F0 | **Méret**: L | **Becsült idő**: 4h | **Deps**: nincs

## Cél

A jelenleg Noema-specifikus `scripts/dev-loop.sh` (886 sor) átalakítása általános célú pipeline engine-é, amely bármelyik projektben használható (Noema, openclaw-plugins, jövőbeli projektek) anélkül hogy a Noema funkcionalitás megtörne.

## Jelenlegi Architektúra

A `scripts/dev-loop.sh` egy monolit shell script, 8 fázissal (Phase 0-7). Tartalmaz általános pipeline logikát ÉS Noema-specifikus implementációkat egy fájlban.

### Noema-specifikus függőségek a jelenlegi kódban

| # | Mi | Hol | Típus |
|---|----|-----|-------|
| 1 | `PROJECT_DIR` hardcode | sor 17 | path |
| 2 | `dev/packages/PKG-*/` package discovery | sor 38-48 | struktúra |
| 3 | `dev-freedom-helper.mjs` (spec-analysis, strategy, prompt, metadata, research, validate) | Phase 1-3 | eszköz |
| 4 | `spec-review-agent.cjs` | Phase 0 | eszköz |
| 5 | `prompts/cursor-implement.txt` template | Phase 3 | fájl |
| 6 | `generate.cjs` dashboard regen | Phase 6b | eszköz |
| 7 | `dev/packages/INDEX.md` update formátum | Phase 6b | struktúra |
| 8 | Architecture check: SVELTE LEAK + SYSTEM CALL + Provider | Phase 5c | szabályok |
| 9 | Missing test check: `src/lib/core/*.ts` vs `tests/core/` | Phase 5b | struktúra |
| 10 | CI: `gh run list --repo epromi/noema` hardcode | Phase 7 | konfig |
| 11 | `spawn-review-agent.cjs` | Phase 5g | eszköz |
| 12 | `memory/state/noema-actions.jsonl` | Phase 5g | struktúra |
| 13 | `validate_phase_output` (dev-freedom-helper) | minden Phase | eszköz |
| 14 | DevFreedom level metadata | Phase 1-2 | koncepció |
| 15 | Research fázis (dev-freedom-helper research) | Phase 1 | eszköz |
| 16 | CI auto-fix hardcoded file list | Phase 7 | konfig |

### Általános (megtartható) részek

- Pipeline struktúra (Phase 0-7 + 5g + 6b)
- **Execution backend pluggable** — `hook_execute()` hívja, nem hardcode-olt Cursor
- Cursor agent futtatás (a Noema conf `hook_execute` implementációjaként)
- Build integrity (`pnpm build`, max 3 retry)
- Lint + format auto-fix loop (3x)
- Expected file verifikáció post-cursor
- Git commit + push
- CI poll + auto-fix (GH Actions)
- Logolás, timing, banner infrastruktúra
- Bash boilerplate (`set -euo pipefail`, színkódok, helper függvények)

## Tervezett Architektúra

### OpenClaw Tool (Plugin-alapú)

A dev-loop egy **általános OpenClaw plugin tool**, nem bash script. Alapértelmezett execution backend: **OpenClaw subagent** — minden OpenClaw felhasználónak működik. A Cursor csak egy extra opció azoknak akik telepítették.

```typescript
// Tool API — hívható bármely agentből vagy CLI-ből
dev_loop({
  pkg: "PKG-041",              // package ID
  project: "noema",             // projekt azonosító
  backend: "subagent"           // "subagent" (default) | "cursor" | "claude" | "manual"
})
```

### Backend Stratégia

| Backend | Elérhetőség | Hogyan működik |
|---------|-------------|---------------|
| **`subagent`** ⭐ | Minden OpenClaw | `api.runtime.subagent.spawn()` → implementációs agent |
| `cursor` | Opcionális | `exec("cursor agent --file ...")` → fallback subagent ha nincs telepítve |
| `claude` | Opcionális | `exec("claude --print ...")` |
| `manual` | Mindig | Prompt kiírása, user kézzel implementál |

### Fájlstruktúra

```
~/.openclaw/plugins/dev-loop/
├── package.json
├── openclaw.plugin.json
├── tsconfig.json
├── index.ts                    # Tool entry point
├── src/
│   ├── types.ts                # DevLoopInput, Phase, Hook, Backend interfaces
│   ├── pipeline.ts             # Core pipeline engine (Phase 0-7)
│   ├── backends/
│   │   ├── subagent.ts         # Alapértelmezett: OpenClaw subagent spawn
│   │   ├── cursor.ts           # Cursor CLI wrapper
│   │   ├── claude.ts           # Claude Code wrapper
│   │   └── manual.ts           # Prompt output + user wait
│   ├── hooks.ts                # Hook interface + default implementations
│   └── project.ts              # Project config loader (discovers conf files)
│
projects/noema/
├── dev-loop.conf.ts            # Noema-specifikus hook-ok (TypeScript)
└── prompts/cursor-implement.txt

projects/openclaw-plugins/
└── dev-loop.conf.ts            # openclaw-plugins hook-ok
```
```

### Pipeline Engine (TypeScript)

A core pipeline egy TypeScript osztály ami a plugin tool-ból hívódik. A konfigurációt és hook-okat a projekt `dev-loop.conf.ts` fájljából olvassa.

```typescript
// src/pipeline.ts — Generic Dev Loop Pipeline Engine

// src/types.ts
interface DevLoopInput {
  pkg: string;          // PKG-041, PLG-001, etc.
  project: string;      // "noema", "openclaw-plugins"
  projectRoot?: string;  // optional: absolute path to project root
  backend?: "subagent" | "cursor" | "claude" | "manual";
  phase?: number;       // optional: start from specific phase
}

interface DevLoopConfig {
  name: string;
  repo: string;
  packagePrefix: "PKG-" | "PLG-" | string;
  projectRoot: string;      // resolved absolute path
  
  // Build system
  build: { command: string; retryMax?: number };
  test: { command: string; coverageJson?: string; threshold?: number };
  lint: { command: string; maxIterations?: number };
  format: { command: string };
  
  // Optional test mapping — key=source dir, value=test dir
  testMapping?: Record<string, string>;
  
  // CI
  ci: { repo: string; autoFixFiles?: string[] };
  
  // Execution
  executionBackend: "subagent" | "cursor" | "claude" | "manual";
  cursorPromptTemplate?: string;   // path to Cursor prompt template
  implementModel?: string;         // model for subagent implementation
  timeout?: number;                // subagent timeout in seconds
  
  // Feature flags
  features: {
    specReview: boolean;
    devFreedom: boolean;
    archCheck: boolean;
    postCommit: boolean;
    reviewAgent: boolean;
  };
}

interface SpecAnalysis {
  name: string;
  size: string;
  effort: string;
  phases: number;
  expectedFiles: string[];
}

class DevLoopPipeline {
  constructor(input: DevLoopInput);
  
  // Load project config (discovers dev-loop.conf.ts from project dir)
  async loadConfig(): Promise<ProjectConfig>;
  
  // Pipeline phases
  async phase0_specReview(specFile: string): Promise<void>;
  async phase1_specAnalysis(specFile: string): Promise<SpecAnalysis>;
  async phase1b_research(specFile: string): Promise<string>;
  async phase2_strategy(specFile: string, analysis: SpecAnalysis): Promise<string>;
  async phase3_cursorPrompt(specFile: string, analysis: SpecAnalysis): Promise<string>;
  async phase4_execute(promptFile: string): Promise<ExecuteResult>;  // ⭐ backend itt dől el
  async phase5_verify(): Promise<VerifyResult>;
  async phase6_commit(): Promise<string>;
  async phase7_ciVerify(): Promise<void>;
  
  // Main entry
  async run(): Promise<RunResult>;
}
```

**Execution Backend Interface**:

```typescript
// src/backends/types.ts
interface ExecutionBackend {
  name: string;
  execute(promptFile: string, context: ExecuteContext): Promise<ExecuteResult>;
}

// src/backends/subagent.ts — DEFAULT
class SubagentBackend implements ExecutionBackend {
  name = "subagent";
  async execute(promptFile: string, ctx: ExecuteContext): Promise<ExecuteResult> {
    // api.runtime.subagent.spawn() — minden OpenClaw-ban elérhető
    const result = await ctx.spawnSubagent({
      task: await fs.readFile(promptFile, "utf-8"),
      model: ctx.config.implementModel || "deepseek/deepseek-v4-pro",
      timeoutSeconds: ctx.config.timeout || 3600
    });
    return { success: result.exitCode === 0, output: result.output };
  }
}

// src/backends/cursor.ts — EXTRA (ha telepítve van)
class CursorBackend implements ExecutionBackend {
  name = "cursor";
  async execute(promptFile: string, ctx: ExecuteContext): Promise<ExecuteResult> {
    const { stdout } = await execAsync(`cursor agent --file "${promptFile}" --print --force --trust`);
    return { success: true, output: stdout };
  }
}

// src/backends/manual.ts — fallback
class ManualBackend implements ExecutionBackend {
  name = "manual";
  async execute(promptFile: string, ctx: ExecuteContext): Promise<ExecuteResult> {
    const prompt = await fs.readFile(promptFile, "utf-8");
    console.log("=== IMPLEMENTATION PROMPT ===");
    console.log(prompt);
    console.log("=============================");
    // Wait for user confirmation
    return { success: true, output: "manual — user handled" };
  }
}
```

**Backend Selection**:

```typescript
// A backend kiválasztása — paraméter > config > default
function resolveBackend(input: DevLoopInput, config: ProjectConfig): ExecutionBackend {
  const backendName = input.backend || config.EXECUTION_BACKEND || "subagent";
  switch (backendName) {
    case "subagent": return new SubagentBackend();   // ⭐ DEFAULT
    case "cursor":   return new CursorBackend();     // extra
    case "claude":   return new ClaudeBackend();     // extra
    case "manual":   return new ManualBackend();     // fallback
    default: throw new Error(`Unknown backend: ${backendName}`);
  }
}
```

**Hook Interface** (TypeScript — a projekt `dev-loop.conf.ts` implementálja):

```typescript
// src/hooks.ts
interface DevLoopHooks {
  // Package Discovery — kikeresi az elérhető package-eket
  listPackages?: (projectRoot: string) => Promise<string[]>;
  
  // Spec Resolution — visszaadja a spec fájlt egy package ID-hoz
  resolveSpecFile?: (pkgId: string, projectRoot: string) => Promise<string>;
  
  // Phase 0: Spec Review — átnézi a spec-et
  specReview?: (ctx: HookContext) => Promise<ReviewResult>;
  
  // Phase 1: Spec Analysis — kinyeri a metaadatokat
  specAnalysis?: (ctx: HookContext) => Promise<SpecAnalysis>;
  
  // Phase 1b: Research (optional)
  research?: (ctx: HookContext) => Promise<string>;
  
  // Phase 2: Strategy — implementációs stratégia
  strategy?: (ctx: HookContext) => Promise<string>;
  
  // Phase 3: Prompt Generation — Cursor/agent prompt
  generatePrompt?: (ctx: HookContext) => Promise<string>;
  
  // Phase Validation (minden phase után)
  validatePhase?: (ctx: HookContext, phaseOutput: unknown) => Promise<ValidationResult>;
  
  // Phase 5c: Architecture Check
  archCheck?: (ctx: HookContext, files: string[]) => Promise<ArchViolation[]>;
  
  // Phase 6b: Post-Commit
  postCommit?: (ctx: HookContext) => Promise<void>;
  
  // Phase 5g: Review Sub-Agent
  reviewAgent?: (ctx: HookContext) => Promise<void>;
}

// HookContext — minden hook megkapja ezt
interface HookContext {
  pkgId: string;
  specFile: string;
  specContent: string;     // pre-loaded spec content
  analysis: SpecAnalysis;   // Phase 1 output (available Phase 2+)
  config: DevLoopConfig;
  projectRoot: string;
  packageDir: string;       // e.g., "dev/packages/PKG-041/"
  log: Logger;              // structured logger
  runCommand: (cmd: string, args?: string[]) => Promise<string>;
  spawnSubagent: (task: string, opts?: SpawnOpts) => Promise<SpawnResult>;
}

// Default: minden hook undefined → pipeline skip-eli amit nem implementálnak
```

### Project Config — dev-loop.conf.ts

Minden projekt biztosít egy `dev-loop.conf.ts`-t a gyökérben ami definiálja a projekt-specifikus beállításokat. A hook-ok opcionálisak — a pipeline minden undefined hook-ot skip-el.

#### Noema példa

```typescript
// projects/noema/dev-loop.conf.ts
import type { DevLoopConfig, DevLoopHooks } from "@openclaw/dev-loop";

export const config: DevLoopConfig = {
  name: "Noema Dashboard",
  repo: "epromi/noema",
  packagePrefix: "PKG-",
  
  // Build system
  build: { command: "pnpm build", retryMax: 3 },
  test: { command: "pnpm test --reporter=verbose --coverage", coverageJson: "coverage/coverage-summary.json", threshold: 70 },
  lint: { command: "npx eslint --fix --quiet src/", maxIterations: 3 },
  format: { command: 'npx prettier --write "src/**/*.{ts,svelte,js,cjs}"' },
  
  // Test mapping — for missing test check
  testMapping: { "src/lib/core": "tests/core" },
  
  // CI
  ci: { 
    repo: "epromi/noema", 
    autoFixFiles: ["generate.cjs", "relay.cjs", "action-processor.cjs"] 
  },
  
  // Execution — alapértelmezés: subagent, de Cursor is használható
  // EXECUTION_BACKEND paraméter felülírja, ha nincs paraméter, ez érvényesül
  executionBackend: "cursor",  // Noema Cursor-t használ (de lehetne "subagent" is)
  cursorPromptTemplate: "prompts/cursor-implement.txt",
  
  // Feature flags
  features: {
    specReview: true,
    devFreedom: true,    // enables specAnalysis + strategy + research
    archCheck: true,
    postCommit: true,
    reviewAgent: true,
  },
};

export const hooks: DevLoopHooks = {
  // === Spec Review (Phase 0) ===
  async specReview(ctx) {
    await ctx.runCommand("node", [
      "--experimental-strip-types",
      "scripts/dev-freedom-helper.mjs",
      "spec-review", ctx.pkgId
    ]);
    return { passed: true };
  },

  // === Spec Analysis (Phase 1) ===
  async specAnalysis(ctx) {
    if (!ctx.config.features.devFreedom) return defaultAnalysis(ctx.specContent);
    const output = await ctx.runCommand("node", [
      "--experimental-strip-types",
      "scripts/dev-freedom-helper.mjs",
      "spec-analysis", ctx.specFile, ctx.pkgId, "/dev/stdout"
    ]);
    return JSON.parse(output);
  },

  // === Research (Phase 1b) ===
  async research(ctx) {
    if (!ctx.config.features.devFreedom) return "";
    return await ctx.runCommand("node", [
      "--experimental-strip-types",
      "scripts/dev-freedom-helper.mjs",
      "research", ctx.specFile,
      `${ctx.packageDir}research-topics.md`
    ]);
  },

  // === Strategy (Phase 2) ===
  async strategy(ctx) {
    if (!ctx.config.features.devFreedom) return "Cursor agent, standard strategy";
    return await ctx.runCommand("node", [
      "--experimental-strip-types",
      "scripts/dev-freedom-helper.mjs",
      "strategy", ctx.specFile, ctx.pkgId, ctx.analysis.size, "/dev/stdout"
    ]);
  },

  // === Prompt (Phase 3) ===
  async generatePrompt(ctx) {
    return await ctx.runCommand("node", [
      "--experimental-strip-types",
      "scripts/dev-freedom-helper.mjs",
      "prompt",
      ctx.config.cursorPromptTemplate || "prompts/cursor-implement.txt",
      ctx.specFile, ctx.pkgId,
      ctx.analysis.size, ctx.analysis.effort
    ]);
  },

  // === Validate (minden phase után) ===
  async validatePhase(ctx, phaseOutput) {
    return await ctx.runCommand("node", [
      "--experimental-strip-types",
      "scripts/dev-freedom-helper.mjs",
      "validate", JSON.stringify(phaseOutput)
    ]);
  },

  // === Architecture Check (Phase 5c) ===
  async archCheck(ctx, files) {
    const violations = [];
    const { readFile } = await import("node:fs/promises");
    for (const f of files) {
      const content = await readFile(`${ctx.projectRoot}/${f}`, "utf-8");
      if (f.startsWith("src/lib/core/") && /from ['"]svelte/.test(content)) {
        violations.push({ file: f, rule: "SVELTE_LEAK", severity: "critical" });
      }
    }
    return violations;
  },

  // === Post-Commit (Phase 6b) ===
  async postCommit(ctx) {
    // INDEX.md update + dashboard regen
    await ctx.runCommand("node", ["generate.cjs"]);
  },

  // === Review Agent (Phase 5g) ===
  async reviewAgent(ctx) {
    await ctx.runCommand("node", [
      "--experimental-strip-types",
      "scripts/spawn-review-agent.cjs", ctx.pkgId
    ]);
  },
};
```

#### openclaw-plugins példa (egyszerűbb)

```typescript
// projects/openclaw-plugins/dev-loop.conf.ts
import type { DevLoopConfig } from "@openclaw/dev-loop";

export const config: DevLoopConfig = {
  name: "OpenClaw Plugins",
  repo: "epromi/openclaw-plugins",
  packagePrefix: "PLG-",
  
  build: { command: "pnpm build", retryMax: 3 },
  test: { command: "pnpm test", coverageJson: "coverage/coverage-summary.json", threshold: 60 },
  lint: { command: "npx eslint --fix --quiet src/", maxIterations: 3 },
  format: { command: 'npx prettier --write "src/**/*.ts"' },
  
  ci: { repo: "epromi/openclaw-plugins" },
  
  // ⭐ ALAPÉRTELMEZÉS: subagent (nem kell Cursor)
  executionBackend: "subagent",
  
  features: {
    specReview: false,   // nincs spec-review-agent
    devFreedom: false,   // nincs dev-freedom-helper
    archCheck: false,
    postCommit: false,
    reviewAgent: false,
  },
};

// Hook-ok: mind undefined → pipeline default-okat használ (skip vagy basic grep)
export const hooks: DevLoopHooks = {
  async specAnalysis(ctx) {
    const content = ctx.specContent;
    const name = content.match(/^# PLG-\d+:\s*(.+)/m)?.[1] || "";
    const size = content.match(/Méret:\s*([SMXL]+)/)?.[1] || "M";
    const effort = content.match(/Becsült idő:\s*(\S+)/)?.[1] || "?";
    const phases = (content.match(/^### F\d/g) || []).length;
    const expectedFiles = [...content.matchAll(/`([^`]+\.(?:ts|json|sh))`/g)].map(m => m[1]);
    return { name, size, effort, phases, expectedFiles };
  },
};
```

## Project Discovery & Loading

A tool automatikusan keresi a `dev-loop.conf.ts`-t:

```
1. dev_loop({ project: "noema" }) → workspace/projects/noema/dev-loop.conf.ts
2. dev_loop({ project: "openclaw-plugins" }) → workspace/projects/openclaw-plugins/dev-loop.conf.ts
3. dev_loop({ project: "noema", projectRoot: "/abs/path" }) → /abs/path/dev-loop.conf.ts
```

A `project` paraméter a workspace-en belüli relatív útvonalat adja meg. Ha `projectRoot` explicit, azt használja. Ha egyik sem található → hiba.

## Error Handling

Minden fázis try/catch-be van csomagolva. Fázis hiba esetén:

```
Phase  Status   Action
─────  ──────   ──────
0-3    FAIL     log + skip (nem blokkol, folytat)
4      FAIL     log + retry (max 3, másodiknál más backend/model)
5      FAIL     log + skip (ellenőrzési hiba → manual review flag)
6-7    FAIL     log + stop (commit/CI hiba → nem folytatjuk)
```

A `runCommand` helper a `HookContext`-ben Promise-t ad vissza, automatikus timeout-tal (alap 300s, konfigurálható).

## CLI + Agent Usage

```bash
# CLI (közvetlen)
openclaw plugin dev-loop --pkg PKG-041 --project noema
openclaw plugin dev-loop --pkg PLG-001 --project openclaw-plugins --backend cursor

# Agent tool (bármely agent hívhatja)
dev_loop({ pkg: "PKG-041", project: "noema" })
dev_loop({ pkg: "PLG-001", project: "openclaw-plugins", backend: "cursor" })
```

## Output & Logging

A pipeline strukturált log-ot használ (`ctx.log` — HookContext része). Minden fázis output-ja:

```
[dev-loop] Phase 0: Spec Review ............ ✅ PASSED (1.2s)
[dev-loop] Phase 1: Spec Analysis ........... ✅ PASSED (0.3s)
[dev-loop] Phase 1b: Research ............... ⏭ SKIPPED (no hook)
[dev-loop] Phase 2: Strategy ................ ✅ PASSED (0.5s)
[dev-loop] Phase 3: Generate Prompt ......... ✅ PASSED (0.2s)
[dev-loop] Phase 4: Execute (subagent) ...... ⏳ RUNNING (agent: implement-PKG-041)
[dev-loop] Phase 4: Execute (subagent) ...... ✅ PASSED (45.3s)
[dev-loop] Phase 5: Verify .................. ✅ PASSED (2.1s)
[dev-loop] Phase 6: Commit .................. ✅ PASSED (0.8s)
[dev-loop] Phase 7: CI Verify ............... ⏳ RUNNING (gh:epromi/noema)
```

A Phase 4 output külön log fájlba íródik: `logs/devloop-{pkg}.log`.



## Átmeneti Terv (Backward Compatibility)

A jelenlegi `dev-loop.sh` bash script **megmarad amíg a plugin stabil nem lesz**. Az átállás fokozatos:

1. **Fázis 1**: Plugin fejlesztése (`~/.openclaw/plugins/dev-loop/`)
2. **Fázis 2**: Noema `dev-loop.conf.ts` megírása — jelenlegi viselkedés 1:1 leképezése TypeScript-re
3. **Fázis 3**: Teszt: Noema pipeline változatlan működése subagent backend-del
4. **Fázis 4**: Cursor backend tesztelése Noema-val
5. **Fázis 5**: openclaw-plugins `dev-loop.conf.ts` — subagent alapértelmezéssel
6. **Fázis 6**: Régi `dev-loop.sh` archívum vagy symlink az új tool-ra

### Változatlan fájlok

Ezek a support fájlok NEM változnak, a Noema conf hook-jaiból továbbra is hívódnak:
- `scripts/dev-freedom-helper.mjs`
- `scripts/spec-review-agent.cjs`
- `scripts/spawn-review-agent.cjs`
- `scripts/dev-loop-bootstrap.sh`
- `prompts/cursor-implement.txt`

## Phase 5b: Test + Coverage — Általánosítás

A jelenlegi Phase 5b hardcode-olja a `src/lib/core/*.ts` → `tests/core/*.test.ts` mapping-et. Ezt a `testMapping` config kulccsal kezeljük:

```typescript
// dev-loop.conf.ts-ban:
testMapping: { "src/lib/core": "tests/core" }
// undefined = skip missing test check
```

## Implementation Plan

### F1: Plugin skeleton (1.5h)
- `~/.openclaw/plugins/dev-loop/` létrehozása
- `package.json`, `openclaw.plugin.json`, `tsconfig.json`
- Core típusok: `DevLoopInput`, `DevLoopConfig`, `DevLoopHooks`, `Backend`, `PhaseResult`
- Backend interface + 3 implementáció: `SubagentBackend` (default), `CursorBackend`, `ManualBackend`
- Backend resolution: paraméter > config > "subagent"

### F2: Pipeline engine (2h)
- `pipeline.ts` — Phase 0-7 + 5g + 6b async pipeline
- Minden phase előtt/után: `validatePhase` hook (ha definiálva)
- Phase 4 (Execute) → backend.execute() — backend-től függően subagent/cursor/manual
- Hook resolution: ha a conf-ban undefined a hook → skip (log + continue)
- Build retry (max 3), lint auto-fix loop (max 3)
- Expected file verifikáció post-execute
- Git commit + push, CI poll

### F3: Noema dev-loop.conf.ts (1h)
- Új fájl: `projects/noema/dev-loop.conf.ts`
- Tartalmazza a 16 Noema-specifikus hook implementációt TypeScript-ben
- DevFreedom helper hívások (`runDevFreedom()` wrapper)
- Arch check: SVELTE LEAK, SYSTEM CALL, Provider pattern
- Post-commit: INDEX.md update + dashboard regen
- `executionBackend: "cursor"` — Noema megtartja a Cursor-t

### F4: openclaw-plugins dev-loop.conf.ts (30min)
- Új fájl: `projects/openclaw-plugins/dev-loop.conf.ts`
- `executionBackend: "subagent"` ⭐ — alapértelmezett, nem kell Cursor
- Egyszerű specAnalysis (basic grep)
- Nincs devFreedom, archCheck, postCommit, reviewAgent

### F5: Teszt + verifikáció (1h)
- Noema pipeline subagent backend-del: teljes PKG futtatás
- Noema pipeline cursor backend-del: teljes PKG futtatás
- openclaw-plugins pipeline subagent backend-del
- Összehasonlítás a régi bash dev-loop kimenettel

## Fájlok

| Fájl | Művelet | Leírás |
|------|---------|--------|
| `~/.openclaw/plugins/dev-loop/` (7 fájl) | ÚJ | Plugin: package.json, plugin.json, tsconfig, index.ts, src/* |
| `projects/noema/dev-loop.conf.ts` | ÚJ | Noema konfiguráció + hook-ok TypeScript-ben |
| `projects/openclaw-plugins/dev-loop.conf.ts` | ÚJ | openclaw-plugins konfiguráció (subagent default) |
| `scripts/dev-freedom-helper.mjs` | VÁLTOZATLAN | Továbbra is használatban a Noema hook-okon keresztül |
| `scripts/spec-review-agent.cjs` | VÁLTOZATLAN | Továbbra is használatban |

Nem változik: `dev-freedom-helper.mjs`, `spec-review-agent.cjs`, `spawn-review-agent.cjs`, `dev-loop-bootstrap.sh`, `dev-log.sh`, `prompts/cursor-implement.txt`

## Acceptance Criteria

- [ ] Plugin telepíthető: `openclaw plugins install dev-loop`
- [ ] Tool hívható bármely agentből: `dev_loop({ pkg: "PKG-041", project: "noema" })`
- [ ] Alapértelmezett backend: `subagent` — OpenClaw sub-agent spawn (mindenkinél működik)
- [ ] Cursor backend: `dev_loop({ pkg: "PKG-041", project: "noema", backend: "cursor" })`
- [ ] Noema pipeline funkcionálisan azonos a jelenlegi bash dev-loop-pal
- [ ] openclaw-plugins pipeline subagent backend-del végigfut
- [ ] Új projekt hozzáadása ≤ 1 fájl (`dev-loop.conf.ts`)
