/** Provider abstraction layer — framework-agnostic interfaces for external systems. */

export interface CronJob {
  id: string;
  name: string;
  agentId?: string;
  enabled: boolean;
  schedule: unknown;
  status?: string;
  state?: {
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastStatus?: string;
    nextRunAtMs?: number;
    consecutiveErrors?: number;
  };
}

export interface CronRun {
  jobId: string;
  startedAtMs?: number;
  finishedAtMs?: number;
  status?: string;
  durationMs?: number;
  error?: string;
}

export interface CronStatus {
  enabled: boolean;
  jobsTotal: number;
  jobsEnabled: number;
  nextWakeAtMs?: number;
}

export interface SessionFilter {
  agentId?: string;
  activeMinutes?: number;
  limit?: number;
}

export interface Session {
  key: string;
  agentId?: string;
  sessionId?: string;
  updatedAt?: number;
  ageMs?: number;
  model?: string;
  kind?: string;
  totalTokens?: number;
  abortedLastRun?: boolean;
}

export interface Message {
  role: string;
  content: string | unknown;
  timestamp?: number;
  toolName?: string;
}

export interface SpawnResult {
  sessionKey: string;
  agentId: string;
  status: string;
}

export interface Subagent {
  id: string;
  target: string;
  agentId?: string;
  status: string;
  startedAtMs?: number;
  label?: string;
}

export interface AgentStatusFile {
  agentId: string;
  content: string;
  path: string;
}

export interface CronProvider {
  listCrons(): Promise<CronJob[]>;
  runCron(jobId: string): Promise<void>;
  getCronStatus(): Promise<CronStatus>;
  getCronRuns(jobId: string): Promise<CronRun[]>;
}

export interface SessionProvider {
  listSessions(filter?: SessionFilter): Promise<Session[]>;
  /** Read session messages directly from disk — zero CLI spawns. Pass sessionId+agentId for direct file read. */
  getHistory(sessionKey: string, sessionId?: string, agentId?: string): Promise<Message[]>;
  spawnAgent(agentId: string, task: string): Promise<SpawnResult>;
}

export interface AgentProvider {
  listSubagents(): Promise<Subagent[]>;
  steerSubagent(target: string, message: string): Promise<void>;
  killSubagent(target: string): Promise<void>;
}

export interface MessagingProvider {
  sendMessage(channel: string, target: string, text: string): Promise<void>;
  sessionsSend(sessionKey: string, message: string): Promise<void>;
}

export interface FilesystemProvider {
  readMemory(path: string): Promise<string>;
  writeMemory(path: string, content: string): Promise<void>;
  readAgentStatus(agentId: string): Promise<AgentStatusFile>;
  readState(path: string): Promise<string>;
  readResearch(path: string): Promise<string>;
}

export interface ToolProvider {
  h1Command(cmd: string): Promise<string>;
  gogCommand(cmd: string): Promise<string>;
  execCommand(cmd: string): Promise<string>;
  /** Lightweight Gateway health check — returns "online" | "offline". Mock in tests. */
  gatewayHealth(): Promise<string>;
}

export interface AllProviders {
  cron: CronProvider;
  session: SessionProvider;
  agent: AgentProvider;
  messaging: MessagingProvider;
  filesystem: FilesystemProvider;
  tool: ToolProvider;
}
