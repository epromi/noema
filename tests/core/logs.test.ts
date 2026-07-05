import { describe, it, expect } from "vitest";
import {
  filterLogs,
  getLogs,
  parseLogLevel,
  parseLogLine,
  parseLogTimestamp,
} from "$lib/core/logs";
import { createMockProviders } from "./mock-providers";

describe("logs", () => {
  it("parseLogLevel classifies severity keywords", () => {
    expect(parseLogLevel("2026-07-05 ERROR gateway failed")).toBe("ERROR");
    expect(parseLogLevel("[WARN] disk usage high")).toBe("WARN");
    expect(parseLogLevel("INFO session started")).toBe("INFO");
    expect(parseLogLevel("plain startup line")).toBe("OTHER");
  });

  it("parseLogTimestamp extracts ISO and bracket timestamps", () => {
    expect(parseLogTimestamp("2026-07-05T12:00:00Z INFO ok")).toBe(
      "2026-07-05T12:00:00Z",
    );
    expect(parseLogTimestamp("[Sun 05/03/2026  9:11:17.67] OpenClaw")).toBe(
      "Sun 05/03/2026  9:11:17.67",
    );
    expect(parseLogTimestamp('{"ts":"2026-04-22T17:10:04.475Z","event":"x"}')).toBe(
      "2026-04-22T17:10:04.475Z",
    );
  });

  it("parseLogLine builds structured entries", () => {
    const entry = parseLogLine("2026-07-05 ERROR relay timeout", 1, "relay.log");
    expect(entry?.level).toBe("ERROR");
    expect(entry?.source).toBe("relay.log");
    expect(entry?.timestamp).toBe("2026-07-05");
  });

  it("filterLogs applies All/Errors/Warnings modes", () => {
    const entries = [
      parseLogLine("ERROR one", 1)!,
      parseLogLine("WARN two", 2)!,
      parseLogLine("INFO three", 3)!,
    ];

    expect(filterLogs(entries, "all")).toHaveLength(3);
    expect(filterLogs(entries, "errors")).toEqual([entries[0]]);
    expect(filterLogs(entries, "warnings")).toEqual([entries[1]]);
  });

  it("getLogs returns parsed tail output via provider", async () => {
    const sample = [
      "==> /home/promi/.openclaw/logs/relay.log <==",
      "2026-07-05T10:00:00Z INFO gateway ok",
      "2026-07-05T10:01:00Z ERROR connection reset",
      "2026-07-05T10:02:00Z WARN retry scheduled",
    ].join("\n");

    const providers = createMockProviders({
      tool: {
        ...createMockProviders().tool,
        execCommand: async (cmd) => {
          if (cmd.includes(".openclaw/logs")) return sample;
          return "ok";
        },
      },
    });

    const data = await getLogs(providers);
    expect(data.total).toBe(3);
    expect(data.counts.error).toBe(1);
    expect(data.counts.warn).toBe(1);
    expect(data.counts.info).toBe(1);
    expect(data.entries[0]?.level).toBe("INFO");
    expect(data.updatedAt).toBeGreaterThan(0);
    expect(data.error).toBeUndefined();
  });

  it("getLogs handles provider errors", async () => {
    const providers = createMockProviders({
      tool: {
        ...createMockProviders().tool,
        execCommand: async () => {
          throw new Error("tail failed");
        },
      },
    });

    const data = await getLogs(providers);
    expect(data.error).toContain("tail failed");
    expect(data.entries).toEqual([]);
    expect(data.total).toBe(0);
  });
});
