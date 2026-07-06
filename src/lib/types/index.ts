/** Shared TypeScript types for Noema dashboard data. */

export type CronGroup =
  "NIGHT" | "MORNING" | "DAYTIME" | "EVENING" | "SPANNING";

export interface CronGroupStats {
  total: number;
  healthy: number;
}

export type CronByGroup = Record<CronGroup, CronGroupStats>;

export interface CronEntry {
  id: string;
  name: string;
  agentId: string;
  schedule: string;
  group: CronGroup;
  lastResult: string;
  enabled: boolean;
  lastRunAtMs?: number;
  nextRunAtMs?: number;
  consecutiveErrors: number;
}

export interface CronData {
  crons: CronEntry[];
  healthy: number;
  total: number;
  byGroup: CronByGroup;
  updatedAt: number;
  error?: string;
}

export type AgentCardStatus = "green" | "yellow" | "red";

/** Live session phase for an agent (distinct from card health color). */
export type AgentStatus = "active" | "idle" | "stuck";

export interface AgentEntry {
  id: string;
  name: string;
  emoji: string;
  status: AgentCardStatus;
  statusText: string;
  staleLevel: number;
  lastRun: string;
  schedule: string;
  role: string;
  activeSessions: number;
  sessionsActive: number;
  sessionsIdle: number;
  sessionsStuck: number;
  sessionStatus: AgentStatus;
  spawnCount: number;
  lastActive: string;
  uptime: string;
}

export interface AgentData {
  agents: AgentEntry[];
  online: number;
  total: number;
  stale: number;
  updatedAt: number;
  error?: string;
}

export interface HeartbeatEntry {
  agentId: string;
  consecutiveErrors: number;
  /** 0–100 derived from consecutiveErrors (100 = healthy, ≤25 = stuck). */
  healthScore: number;
  lastError?: string;
  retriesToday?: number;
  timeout?: number;
}

export type GatewayStatus = "online" | "offline" | "unknown";

/** Session hook runtime state from memory/state/hook-state.json. */
export interface HookState {
  reflection?: {
    threshold?: number;
    lastTriggered?: string | null;
    totalRuns?: number;
    totalSkipped?: number;
  };
  kgLookup?: {
    totalLookups?: number;
    staleFlags?: number;
  };
  rulesCheck?: { enabled?: boolean };
  contextInjection?: { enabled?: boolean };
  insightPool?: {
    enabled?: boolean;
    totalChecks?: number;
    totalInsightsFound?: number;
    lastCheck?: string | null;
  };
}

export interface CpuProcess {
  /** Process name (e.g. "firefox") */
  name: string;
  /** Aggregated CPU usage across instances (percent) */
  cpuPercent: number;
  /** Number of running instances with this name */
  count: number;
}

export interface CpuData {
  load1: number;
  load5: number;
  load15: number;
  /** Running processes (from /proc/loadavg field 4) */
  runningProcs: number;
  /** Total processes (from /proc/loadavg field 4) */
  totalProcs: number;
  /** Logical CPU core count — used for load color thresholds */
  coreCount: number;
  /** Top aggregated processes by CPU usage (max 8, >1% only) */
  topProcesses: CpuProcess[];
}

export interface HealthData {
  uptime: string;
  disk: string;
  ram: string;
  gatewayStatus: GatewayStatus;
  heartbeat: HeartbeatEntry[];
  hookState: HookState;
  modelMappingAge: number;
  updatedAt: number;
  cpu?: CpuData;
  error?: string;
}

export interface H1Program {
  id: string;
  handle: string;
  name: string;
  offersBounties: boolean;
  submissionState: string;
  /** BBP / VDP from Scout table */
  programType?: string;
  scopeType?: string;
  bountyRange?: string;
  /** ⭐ PRIMARY when Scout marks recommended as PRIMARY */
  primary?: boolean;
}

export interface H1RecallTrendPoint {
  run: number;
  date: string;
  recall: number;
}

export interface H1PendingRepo {
  name: string;
  priority: string;
  age: string;
}

export interface H1Report {
  id: string;
  title: string;
  state: string;
  createdAt: string;
  severity?: string;
  programHandle?: string;
}

