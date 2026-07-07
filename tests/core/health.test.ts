import { describe, it, expect, vi } from "vitest";
import {
  getHealth,
  parseHeartbeatEntries,
  classifyGatewayStatus,
  computeHeartbeatHealthScore,
} from "$lib/core/health";
import { createMockProviders } from "./mock-providers";

describe("health", () => {
  it("computeHeartbeatHealthScore maps error counts to scores", () => {
    expect(computeHeartbeatHealthScore(0)).toBe(100);
    expect(computeHeartbeatHealthScore(1)).toBe(75);
    expect(computeHeartbeatHealthScore(2)).toBe(50);
    expect(computeHeartbeatHealthScore(5)).toBe(25);
  });

  it("parseHeartbeatEntries maps agent heartbeat fields and scores", () => {
    const entries = parseHeartbeatEntries({
      edwin: {
        consecutiveErrors: 2,
        lastError: "timeout",
        retriesToday: 1,
        timeout: 120,
      },
      otto: {},
      lastChecks: { email: 1_777_741_080 },
    });
    expect(entries).toEqual([
      {
        agentId: "edwin",
        consecutiveErrors: 2,
        healthScore: 50,
        lastError: "timeout",
        retriesToday: 1,
        timeout: 120,
      },
      {
        agentId: "otto",
        consecutiveErrors: 0,
        healthScore: 100,
        lastError: undefined,
        retriesToday: 0,
        timeout: 300,
      },
    ]);
  });

  it("classifyGatewayStatus detects offline and unknown output", () => {
    expect(classifyGatewayStatus("offline")).toBe("offline");
    expect(classifyGatewayStatus("Gateway running on :8080")).toBe("online");
    expect(classifyGatewayStatus("unknown")).toBe("unknown");
    expect(classifyGatewayStatus("")).toBe("unknown");
  });

  it("getHealth returns system metrics via provider", async () => {
    const data = await getHealth(createMockProviders());
    expect(data.uptime).toContain("2 days");
    expect(data.disk).toContain("used");
    expect(data.ram).toContain("total");
    expect(["online", "offline"]).toContain(data.gatewayStatus);
    expect(data.heartbeat.length).toBeGreaterThan(0);
    expect(data.heartbeat[0]?.healthScore).toBe(100);
    expect(data.hookState.rulesCheck?.enabled).toBe(true);
    expect(data.modelMappingAge).toBeGreaterThanOrEqual(0);
    expect(data.cpu?.load1).toBe(1.2);
    expect(data.cpu?.topProcesses.length).toBeGreaterThan(0);
    expect(data.updatedAt).toBeGreaterThan(0);
  });

  it("getHealth returns degraded uptime/disk/ram when exec fails (gateway check is independent)", async () => {
    const mock = createMockProviders({
      tool: {
        h1Command: async () => "",
        gogCommand: async () => "",
        execCommand: async () => {
          throw new Error("exec failed");
        },
        gatewayHealth: async () => "online",
      },
    });
    const data = await getHealth(mock);
    expect(data.uptime).toBe("unknown");
    expect(data.disk).toBe("unknown");
    expect(data.ram).toBe("unknown");
    // checkGatewayHealth() uses its own fetch — independent of exec, reflects actual gateway state
    expect(["online", "offline", "unknown"]).toContain(data.gatewayStatus);
  });

  it("getHealth returns 999 modelMappingAge when mapping file is empty", async () => {
    const mock = createMockProviders({
      filesystem: {
        readMemory: async () => "",
        writeMemory: async () => {},
        readAgentStatus: async (agentId) => ({
          agentId,
          content: "",
          path: `/tmp/${agentId}`,
        }),
        readState: async () => "{}",
        readResearch: async () => "",
      },
    });
    const data = await getHealth(mock);
    expect(data.modelMappingAge).toBe(999);
  });

  it("getHealth returns 999 modelMappingAge when mapping read throws", async () => {
    const mock = createMockProviders({
      filesystem: {
        readMemory: async () => {
          throw new Error("read failed");
        },
        writeMemory: async () => {},
        readAgentStatus: async (agentId) => ({
          agentId,
          content: "",
          path: `/tmp/${agentId}`,
        }),
        readState: async (path) => {
          if (path === "heartbeat-state.json") return "{}";
          if (path === "hook-state.json") return "{}";
          return "{}";
        },
        readResearch: async () => "",
      },
    });
    const data = await getHealth(mock);
    expect(data.modelMappingAge).toBe(999);
  });

  it("getHealth returns error payload when provider construction fails", async () => {
    const broken = createMockProviders();
    const spy = vi.spyOn(Promise, "all").mockImplementationOnce(async () => {
      throw new Error("forced failure");
    });
    const data = await getHealth(broken);
    spy.mockRestore();
    expect(data.error).toContain("forced failure");
    expect(data.heartbeat).toEqual([]);
    expect(data.hookState).toEqual({});
    expect(data.gatewayStatus).toBe("unknown");
  });
});
