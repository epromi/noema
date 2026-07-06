import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  AgentProvider,
  AgentStatusFile,
  AllProviders,
  CronJob,
  CronProvider,
  CronRun,
  CronStatus,
  FilesystemProvider,
  Message,
  MessagingProvider,
  Session,
  SessionFilter,
  SessionProvider,
  SpawnResult,
  Subagent,
  ToolProvider,
} from "./types.js";

const execFileAsync = promisify(execFile);

// ── Gateway REST API client ────────────────────────────────────────────────
// ⚡ NO child process spawns — HTTP calls to the single Gateway process.
// This replaces runCmd("openclaw", ...) for high-frequency collector calls.
// On-demand / user-initiated calls (spawnAgent, getHistory, sendMessage) stay on CLI.

const GATEWAY_URL = "http://localhost:18789/tools/invoke";
// ⚠️ Gateway uses self-signed TLS on 18789. Use HTTP on loopback (safe — never leaves the machine).
// If Gateway enforces HTTPS, we use the rejectUnauthorized workaround below.

let _gwToken: string | null = null;
let _gwTokenPromise: Promise<string> | null = null;

async function resolveGatewayToken(): Promise<string> {
  if (_gwToken) return _gwToken;
  if (_gwTokenPromise) return _gwTokenPromise;
  _gwTokenPromise = (async (): Promise<string> => {
    try {
      const cfgPath = join(homedir(), ".openclaw", "openclaw.json");
      const raw = await readFile(cfgPath, "utf8");
      const cfg = JSON.parse(raw);
      _gwToken = cfg?.gateway?.auth?.token ?? "";
    } catch {
      console.warn("[noema:openclaw] Failed to read gateway token from config");
      _gwToken = "";
    }
    return _gwToken ?? "";
  })();
  return _gwTokenPromise;
}

interface GatewayResponse {
  ok: boolean;
  result?: {
    content?: Array<{ type: string; text: string }>;
  };
  error?: { message?: string };
}