export interface H1Stats {
  open: string;
  signal: string;
  reputation: string;
  trial: string;
  totalReports: number;
  resolved: number;
  duplicates: number;
  pending: number;
  notApplicable: number;
}

export interface H1Signal {
  signal: string;
  reputation: string;
  trial: string;
}

export interface H1ViktorStatus {
  totalCompleted: number;
  recall: number;
  h1Submitted: number;
  h1Accepted: number;
  activeLabel: string;
  circuit: string;
  pending: number;
  failed: number;
  recallTrend: H1RecallTrendPoint[];
  blindSpots: string[];
  pendingRepos: H1PendingRepo[];
}

export interface H1Data {
  stats: H1Stats;
  balance: string;
  balanceAmount: number;
  programs: string;
  programList: H1Program[];
  reports: H1Report[];
  signal: H1Signal;
  viktor: H1ViktorStatus;
  updatedAt: number;
  error?: string;
}

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  calendar?: string;
}

export interface CalendarData {
  events: CalendarEvent[];
  upcoming: number;
  updatedAt: number;
  error?: string;
}

export interface BillEntry {
  id: string;
  desc: string;
  status: string;
}

export interface OpenLoop {
  id: string;
  desc: string;
  age: string;
  severity: "red" | "yellow" | "green";
}

export interface BillsData {
  bills: BillEntry[];
  openLoops: OpenLoop[];
  updatedAt: number;
  error?: string;
}

export interface ResearchProposal {
  id: string;
  finding: string;
  priority: string;
  actions: DashboardActionType[];
  status?: string;
}

export type OttoRunStatus = "ok" | "warn" | "err";

export interface OttoRunStep {
  status: "ok" | "pending";
  label: string;
}

/** Single Otto nightly compilation run for the orchestrator timeline. */
export interface OttoRunEntry {
  title: string;
  date: string;
  summary: string;
  steps: OttoRunStep[];
  status: OttoRunStatus;
}

export interface ResearchData {
  totalFiles: number;
  recentFiles: number;
  latestDate: string;
  proposals: ResearchProposal[];
  autoFixCount: number;
  proposeCount: number;
  ottoRuns: OttoRunEntry[];
  updatedAt: number;
  error?: string;
}

/** Dashboard action relay types (orchestrator kanban + research proposals). */
export type DashboardActionType =
  | "implement"
  | "done"
  | "escalate"
  | "restart"
  | "trigger"
  | "investigate"
  | "activate"
  | "paid";

export interface ActionQueueItem {
  id: string;
  desc: string;
  meta: string;
  actions: DashboardActionType[];
}

export interface ActionQueueData {
  auto: ActionQueueItem[];
  alfred: ActionQueueItem[];
  andras: ActionQueueItem[];
  updatedAt: number;
  error?: string;
}

export interface NoemaMetrics {
  healthScore: number;
  cronsHealthy: number;
  cronsTotal: number;
  totalLoc: number;
  activeProposals: number;
}

export interface NoemaData {
  metrics: NoemaMetrics;
  changelog: string;
  architecture: string;
  updatedAt: number;
  error?: string;
}

export type BrainstormSectionKey =
  "autoexec" | "autonotify" | "approval" | "weekend" | "backlog";

export type BrainstormItemStatus = "done" | "waiting" | "pending";

export interface BrainstormItem {
  id: string;
  name: string;
  status: BrainstormItemStatus;
  done: boolean;
  source?: string;
  age?: string;
}

export interface BrainstormSection {
  key: BrainstormSectionKey;
  label: string;
  desc: string;
  color: string;
  bgColor?: string;
  items: BrainstormItem[];
}

export interface BrainstormData {
  sections: BrainstormSection[];
  pending: number;
  updatedAt: number;
  error?: string;
}

export interface DevPackageEntry {
  id: string;
  name: string;
  phase: string;
  done: boolean;
}

export interface DevPackagesData {
  packages: DevPackageEntry[];
  updatedAt: number;
  error?: string;
}

export interface DevLoopLogData {
  pkgId: string;
  content: string;
  updatedAt: number;
  error?: string;
}

export interface DevLoopRunningData {
  running: string | null;
  updatedAt: number;
  error?: string;
}

