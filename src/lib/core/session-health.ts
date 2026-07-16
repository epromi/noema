/** @file Deterministic, rule-based agent session health scoring (PKG-011 / F-21). */

import type { AllProviders } from "$lib/providers/types";
import { getProvider } from "$lib/providers";
import type {
  AgentHealthReportData,
  AgentHealthSummary,
  DecisionStep,
  HealthScore,
  ScoreBreakdown,
  ScoreTrend,
  ScoreTrendDirection,
} from "$lib/types";
import { parseHistoryMessages } from "./decision-trace.js";

const SESSION_LIST_LIMIT = 500;
const TREND_WINDOW = 10;
const DECLINE_ALERT_STREAK = 3;

const WEIGHT_COMPLETION = 0.35;
const WEIGHT_EFFICIENCY = 0.3;
const WEIGHT_ERROR_RATE = 0.2;
const WEIGHT_LOOP_PENALTY = 0.15;

const PENDING_OUTPUT = "(no result yet)";

/** True when a session was aborted or timed out (no clean completion signal). */
function isCompleted(steps: DecisionStep[], aborted: boolean): boolean {
  if (aborted) return false;
  return !steps.some((step) => step.outputPreview === PENDING_OUTPUT);
}

function completionScore(steps: DecisionStep[], aborted: boolean): number {
  if (aborted) return 0;
  const hasPending = steps.some(
    (step) => step.outputPreview === PENDING_OUTPUT,
  );
  return hasPending ? 50 : 100;
}

function ratioScore(penalizedCount: number, total: number): number {
  if (total === 0) return 100;
  return Math.max(0, 100 - (penalizedCount / total) * 100);
}

/**
 * Pure scoring function — 0–100 weighted score from a session's parsed
 * decision steps. No I/O, fully deterministic, easy to unit test.
 */
export function computeSessionScore(
  steps: DecisionStep[],
  aborted: boolean,
): {
  score: number;
  breakdown: ScoreBreakdown;
  totalSteps: number;
  errorSteps: number;
  loopSteps: number;
  completed: boolean;
} {
  const totalSteps = steps.length;
  const errorSteps = steps.filter((step) => step.isError).length;
  const loopSteps = steps.filter((step) => step.isLoop).length;

  const breakdown: ScoreBreakdown = {
    completion: completionScore(steps, aborted),
    efficiency: ratioScore(loopSteps + errorSteps, totalSteps),
    errorRate: ratioScore(errorSteps, totalSteps),
    loopPenalty: ratioScore(loopSteps, totalSteps),
  };

  const score = Math.round(
    breakdown.completion * WEIGHT_COMPLETION +
      breakdown.efficiency * WEIGHT_EFFICIENCY +
      breakdown.errorRate * WEIGHT_ERROR_RATE +
      breakdown.loopPenalty * WEIGHT_LOOP_PENALTY,
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    breakdown,
    totalSteps,
    errorSteps,
    loopSteps,
    completed: isCompleted(steps, aborted),
  };
}

function emptyScore(sessionKey: string, error?: string): HealthScore {
  return {
    sessionKey,
    score: 0,
    breakdown: { completion: 0, efficiency: 0, errorRate: 0, loopPenalty: 0 },
    totalSteps: 0,
    errorSteps: 0,
    loopSteps: 0,
    completed: false,
    updatedAt: Date.now(),
    error,
  };
}

/** Load a session's history and compute its 0–100 health score. */
export async function scoreSession(
  sessionKey: string,
  providers?: AllProviders,
): Promise<HealthScore> {
  const p = providers ?? getProvider();
  const nowMs = Date.now();

  try {
    const sessions = await p.session.listSessions({
      limit: SESSION_LIST_LIMIT,
    });
    const session = sessions.find((s) => s.key === sessionKey);
    const messages = await p.session.getHistory(
      sessionKey,
      session?.sessionId,
      session?.agentId,
    );
    const steps = parseHistoryMessages(messages, sessionKey);
    const result = computeSessionScore(steps, session?.abortedLastRun ?? false);

    return {
      sessionKey,
      agentId: session?.agentId,
      ...result,
      updatedAt: nowMs,
    };
  } catch (err) {
    return emptyScore(sessionKey, String(err));
  }
}

