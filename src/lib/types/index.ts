/** Shared TypeScript types for Noema dashboard data. */

export type CronGroup = 'NIGHT' | 'MORNING' | 'DAYTIME' | 'EVENING' | 'SPANNING';

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
	updatedAt: number;
	error?: string;
}

export type AgentCardStatus = 'green' | 'yellow' | 'red';

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
	lastError?: string;
	retriesToday?: number;
	timeout?: number;
}

export interface HealthData {
	uptime: string;
	disk: string;
	ram: string;
	gatewayStatus: string;
	heartbeat: HeartbeatEntry[];
	modelMappingAge: number;
	updatedAt: number;
	error?: string;
}

export interface H1Stats {
	open: string;
	signal: string;
	reputation: string;
	trial: string;
	totalReports: number;
}

export interface H1Data {
	stats: H1Stats;
	balance: string;
	programs: string;
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
	severity: 'red' | 'yellow' | 'green';
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
	status?: string;
}

export interface ResearchData {
	totalFiles: number;
	recentFiles: number;
	latestDate: string;
	proposals: ResearchProposal[];
	autoFixCount: number;
	proposeCount: number;
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

export type ImplementState = 'idle' | 'running' | 'done' | 'error' | 'offline';

export interface DashboardMeta {
	loadedAt: number;
}

export interface DashboardData {
	meta: DashboardMeta;
	crons: CronData;
	agents: AgentData;
	health: HealthData;
	h1: H1Data;
	calendar: CalendarData;
	bills: BillsData;
	research: ResearchData;
	noema: NoemaData;
}
