import { describe, it, expect } from "vitest";
import {
  parseLoadavg,
  truncateProcessName,
  classifyLoadLevel,
  aggregateProcesses,
  getCpuData,
} from "$lib/core/cpu";
import { createMockProviders } from "./mock-providers";

describe("cpu", () => {
  it("parseLoadavg extracts load averages and process counts", () => {
    expect(parseLoadavg("3.99 6.56 6.40 2/379 12345")).toEqual({
      load1: 3.99,
      load5: 6.56,
      load15: 6.4,
      runningProcs: 2,
      totalProcs: 379,
    });
  });

  it("parseLoadavg returns null for invalid input", () => {
    expect(parseLoadavg("")).toBeNull();
    expect(parseLoadavg("bad data")).toBeNull();
  });

  it("truncateProcessName shortens long names with ellipsis", () => {
    expect(truncateProcessName("firefox")).toBe("firefox");
    expect(truncateProcessName("a-very-long-process-name")).toBe(
      "a-very-long-process…",
    );
  });

  it("classifyLoadLevel applies core-based thresholds", () => {
    expect(classifyLoadLevel(2, 8)).toBe("ok");
    expect(classifyLoadLevel(6, 8)).toBe("warn");
    expect(classifyLoadLevel(9, 8)).toBe("error");
  });

  it("aggregateProcesses merges same-name processes and filters low CPU", () => {
    const psOutput = [
      "firefox           45.5",
      "openclaw          15.0",
      "openclaw          16.1",
      "gnome-shell       27.3",
      "Web Content        1.5",
      "Web Content        1.5",
      "Web Content        1.5",
      "idle-task          0.5",
    ].join("\n");

    const top = aggregateProcesses(psOutput);
    expect(top).toHaveLength(4);
    expect(top[0]).toEqual({ name: "firefox", cpuPercent: 45.5, count: 1 });
    expect(top[1]).toEqual({ name: "openclaw", cpuPercent: 31.1, count: 2 });
    expect(top[2]).toEqual({ name: "gnome-shell", cpuPercent: 27.3, count: 1 });
    expect(top[3]).toEqual({ name: "Web Content", cpuPercent: 4.5, count: 3 });
  });

  it("aggregateProcesses limits to top 8 by CPU", () => {
    const lines = Array.from({ length: 12 }, (_, i) =>
      `proc${i}  ${(12 - i) * 2}.0`,
    ).join("\n");
    expect(aggregateProcesses(lines)).toHaveLength(8);
    expect(aggregateProcesses(lines)[0]?.name).toBe("proc0");
  });

  it("getCpuData returns parsed metrics via provider", async () => {
    const mock = createMockProviders({
      tool: {
        h1Command: async () => "",
        gogCommand: async () => "",
        execCommand: async (cmd) => {
          if (cmd.includes("loadavg")) return "1.20 1.50 1.80 3/200 999";
          if (cmd.includes("ps -eo")) {
            return "node  12.5\nnode  8.0\nbash  0.2";
          }
          return "";
        },
      },
    });

    const data = await getCpuData(mock);
    expect(data?.load1).toBe(1.2);
    expect(data?.totalProcs).toBe(200);
    expect(data?.coreCount).toBeGreaterThan(0);
    expect(data?.topProcesses).toEqual([
      { name: "node", cpuPercent: 20.5, count: 2 },
    ]);
  });

  it("getCpuData returns undefined when loadavg is invalid", async () => {
    const mock = createMockProviders({
      tool: {
        h1Command: async () => "",
        gogCommand: async () => "",
        execCommand: async () => "",
      },
    });
    expect(await getCpuData(mock)).toBeUndefined();
  });
});
