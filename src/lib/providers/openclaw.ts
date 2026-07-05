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

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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

  const cron: CronProvider = {
    async listCrons(): Promise<CronJob[]> {
      const raw = await runCmd("openclaw", ["cron", "list", "--json"], {
        timeoutMs,
      });
      const parsed = parseJson<{ jobs?: CronJob[] } | CronJob[]>(raw, {
        jobs: [],
      });
      if (Array.isArray(parsed)) return parsed;
      return parsed.jobs ?? [];
    },

    async runCron(jobId: string): Promise<void> {
      await runCmd("openclaw", ["cron", "run", jobId], { timeoutMs: 120_000 });
    },

    async getCronStatus(): Promise<CronStatus> {
      const raw = await runCmd("openclaw", ["cron", "status", "--json"], {
        timeoutMs,
      });
      const parsed = parseJson<Partial<CronStatus>>(raw, {});
      return {
        enabled: parsed.enabled ?? true,
        jobsTotal: parsed.jobsTotal ?? 0,
        jobsEnabled: parsed.jobsEnabled ?? 0,
        nextWakeAtMs: parsed.nextWakeAtMs,
      };
    },

    async getCronRuns(jobId: string): Promise<CronRun[]> {
      const raw = await runCmd(
        "openclaw",
        ["cron", "runs", "--id", jobId, "--json", "--limit", "50"],
        { timeoutMs },
      );
      const parsed = parseJson<{ runs?: CronRun[] } | CronRun[]>(raw, {
        runs: [],
      });
      if (Array.isArray(parsed)) return parsed.map((r) => ({ ...r, jobId }));
      return (parsed.runs ?? []).map((r) => ({ ...r, jobId }));
    },
  };

  const session: SessionProvider = {
    async listSessions(filter: SessionFilter = {}): Promise<Session[]> {
      const args = ["sessions", "--json", "--all-agents"];
      if (filter.agentId) args.push("--agent", filter.agentId);
      if (filter.activeMinutes != null)
        args.push("--active", String(filter.activeMinutes));
      if (filter.limit != null) args.push("--limit", String(filter.limit));
      const raw = await runCmd("openclaw", args, { timeoutMs });
      const parsed = parseJson<{ sessions?: Session[] }>(raw, { sessions: [] });
      return parsed.sessions ?? [];
    },

    async getHistory(sessionKey: string): Promise<Message[]> {
      const raw = await runCmd(
        "openclaw",
        [
          "sessions",
          "export-trajectory",
          "--session-key",
          sessionKey,
          "--json",
        ],
        { timeoutMs: 60_000 },
      );
      const parsed = parseJson<{ messages?: Message[]; turns?: Message[] }>(
        raw,
        {},
      );
      return parsed.messages ?? parsed.turns ?? [];
    },

    async spawnAgent(agentId: string, task: string): Promise<SpawnResult> {
      const raw = await runCmd(
        "openclaw",
        ["agent", "--agent", agentId, "--message", task, "--json"],
        { timeoutMs: 120_000 },
      );
      const parsed = parseJson<{ sessionKey?: string; status?: string }>(
        raw,
        {},
      );
      return {
        sessionKey: parsed.sessionKey ?? `agent:${agentId}:spawn`,
        agentId,
        status: parsed.status ?? "spawned",
      };
    },
  };

  const agent: AgentProvider = {
    async listSubagents(): Promise<Subagent[]> {
      const raw = await runCmd(
        "openclaw",
        ["tasks", "list", "--runtime", "subagent", "--json"],
        { timeoutMs },
      );
      const parsed = parseJson<{ tasks?: Subagent[] } | Subagent[]>(raw, {
        tasks: [],
      });
      const tasks = Array.isArray(parsed) ? parsed : (parsed.tasks ?? []);
      return tasks.map((t) => ({
        id: t.id ?? t.target,
        target: t.target ?? t.id,
        agentId: t.agentId,
        status: t.status ?? "unknown",
        startedAtMs: t.startedAtMs,
        label: t.label,
      }));
    },

    async steerSubagent(target: string, message: string): Promise<void> {
      await runCmd(
        "openclaw",
        ["message", "send", "--session-key", target, "--message", message],
        { timeoutMs },
      );
    },

    async killSubagent(target: string): Promise<void> {
      await runCmd("openclaw", ["tasks", "cancel", target], { timeoutMs });
    },
  };

  const messaging: MessagingProvider = {
    async sendMessage(
      channel: string,
      target: string,
      text: string,
    ): Promise<void> {
      await runCmd(
        "openclaw",
        [
          "message",
          "send",
          "--channel",
          channel,
          "--target",
          target,
          "--message",
          text,
        ],
        { timeoutMs },
      );
    },

    async sessionsSend(sessionKey: string, message: string): Promise<void> {
      await runCmd(
        "openclaw",
        ["message", "send", "--session-key", sessionKey, "--message", message],
        { timeoutMs },
      );
    },
  };

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
      return readFile(
        join(workspace, "memory", "research", relativePath),
        "utf8",
      );
    },
  };

  const tool: ToolProvider = {
    async h1Command(cmd: string): Promise<string> {
      return runCmd(h1Script, cmd.split(/\s+/).filter(Boolean), {
        timeoutMs: 60_000,
      });
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