async function gatewayApi(
  params: Record<string, unknown>,
  timeoutMs = 15_000,
): Promise<string> {
  const token = await resolveGatewayToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  // Allow self-signed TLS cert on localhost (Gateway uses auto-generated certs)
  const prevReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  
  try {
    const url = GATEWAY_URL.replace("http://", "https://");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    const json: GatewayResponse = await res.json();
    const text = json?.result?.content?.[0]?.text ?? "";
    if (!text && !json.ok) {
      throw new Error(json?.error?.message ?? `Gateway API failed (${res.status})`);
    }
    return text;
  } finally {
    clearTimeout(timer);
    // Restore previous TLS setting
    if (prevReject !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevReject;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }
  }
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Legacy CLI runner — ONLY for on-demand/user-initiated calls.
 * ⚠️ Spawns a child process. NOT for high-frequency collector use.
 */
async function runCmd(
  cmd: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<string> {
  const { stdout } = await execFileAsync(cmd, args, {
    cwd: options.cwd,
    timeout: options.timeoutMs ?? 30_000,
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
  });
  return stdout.trim();
}

export interface OpenClawConfig {
  workspace?: string;
  h1Script?: string;
  timeoutMs?: number;
}

function workspaceRoot(config?: OpenClawConfig): string {
  return (
    config?.workspace ??
    process.env.WORKSPACE ??
    join(homedir(), ".openclaw", "workspace")
  );
}

function agentStatusPath(workspace: string, agentId: string): string {
  const map: Record<string, string> = {
    otto: "agents/back-office/status.md",
    viktor: "agents/security-analyst/status.md",
    scout: "agents/scout/status.md",
    porter: "agents/porter/status.md",
    edwin: "agents/jarvis-driver/status.md",
    hugo: "agents/prep-agent/status.md",
    cortex: "agents/cortex/status.md",
    alfred: "agents/alfred/status.md",
    albert: "agents/albert/status.md",
    helm: "agents/helm/status.md",
  };
  return join(workspace, map[agentId] ?? `agents/${agentId}/status.md`);
}

export function createOpenClawProviders(
  config: OpenClawConfig = {},
): AllProviders {
  const workspace = workspaceRoot(config);
  const timeoutMs = config.timeoutMs ?? 30_000;
  const h1Script = config.h1Script ?? join(workspace, "scripts", "h1.sh");

  // ── Cron Provider ──────────────────────────────────────────────────────
  const cron: CronProvider = {
    // ⚡ API — high frequency (every 60s collector + audit-trail)
    async listCrons(): Promise<CronJob[]> {
      const raw = await gatewayApi({ tool: "cron", action: "list" }, 10_000);
      const parsed = parseJson<{ jobs?: CronJob[] } | CronJob[]>(raw, { jobs: [] });
      if (Array.isArray(parsed)) return parsed;
      return parsed.jobs ?? [];
    },

    // ⚡ CLI — on-demand only (user clicks "Run" in dashboard)
    async runCron(jobId: string): Promise<void> {
      await runCmd("openclaw", ["cron", "run", jobId], { timeoutMs: 120_000 });
    },

    // ⚡ API — high frequency (collector + audit-trail)
    async getCronStatus(): Promise<CronStatus> {
      const raw = await gatewayApi({ tool: "cron", action: "status" }, 10_000);
      const parsed = parseJson<Partial<CronStatus>>(raw, {});
      return {
        enabled: parsed.enabled ?? true,
        jobsTotal: parsed.jobsTotal ?? 0,
        jobsEnabled: parsed.jobsEnabled ?? 0,
        nextWakeAtMs: parsed.nextWakeAtMs,
      };
    },

    // ⚡ Optimized — extracts run info from cron list (1 API call vs N CLI calls)
    // The cron list already includes lastRunStatus, lastDurationMs, etc. per job.
    async getCronRuns(jobId: string): Promise<CronRun[]> {
      try {
        const raw = await gatewayApi({ tool: "cron", action: "list" }, 10_000);
        const parsed = parseJson<{ jobs?: (CronJob & { state?: Record<string, unknown> })[] }>(
          raw,
          { jobs: [] },
        );
        const jobs = Array.isArray(parsed) ? parsed : (parsed.jobs ?? []);
        const job = jobs.find((j) => j.id === jobId);
        if (!job?.state) return [];
        const s = job.state;
        // Reconstruct a run record from the job state
        return [{
          jobId,
          status: (s.lastStatus ?? s.lastRunStatus) as string ?? "unknown",
          startedAtMs: (s.lastRunAtMs as number) ?? 0,
          durationMs: (s.lastDurationMs as number) ?? 0,
          error: (s.lastError as string) ?? undefined,
        }];
      } catch {
        return [];
      }
    },
  };

  // ── Session Provider ───────────────────────────────────────────────────
  const session: SessionProvider = {
    // ⚡ API — high frequency (collector ×3: agents, audit-trail, decision-trace)
    async listSessions(filter: SessionFilter = {}): Promise<Session[]> {
      try {
        const params: Record<string, unknown> = {
          tool: "sessions_list",
          limit: filter.limit ?? 500,
        };
        if (filter.agentId) params.agentId = filter.agentId;
        if (filter.activeMinutes) params.activeMinutes = filter.activeMinutes;
        const raw = await gatewayApi(params, 15_000);
        const parsed = parseJson<{ sessions?: Session[]; count?: number }>(raw, { sessions: [] });
        return parsed.sessions ?? [];
      } catch {
        return [];
      }
    },

    // ⚡ CLI — on-demand only (decision-trace detail view, not collector)
    async getHistory(sessionKey: string): Promise<Message[]> {
      // ⚠️ This spawns a CLI process — acceptable for on-demand use only.
      try {
        const raw = await runCmd(
          "openclaw",
          ["sessions", "export-trajectory", "--session-key", sessionKey, "--json"],
          { timeoutMs: 60_000 },
        );
        const parsed = parseJson<{
          messages?: Message[];
          turns?: Message[];
          outputDir?: string;
        }>(raw, {});

        if (parsed.messages?.length) return parsed.messages;
        if (parsed.turns?.length) return parsed.turns;

        if (parsed.outputDir) {
          const eventsPath = join(parsed.outputDir, "events.jsonl");
          const eventsRaw = await readFile(eventsPath, "utf8");
          const messages: Message[] = [];

          for (const line of eventsRaw.trim().split("\n")) {
            if (!line.trim()) continue;
            const event = parseJson<{
              type?: string;
              ts?: string;
              data?: Record<string, unknown>;
            }>(line, {});

            if (event.type !== "tool.call" && event.type !== "tool.result") continue;

            messages.push({
              role: event.type,
              content: event.data ?? {},
              timestamp: event.ts ? Date.parse(event.ts) : undefined,
              toolName:
                typeof event.data?.name === "string"
                  ? event.data.name
                  : typeof event.data?.message === "object" &&
                      event.data.message &&
                      "toolName" in event.data.message
                    ? String(
                        (event.data.message as { toolName?: string }).toolName,
                      )
                    : undefined,
            });
          }
          return messages;
        }
      } catch {
        // History is optional — return empty on failure
      }
      return [];
    },

    // ⚡ CLI — on-demand only (user clicks "Spawn Agent" in dashboard)
    async spawnAgent(agentId: string, task: string): Promise<SpawnResult> {
      const raw = await runCmd(
        "openclaw",
        ["agent", "--agent", agentId, "--message", task, "--json"],
        { timeoutMs: 120_000 },
      );
      const parsed = parseJson<{ sessionKey?: string; status?: string }>(raw, {});
      return {
        sessionKey: parsed.sessionKey ?? `agent:${agentId}:spawn`,
        agentId,
        status: parsed.status ?? "spawned",
      };
    },
  };

  // ── Agent Provider ─────────────────────────────────────────────────────
  const agent: AgentProvider = {
    // ⚡ API — high frequency (collector ×2: agents, audit-trail)
    async listSubagents(): Promise<Subagent[]> {
      try {
        const raw = await gatewayApi({ tool: "subagents", action: "list" }, 10_000);
        const parsed = parseJson<{
          active?: Subagent[];
          tasks?: Subagent[];
        }>(raw, { active: [] });
        const tasks = parsed.active ?? parsed.tasks ?? [];
        return tasks.map((t) => ({
          id: t.id ?? t.target,
          target: t.target ?? t.id,
          agentId: t.agentId,
          status: t.status ?? "unknown",
          startedAtMs: t.startedAtMs,
          label: t.label,
        }));
      } catch {
        return [];
      }
    },

    // ⚡ CLI — on-demand only (user interaction)
    async steerSubagent(target: string, message: string): Promise<void> {
      await runCmd(
        "openclaw",
        ["message", "send", "--session-key", target, "--message", message],
        { timeoutMs },
      );
    },

    // ⚡ CLI — on-demand only (user interaction)
    async killSubagent(target: string): Promise<void> {
      await runCmd("openclaw", ["tasks", "cancel", target], { timeoutMs });
    },
  };

  // ── Messaging Provider ─────────────────────────────────────────────────
  const messaging: MessagingProvider = {
    // ⚡ CLI — on-demand only (user-initiated messages)
    async sendMessage(channel: string, target: string, text: string): Promise<void> {
      await runCmd(
        "openclaw",
        ["message", "send", "--channel", channel, "--target", target, "--message", text],
        { timeoutMs },
      );
    },

    // ⚡ CLI — on-demand only
    async sessionsSend(sessionKey: string, message: string): Promise<void> {
      await runCmd(
        "openclaw",
        ["message", "send", "--session-key", sessionKey, "--message", message],
        { timeoutMs },
      );
    },
  };

  // ── Filesystem Provider ────────────────────────────────────────────────
  const filesystem: FilesystemProvider = {
    async readMemory(relativePath: string): Promise<string> {
      return readFile(join(workspace, "memory", relativePath), "utf8");
    },
    async writeMemory(relativePath: string, content: string): Promise<void> {
      await writeFile(join(workspace, "memory", relativePath), content, "utf8");
    },
    async readAgentStatus(agentId: string): Promise<AgentStatusFile> {
      const filePath = agentStatusPath(workspace, agentId);
      const content = await readFile(filePath, "utf8");
      return { agentId, content, path: filePath };
    },
    async readState(relativePath: string): Promise<string> {
      return readFile(join(workspace, "memory", "state", relativePath), "utf8");
    },
    async readResearch(relativePath: string): Promise<string> {
      return readFile(join(workspace, "memory", "research", relativePath), "utf8");
    },
  };

  // ── Tool Provider ──────────────────────────────────────────────────────
  const tool: ToolProvider = {
    async h1Command(cmd: string): Promise<string> {
      return runCmd(h1Script, cmd.split(/\s+/).filter(Boolean), { timeoutMs: 60_000 });
    },
    async gogCommand(cmd: string): Promise<string> {
      const parts = cmd.trim().split(/\s+/);
      const sub = parts[0] === "gog" ? parts.slice(1) : parts;
      return runCmd("gog", sub, { timeoutMs: 30_000 });
    },
    async execCommand(cmd: string): Promise<string> {
      const { exec } = await import("node:child_process");
      const execAsync = promisify(exec);
      const { stdout } = await execAsync(cmd, {
        cwd: workspace,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        encoding: "utf8",
      });
      return stdout.trim();
    },
  };

  return { cron, session, agent, messaging, filesystem, tool };
}

/** Resolve file age in days (for agent staleness). */
export async function fileAgeDays(filePath: string): Promise<number> {
  try {
    const s = await stat(filePath);
    return Math.floor((Date.now() - s.mtimeMs) / 86_400_000);
  } catch {
    return 999;
  }
}

export { workspaceRoot };
