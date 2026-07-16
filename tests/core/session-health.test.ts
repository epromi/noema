import { describe, it, expect } from "vitest";
import type { DecisionStep } from "$lib/types";
import {
  computeSessionScore,
  scoreSession,
  getScoreTrend,
  getAgentHealthReport,
} from "$lib/core/session-health";
import { createMockProviders } from "./mock-providers";

describe("session-health", () => {
  describe("computeSessionScore", () => {
    it("scores a clean, completed session as 100", () => {
      const steps = [makeStep("s1", "read"), makeStep("s2", "exec")];
      const result = computeSessionScore(steps, false);
      expect(result.score).toBe(100);
      expect(result.breakdown).toEqual({
        completion: 100,
        efficiency: 100,
        errorRate: 100,
        loopPenalty: 100,
      });
      expect(result.completed).toBe(true);
      expect(result.totalSteps).toBe(2);
      expect(result.errorSteps).toBe(0);
      expect(result.loopSteps).toBe(0);
    });

    it("scores an empty session (no tool calls) as neutral 100 when not aborted", () => {
      const result = computeSessionScore([], false);
      expect(result.score).toBe(100);
      expect(result.totalSteps).toBe(0);
    });

    it("penalizes aborted/timeout sessions on completion", () => {
      const steps = [makeStep("s1", "read")];
      const result = computeSessionScore(steps, true);
      expect(result.breakdown.completion).toBe(0);
      expect(result.completed).toBe(false);
      expect(result.score).toBeLessThan(100);
    });

    it("penalizes error tool calls on errorRate", () => {
      const steps = [
        makeStep("s1", "read", false),
        makeStep("s2", "exec", true),
      ];
      const result = computeSessionScore(steps, false);
      expect(result.errorSteps).toBe(1);
      expect(result.breakdown.errorRate).toBe(50);
      expect(result.score).toBeLessThan(100);
    });

    it("penalizes looped tool calls on loopPenalty and efficiency", () => {
      const steps = [
        makeStep("s1", "read", false, true),
        makeStep("s2", "read", false, true),
        makeStep("s3", "exec", false, false),
      ];
      const result = computeSessionScore(steps, false);
      expect(result.loopSteps).toBe(2);
      expect(result.breakdown.loopPenalty).toBeCloseTo(33.33, 1);
      expect(result.breakdown.efficiency).toBeCloseTo(33.33, 1);
    });

    it("treats a session with pending (unresolved) steps as partially complete", () => {
      const steps: DecisionStep[] = [
        { ...makeStep("s1", "read"), outputPreview: "(no result yet)" },
      ];
      const result = computeSessionScore(steps, false);
      expect(result.breakdown.completion).toBe(50);
    });
  });

  describe("scoreSession", () => {
    it("scores a session loaded via providers", async () => {
      const providers = createMockProviders({
        session: {
          ...createMockProviders().session,
          listSessions: async () => [
            { key: "agent:alfred:main", agentId: "alfred", updatedAt: Date.now() },
          ],
          getHistory: async () => [
            assistantCall("c1", "read", 100),
            toolResult("c1", "read", false, 150),
          ],
        },
      });

      const score = await scoreSession("agent:alfred:main", providers);
      expect(score.error).toBeUndefined();
      expect(score.agentId).toBe("alfred");
      expect(score.totalSteps).toBe(1);
      expect(score.score).toBe(100);
    });

    it("returns an error payload when the provider throws", async () => {
      const providers = createMockProviders({
        session: {
          ...createMockProviders().session,
          getHistory: async () => {
            throw new Error("boom");
          },
        },
      });

      const score = await scoreSession("agent:alfred:main", providers);
      expect(score.error).toContain("boom");
      expect(score.score).toBe(0);
      expect(score.totalSteps).toBe(0);
    });
  });

  describe("getScoreTrend", () => {
    it("flags a decline alert after 3 consecutive worsening sessions", async () => {
      const now = Date.now();
      const providers = createMockProviders({
        session: {
          ...createMockProviders().session,
          listSessions: async () => [
            { key: "agent:alfred:s1", agentId: "alfred", updatedAt: now - 3000 },
            { key: "agent:alfred:s2", agentId: "alfred", updatedAt: now - 2000 },
            { key: "agent:alfred:s3", agentId: "alfred", updatedAt: now - 1000 },
            {
              key: "agent:alfred:s4",
              agentId: "alfred",
              updatedAt: now,
              abortedLastRun: true,
            },
          ],
          getHistory: async (key: string) => {
            // s1: clean single call → 100
            if (key === "agent:alfred:s1")
              return [
                assistantCall("a", "read", 0),
                toolResult("a", "read", false, 10),
              ];
            // s2: 1 of 2 calls errors → 75
            if (key === "agent:alfred:s2")
              return [
                assistantCall("a", "read", 0),
                toolResult("a", "read", false, 10),
                assistantCall("b", "exec", 20),
                toolResult("b", "exec", true, 30),
              ];
            // s3 + s4: both calls error → 50 (s3) / 15 (s4, aborted)
            return [
              assistantCall("a", "read", 0),
              toolResult("a", "read", true, 10),
              assistantCall("b", "exec", 20),
              toolResult("b", "exec", true, 30),
            ];
          },
        },
      });

      const trend = await getScoreTrend("alfred", providers);
      expect(trend.error).toBeUndefined();
      expect(trend.points).toHaveLength(4);
      expect(trend.alert).toBe(true);
      expect(trend.direction).toBe("declining");
    });

    it("reports stable trend for a single or empty session history", async () => {
      const providers = createMockProviders({
        session: {
          ...createMockProviders().session,
          listSessions: async () => [
            { key: "agent:otto:only", agentId: "otto", updatedAt: Date.now() },
          ],
          getHistory: async () => [],
        },
      });

      const trend = await getScoreTrend("otto", providers);
      expect(trend.points).toHaveLength(1);
      expect(trend.direction).toBe("stable");
      expect(trend.alert).toBe(false);
    });

    it("returns an error payload when listSessions throws", async () => {
      const providers = createMockProviders({
        session: {
          ...createMockProviders().session,
          listSessions: async () => {
            throw new Error("list failed");
          },
        },
      });

      const trend = await getScoreTrend("alfred", providers);
      expect(trend.error).toContain("list failed");
      expect(trend.points).toEqual([]);
    });
  });

  describe("getAgentHealthReport", () => {
    it("summarizes scores grouped by agent", async () => {
      const now = Date.now();
      const providers = createMockProviders({
        session: {
          ...createMockProviders().session,
          listSessions: async () => [
            { key: "agent:alfred:main", agentId: "alfred", updatedAt: now },
            { key: "agent:otto:main", agentId: "otto", updatedAt: now },
          ],
          getHistory: async (key: string) => {
            if (key === "agent:alfred:main")
              return [assistantCall("a", "read", 0), toolResult("a", "read", false, 10)];
            return [];
          },
        },
      });

      const report = await getAgentHealthReport(providers);
      expect(report.error).toBeUndefined();
      expect(report.agents).toHaveLength(2);
      const alfred = report.agents.find((a) => a.agentId === "alfred");
      expect(alfred?.averageScore).toBe(100);
      expect(alfred?.sessionCount).toBe(1);
    });

    it("returns an error payload when listSessions throws", async () => {
      const providers = createMockProviders({
        session: {
          ...createMockProviders().session,
          listSessions: async () => {
            throw new Error("boom");
          },
        },
      });

      const report = await getAgentHealthReport(providers);
      expect(report.error).toContain("boom");
      expect(report.agents).toEqual([]);
    });
  });
});

function makeStep(
  id: string,
  toolName: string,
  isError = false,
  isLoop = false,
): DecisionStep {
  return {
    id,
    index: 0,
    toolName,
    arguments: {},
    argumentsPreview: "",
    outputPreview: "ok",
    timestampMs: Date.now(),
    isError,
    isLoop,
    isBottleneck: false,
  };
}

function assistantCall(id: string, name: string, timestamp: number) {
  return {
    role: "assistant",
    timestamp,
    content: [{ type: "toolCall", id, name, arguments: {} }],
  };
}

function toolResult(
  toolCallId: string,
  toolName: string,
  isError: boolean,
  timestamp: number,
) {
  return {
    role: "toolResult",
    timestamp,
    content: {
      toolCallId,
      toolName,
      content: [{ type: "text", text: isError ? "failed" : "ok" }],
      isError,
    },
  };
}