function computeDirection(scores: number[]): ScoreTrendDirection {
  if (scores.length < 2) return "stable";
  const first = scores[0] ?? 0;
  const last = scores.at(-1) ?? 0;
  if (last > first) return "improving";
  if (last < first) return "declining";
  return "stable";
}

/** True when the last N scores form a strictly decreasing streak. */
function hasDeclineStreak(
  scores: number[],
  streak = DECLINE_ALERT_STREAK,
): boolean {
  if (scores.length < streak) return false;
  const tail = scores.slice(-streak);
  for (let i = 1; i < tail.length; i++) {
    if ((tail[i] ?? 0) >= (tail[i - 1] ?? 0)) return false;
  }
  return true;
}

function emptyTrend(agentId: string, error?: string): ScoreTrend {
  return {
    agentId,
    points: [],
    direction: "stable",
    alert: false,
    updatedAt: Date.now(),
    error,
  };
}

/** Score + rank an agent's last N sessions (oldest → newest). */
async function scoreAgentSessions(
  agentId: string,
  p: AllProviders,
): Promise<HealthScore[]> {
  const sessions = await p.session.listSessions({
    agentId,
    limit: SESSION_LIST_LIMIT,
  });
  const mine = sessions
    .filter((s) => (s.agentId ?? "unknown") === agentId)
    .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0))
    .slice(-TREND_WINDOW);

  return Promise.all(mine.map((session) => scoreSession(session.key, p)));
}

/** Score an agent's last N sessions (oldest → newest) and detect decline streaks. */
export async function getScoreTrend(
  agentId: string,
  providers?: AllProviders,
): Promise<ScoreTrend> {
  const p = providers ?? getProvider();
  const nowMs = Date.now();

  try {
    const scores = await scoreAgentSessions(agentId, p);
    const points = scores.map((s) => ({
      sessionKey: s.sessionKey,
      score: s.score,
      updatedAt: s.updatedAt,
    }));
    const scoreValues = points.map((pt) => pt.score);

    return {
      agentId,
      points,
      direction: computeDirection(scoreValues),
      alert: hasDeclineStreak(scoreValues),
      updatedAt: nowMs,
    };
  } catch (err) {
    return emptyTrend(agentId, String(err));
  }
}

function summarizeAgentScores(
  agentId: string,
  scores: HealthScore[],
): AgentHealthSummary {
  const scoreValues = scores.map((s) => s.score);
  const averageScore =
    scoreValues.length === 0
      ? 0
      : Math.round(
          scoreValues.reduce((sum, s) => sum + s, 0) / scoreValues.length,
        );

  return {
    agentId,
    averageScore,
    sessionCount: scores.length,
    trend: computeDirection(scoreValues),
    alert: hasDeclineStreak(scoreValues),
    latest: scores.at(-1),
  };
}

/** Roll up health scores for every agent with recent sessions. */
export async function getAgentHealthReport(
  providers?: AllProviders,
): Promise<AgentHealthReportData> {
  const p = providers ?? getProvider();
  const nowMs = Date.now();

  try {
    const sessions = await p.session.listSessions({
      limit: SESSION_LIST_LIMIT,
    });
    const agentIds = [
      ...new Set(sessions.map((s) => s.agentId ?? "unknown")),
    ];

    const scoresByAgent = await Promise.all(
      agentIds.map((agentId) => scoreAgentSessions(agentId, p)),
    );

    return {
      agents: agentIds.map((agentId, i) =>
        summarizeAgentScores(agentId, scoresByAgent[i] ?? []),
      ),
      updatedAt: nowMs,
    };
  } catch (err) {
    return {
      agents: [],
      updatedAt: nowMs,
      error: String(err),
    };
  }
}