import { describe, it, expect } from "vitest";
import {
  filterLogsForAgent,
  enrichAgentsData,
} from "$lib/core/agent-detail";
import type { AgentData, LogEntry } from "$lib/types";

const sampleLogs: LogEntry[] = [
  {
    lineNum: 1,
    raw: "2026-07-07 INFO alfred started session",
    level: "INFO",
    message: "2026-07-07 INFO alfred started session",
    timestamp: "2026-07-07",
  },
  {
    lineNum: 2,
    raw: "2026-07-07 ERROR otto compilation failed",
    level: "ERROR",
    message: "2026-07-07 ERROR otto compilation failed",
    timestamp: "2026-07-07",
  },
  {
    lineNum: 3,
    raw: "2026-07-07 WARN generic warning",
    level: "WARN",
    message: "2026-07-07 WARN generic warning",
  },
  {
    lineNum: 4,
    raw: "2026-07-07 INFO Alfred heartbeat ok",
    level: "INFO",
    message: "2026-07-07 INFO Alfred heartbeat ok",
  },
  {
    lineNum: 5,
    raw: "2026-07-07 INFO otto nightly done",
    level: "INFO",
    message: "2026-07-07 INFO otto nightly done",
  },
];

const sampleAgents: AgentData = {
  agents: [
    {
      id: "alfred",
      name: "Alfred",
      emoji: "👔",
      status: "green",
      statusText: "Active",
      staleLevel: 0,
      lastRun: "1d ago",
      schedule: "Active (main)",
      role: "Chief of Staff",
      activeSessions: 1,
      sessionsActive: 1,
      sessionsIdle: 0,
      sessionsStuck: 0,
      sessionStatus: "active",
      spawnCount: 0,
      lastActive: "just now",
      uptime: "5m",
      memory: "# Alfred status\nAll good",
    },
    {
      id: "otto",
      name: "Otto",
      emoji: "🗄️",
      status: "green",
      statusText: "Active",
      staleLevel: 0,
      lastRun: "1d ago",
      schedule: "03:00",
      role: "Back Office",
      activeSessions: 0,
      sessionsActive: 0,
      sessionsIdle: 0,
      sessionsStuck: 0,
      sessionStatus: "idle",
      spawnCount: 0,
      lastActive: "Never",
      uptime: "—",
    },
  ],
  online: 1,
  total: 2,
  stale: 0,
  updatedAt: Date.now(),
};

describe("agent-detail", () => {
  it("filterLogsForAgent matches id or name case-insensitively", () => {
    const logs = filterLogsForAgent(sampleLogs, "alfred", "Alfred", 3);
    expect(logs).toHaveLength(2);
    expect(logs[0]?.message).toContain("heartbeat");
    expect(logs[1]?.message).toContain("alfred started");
  });

  it("filterLogsForAgent returns newest matches first up to limit", () => {
    const logs = filterLogsForAgent(sampleLogs, "otto", "Otto", 2);
    expect(logs).toHaveLength(2);
    expect(logs[0]?.message).toContain("nightly done");
    expect(logs[1]?.message).toContain("compilation failed");
  });

  it("filterLogsForAgent returns empty when no matches", () => {
    expect(filterLogsForAgent(sampleLogs, "scout", "Scout")).toEqual([]);
  });

  it("enrichAgentsData attaches recentLogs per agent", () => {
    const enriched = enrichAgentsData(sampleAgents, sampleLogs);
    expect(enriched.agents[0]?.recentLogs?.length).toBe(2);
    expect(enriched.agents[1]?.recentLogs?.length).toBe(2);
    expect(enriched.agents[0]?.memory).toBe("# Alfred status\nAll good");
  });

  it("enrichAgentsData passes through error payloads unchanged", () => {
    const errored: AgentData = {
      ...sampleAgents,
      agents: [],
      error: "down",
    };
    expect(enrichAgentsData(errored, sampleLogs)).toEqual(errored);
  });
});