/** Dev-loop floating indicator: next processor run + queue + active package. */
export interface DevJobStatus {
  nextMs: number;
  queue: number;
  running: string | null;
  updatedAt: number;
  error?: string;
}

export type ImplementState = "idle" | "running" | "done" | "error" | "offline";

export interface DashboardMeta {
  loadedAt: number;
}

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "OTHER";

export type LogFilter = "all" | "errors" | "warnings";

export interface LogEntry {
  lineNum: number;
  raw: string;
  level: LogLevel;
  timestamp?: string;
  message: string;
  source?: string;
}

export interface LogCounts {
  error: number;
  warn: number;
  info: number;
  other: number;
}

export interface LogData {
  entries: LogEntry[];
  total: number;
  counts: LogCounts;
  updatedAt: number;
  error?: string;
}

export type AuditEventType =
  | "SESSION_START"
  | "AGENT_SPAWN"
  | "CRON_TRIGGER"
  | "CRON_COMPLETE"
  | "ERROR"
  | "ACTION";

export type AuditTimeRange = "24h" | "7d" | "all";

export type AuditEventFilter = AuditEventType | "all";

export type AuditSeverity = "info" | "warn" | "error";

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestampMs: number;
  title: string;
  detail?: string;
  agentId?: string;
  sessionKey?: string;
  cronJobId?: string;
  severity: AuditSeverity;
}

export type AuditEventCounts = Record<AuditEventType, number>;

export interface AuditTrailFilter {
  sessionKey?: string;
  agentId?: string;
  eventType?: AuditEventFilter;
  timeRange?: AuditTimeRange;
}

export interface AuditTrailData {
  events: AuditEvent[];
  total: number;
  sessions: string[];
  agents: string[];
  counts: AuditEventCounts;
  updatedAt: number;
  error?: string;
}

/** Single tool invocation in an agent session decision chain. */
export interface DecisionStep {
  id: string;
  index: number;
  toolName: string;
  arguments: Record<string, unknown>;
  argumentsPreview: string;
  outputPreview: string;
  timestampMs: number;
  latencyMs?: number;
  isError: boolean;
  triggeredBy?: string;
  isLoop: boolean;
  isBottleneck: boolean;
}

/** Repeated tool call pattern within a session trace. */
export interface DecisionLoop {
  toolName: string;
  signature: string;
  stepIds: string[];
  count: number;
}

/** Slow tool call flagged as a bottleneck. */
export interface DecisionBottleneck {
  stepId: string;
  toolName: string;
  latencyMs: number;
}

export interface DecisionTraceSessionOption {
  key: string;
  agentId?: string;
  label: string;
  updatedAt?: number;
}

/** Parsed decision trace for one session. */
export interface DecisionTrace {
  sessionKey: string;
  agentId?: string;
  steps: DecisionStep[];
  loops: DecisionLoop[];
  bottlenecks: DecisionBottleneck[];
  updatedAt: number;
  error?: string;
}

/** Dashboard payload: session list + traces keyed by session key. */
export interface DecisionTraceData {
  sessions: DecisionTraceSessionOption[];
  traces: Record<string, DecisionTrace>;
  defaultSessionKey: string;
  updatedAt: number;
  error?: string;
}

export interface BuildIntegrityData {
  ok: boolean;
  /** True after 3 consecutive SSR health failures. */
  alert: boolean;
  consecutiveFailures: number;
  lastCheckAt: number;
  bytes?: number;
  lastError?: string;
  updatedAt: number;
}

export interface DashboardData {
  meta: DashboardMeta;
  crons: CronData;
  agents: AgentData;
  health: HealthData;
  buildIntegrity: BuildIntegrityData;
  h1: H1Data;
  calendar: CalendarData;
  bills: BillsData;
  research: ResearchData;
  brainstorm: BrainstormData;
  noema: NoemaData;
  actionQueue: ActionQueueData;
  logs: LogData;
  auditTrail: AuditTrailData;
  decisionTrace: DecisionTraceData;
}

/** SSR page load payload (+page.server.ts → +page.svelte). */
export interface NoemaPageData extends DashboardData {
  devPackages: DevPackagesData;
  hostname: string;
}
