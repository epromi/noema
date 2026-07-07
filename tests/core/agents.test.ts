import { describe, it, expect } from "vitest";
import {
  getAgents,
  getAgentDetail,
  classifySession,
  summarizeAgentSessions,
  sessionAgeMs,
  SESSION_STUCK_MS,
} from "$lib/core/agents";
import type { Session } from "$lib/providers/types";
import { createMockProviders } from "./mock-providers";

const NOW = 1_700_000_000_000;

describe("agents session classification", () => {
  it("sessionAgeMs prefers ageMs over updatedAt", () => {
    const session: Session = {
      key: "a",
      ageMs: 120_000,
      updatedAt: NOW - 999_999,
    };
    expect(sessionAgeMs(session, NOW)).toBe(120_000);
  });

  it("classifySession marks recent sessions as active", () => {
    const session: Session = {
      key: "agent:alfred:main",
      agentId: "alfred",
      updatedAt: NOW - 60_000,
    };
    expect(classifySession(session, NOW)).toBe("active");
  });

  it("classifySession marks aged sessions as idle", () => {
    const session: Session = {
      key: "agent:otto:run",
      agentId: "otto",
      ageMs: 20 * 60 * 1000,
    };
    expect(classifySession(session, NOW)).toBe("idle");
  });

  it("classifySession marks old aborted sessions as stuck", () => {
    const session: Session = {
      key: "agent:viktor:audit",
      agentId: "viktor",
      ageMs: 10 * 60 * 1000,
      abortedLastRun: true,
    };
    expect(classifySession(session, NOW)).toBe("stuck");
  });

  it("classifySession marks very old sessions as stuck", () => {
    const session: Session = {
      key: "agent:scout:old",
      agentId: "scout",
      ageMs: SESSION_STUCK_MS + 1,
    };
    expect(classifySession(session, NOW)).toBe("stuck");
  });

  it("summarizeAgentSessions aggregates counts and overall status", () => {
    const sessions: Session[] = [
      { key: "1", agentId: "alfred", updatedAt: NOW - 30_000 },
      { key: "2", agentId: "alfred", ageMs: 15 * 60 * 1000 },
      { key: "3", agentId: "otto", updatedAt: NOW - 120_000 },
    ];
    const summary = summarizeAgentSessions(sessions, "alfred", NOW);
    expect(summary.total).toBe(2);
    expect(summary.active).toBe(1);
    expect(summary.idle).toBe(1);
    expect(summary.stuck).toBe(0);
    expect(summary.sessionStatus).toBe("active");
    expect(summary.lastActiveMs).toBe(NOW - 30_000);
    expect(summary.uptimeMs).toBeGreaterThan(0);
  });

  it("summarizeAgentSessions prefers stuck when any session is stuck", () => {
    const sessions: Session[] = [
      { key: "1", agentId: "viktor", updatedAt: NOW - 30_000 },
      {
        key: "2",
        agentId: "viktor",
        ageMs: SESSION_STUCK_MS + 5_000,
      },
    ];
    const summary = summarizeAgentSessions(sessions, "viktor", NOW);
    expect(summary.sessionStatus).toBe("stuck");
    expect(summary.stuck).toBe(1);
  });
});

describe("agents", () => {
  it("getAgents returns agent cards via provider", async () => {
    const data = await getAgents(createMockProviders());
    expect(data.total).toBe(8);
    expect(data.agents[0]?.id).toBe("otto");
    expect(data.agents[0]?.memory).toContain("otto status");
    expect(data.agents.find((a) => a.id === "alfred")?.activeSessions).toBe(1);
    expect(data.agents.find((a) => a.id === "alfred")?.sessionStatus).toBe(
      "active",
    );
    expect(data.agents.find((a) => a.id === "alfred")?.lastActive).toBe(
      "just now",
    );
    expect(data.updatedAt).toBeGreaterThan(0);
  });

  it("getAgentDetail returns single agent", async () => {
    const mock = createMockProviders();
    const agent = await getAgentDetail("viktor", mock);
    expect(agent?.name).toBe("Viktor");
    expect(agent?.emoji).toBe("🛡️");
    expect(agent?.spawnCount).toBe(0);
  });

  it("getAgents counts subagent spawns per agent", async () => {
    const mock = createMockProviders({
      agent: {
        listSubagents: async () => [
          {
            id: "t1",
            target: "sub1",
            agentId: "scout",
            status: "running",
          },
          {
            id: "t2",
            target: "sub2",
            agentId: "scout",
            status: "done",
          },
        ],
        steerSubagent: async () => {},
        killSubagent: async () => {},
      },
    });
    const data = await getAgents(mock);
    expect(data.agents.find((a) => a.id === "scout")?.spawnCount).toBe(2);
  });

  it("getAgents handles provider errors", async () => {
    const mock = createMockProviders({
      session: {
        listSessions: async () => {
          throw new Error("sessions down");
        },
        getHistory: async () => [],
        spawnAgent: async (id) => ({
          sessionKey: "",
          agentId: id,
          status: "error",
        }),
      },
    });
    const data = await getAgents(mock);
    expect(data.error).toContain("sessions down");
    expect(data.agents).toEqual([]);
  });
});
