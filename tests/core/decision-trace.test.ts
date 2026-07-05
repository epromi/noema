import { describe, it, expect } from "vitest";
import type { Message } from "$lib/providers/types";
import {
  detectBottlenecks,
  detectLoops,
  getDecisionTrace,
  getDecisionTraceData,
  parseHistoryMessages,
} from "$lib/core/decision-trace";
import { createMockProviders } from "./mock-providers";

describe("decision-trace", () => {
  it("parseHistoryMessages pairs tool calls with results", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        timestamp: 1_000,
        content: [
          {
            type: "toolCall",
            id: "call_a",
            name: "read",
            arguments: { path: "memory/rules.md" },
          },
        ],
      },
      {
        role: "toolResult",
        timestamp: 1_500,
        content: {
          toolCallId: "call_a",
          toolName: "read",
          content: [{ type: "text", text: "rules content here" }],
          isError: false,
        },
      },
      {
        role: "assistant",
        timestamp: 2_000,
        content: [
          {
            type: "toolCall",
            id: "call_b",
            name: "exec",
            arguments: { command: "echo ok" },
          },
        ],
      },
      {
        role: "toolResult",
        timestamp: 2_200,
        content: {
          toolCallId: "call_b",
          toolName: "exec",
          content: [{ type: "text", text: "ok" }],
          details: { durationMs: 200 },
        },
      },
    ];

    const steps = parseHistoryMessages(messages, "agent:alfred:main");
    expect(steps).toHaveLength(2);
    expect(steps[0]?.toolName).toBe("read");
    expect(steps[0]?.triggeredBy).toBe("user");
    expect(steps[0]?.outputPreview).toContain("rules content");
    expect(steps[1]?.toolName).toBe("exec");
    expect(steps[1]?.triggeredBy).toBe("call_a");
    expect(steps[1]?.latencyMs).toBe(200);
  });

  it("parseHistoryMessages handles trajectory tool.call / tool.result events", () => {
    const messages: Message[] = [
      {
        role: "tool.call",
        timestamp: Date.parse("2026-07-05T04:14:14.473Z"),
        content: {
          toolCallId: "call_1",
          name: "read",
          arguments: { path: "memory/at-a-glance.md" },
        },
      },
      {
        role: "tool.result",
        timestamp: Date.parse("2026-07-05T04:14:14.509Z"),
        content: {
          message: {
            toolCallId: "call_1",
            toolName: "read",
            content: [{ type: "text", text: "At-a-Glance snapshot" }],
            details: { durationMs: 36, status: "completed" },
          },
        },
      },
    ];

    const steps = parseHistoryMessages(messages, "agent:alfred:main");
    expect(steps).toHaveLength(1);
    expect(steps[0]?.latencyMs).toBe(36);
    expect(steps[0]?.outputPreview).toContain("At-a-Glance");
  });

  it("detectLoops finds repeated tool signatures", () => {
    const steps = [
      makeStep("s1", "read", { path: "a.md" }),
      makeStep("s2", "read", { path: "a.md" }),
      makeStep("s3", "exec", { command: "ls" }),
    ];

    const loops = detectLoops(steps);
    expect(loops).toHaveLength(1);
    expect(loops[0]?.toolName).toBe("read");
    expect(loops[0]?.count).toBe(2);
    expect(loops[0]?.stepIds).toEqual(["s1", "s2"]);
  });

  it("detectBottlenecks flags slow tool calls", () => {
    const steps = [
      makeStep("fast", "read", { path: "x" }, 100),
      makeStep("slow", "exec", { command: "sleep 10" }, 8_000),
    ];

    const bottlenecks = detectBottlenecks(steps, 5_000);
    expect(bottlenecks).toHaveLength(1);
    expect(bottlenecks[0]?.stepId).toBe("slow");
    expect(bottlenecks[0]?.latencyMs).toBe(8_000);
  });

  it("parseHistoryMessages marks loop and bottleneck flags", () => {
    const messages: Message[] = [
      assistantCall("c1", "read", { path: "same.md" }, 1_000),
      toolResult("c1", "read", "out", 1_100),
      assistantCall("c2", "read", { path: "same.md" }, 2_000),
      toolResult("c2", "read", "out", 8_500),
    ];

    const steps = parseHistoryMessages(messages, "agent:viktor:audit");
    expect(steps[0]?.isLoop).toBe(true);
    expect(steps[1]?.isLoop).toBe(true);
    expect(steps[1]?.isBottleneck).toBe(true);
  });

  it("getDecisionTrace loads history via provider", async () => {
    const providers = createMockProviders({
      session: {
        ...createMockProviders().session,
        listSessions: async () => [
          {
            key: "agent:alfred:main",
            agentId: "alfred",
            updatedAt: Date.now(),
          },
        ],
        getHistory: async () => [
          assistantCall("call_x", "read", { path: "AGENTS.md" }, 100),
          toolResult("call_x", "read", "agent instructions", 250),
        ],
      },
    });

    const trace = await getDecisionTrace("agent:alfred:main", providers);
    expect(trace.error).toBeUndefined();
    expect(trace.agentId).toBe("alfred");
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0]?.toolName).toBe("read");
  });

  it("getDecisionTraceData aggregates recent sessions", async () => {
    const now = Date.now();
    const providers = createMockProviders({
      session: {
        ...createMockProviders().session,
        listSessions: async () => [
          {
            key: "agent:alfred:main",
            agentId: "alfred",
            updatedAt: now,
          },
          {
            key: "agent:viktor:spawn",
            agentId: "viktor",
            updatedAt: now - 60_000,
          },
        ],
        getHistory: async (key) => {
          if (key === "agent:alfred:main") {
            return [
              assistantCall("a1", "read", { path: "a" }, 100),
              toolResult("a1", "read", "a", 150),
            ];
          }
          return [
            assistantCall("v1", "exec", { command: "test" }, 200),
            toolResult("v1", "exec", "done", 400),
          ];
        },
      },
    });

    const data = await getDecisionTraceData(providers);
    expect(data.error).toBeUndefined();
    expect(data.sessions).toHaveLength(2);
    expect(data.defaultSessionKey).toBe("agent:alfred:main");
    expect(data.traces["agent:alfred:main"]?.steps).toHaveLength(1);
    expect(data.traces["agent:viktor:spawn"]?.steps[0]?.toolName).toBe(
      "exec",
    );
  });

  it("getDecisionTrace handles provider errors", async () => {
    const providers = createMockProviders({
      session: {
        ...createMockProviders().session,
        getHistory: async () => {
          throw new Error("history unavailable");
        },
      },
    });

    const trace = await getDecisionTrace("agent:alfred:main", providers);
    expect(trace.error).toContain("history unavailable");
    expect(trace.steps).toEqual([]);
  });
});

function makeStep(
  id: string,
  toolName: string,
  args: Record<string, unknown>,
  latencyMs?: number,
) {
  return {
    id,
    index: 0,
    toolName,
    arguments: args,
    argumentsPreview: JSON.stringify(args),
    outputPreview: "out",
    timestampMs: Date.now(),
    latencyMs,
    isError: false,
    isLoop: false,
    isBottleneck: false,
  };
}

function assistantCall(
  id: string,
  name: string,
  args: Record<string, unknown>,
  timestamp: number,
): Message {
  return {
    role: "assistant",
    timestamp,
    content: [{ type: "toolCall", id, name, arguments: args }],
  };
}

function toolResult(
  toolCallId: string,
  toolName: string,
  text: string,
  timestamp: number,
): Message {
  return {
    role: "toolResult",
    timestamp,
    content: {
      toolCallId,
      toolName,
      content: [{ type: "text", text }],
      details: { durationMs: timestamp - 900 },
    },
  };
}
