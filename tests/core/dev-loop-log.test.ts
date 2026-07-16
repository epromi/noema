import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  applyActionOverlay,
  findLogFile,
  getDevLoopLog,
  getRunningDevLoop,
  getDevPackages,
  parseActionOverlay,
  parseEstimatedMinutes,
  parsePackageIndex,
  writeQueueMarker,
} from "$lib/core/dev-loop-log";
import { createMockProviders } from "./mock-providers";

const mockFileContents: Record<string, string> = {};
let mockLogDirFiles: string[] = [];

function fileKey(path: string): string {
  return path.split("/").pop() ?? path;
}

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readdir: vi.fn(async (dir: string) => {
      if (String(dir).endsWith("logs")) {
        return mockLogDirFiles;
      }
      return [];
    }),
    readFile: vi.fn(async (path: string) => {
      const key = String(path);
      if (key.endsWith("INDEX.md")) {
        return [
          "| PKG | Név | Fázis | Roadmap | Méret | Becsült idő | Függőség |",
          "| PKG-014 | Dev Loop Log Viewer | 📋 F2 | F-05 P1 | S | 0.5h | PKG-001 |",
          "| PKG-031 | Package Clarity | 📋 F2 | — | M | 1.5h | PKG-021 |",
          "| PKG-001 | SvelteKit Scaffold | ✅ F5 | — | L | ✅ kész | — |",
        ].join("\n");
      }
      const base = fileKey(key);
      if (base in mockFileContents) {
        return mockFileContents[base] ?? "";
      }
      throw new Error(`ENOENT: ${key}`);
    }),
    writeFile: vi.fn(async (path: string, data: string) => {
      mockFileContents[fileKey(String(path))] = data;
    }),
    unlink: vi.fn(async (path: string) => {
      delete mockFileContents[fileKey(String(path))];
    }),
  };
});

describe("dev-loop-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockFileContents)) delete mockFileContents[key];
    mockLogDirFiles = [
      "cursor-PKG-014-log-viewer.log",
      "dev-PKG-014-log-viewer.log",
      "cursor-PKG-031-package-clarity.log",
      "dev-PKG-031-package-clarity.log",
      "cursor-PKG-013-other.log",
    ];
    mockFileContents["cursor-PKG-014-log-viewer.log"] = "";
    mockFileContents["dev-PKG-014-log-viewer.log"] =
      "dev wrapper\nreal log content here";
    mockFileContents["cursor-PKG-031-package-clarity.log"] = "";
    mockFileContents["dev-PKG-031-package-clarity.log"] =
      "PKG-031 dev loop output";
  });

  it("findLogFile prefers dev-* over empty cursor-*", async () => {
    const path = await findLogFile("/any/logs", "PKG-014-log-viewer");
    expect(path).toContain("dev-PKG-014-log-viewer.log");
  });

  it("getDevLoopLog returns dev log when cursor file is empty", async () => {
    const data = await getDevLoopLog("PKG-014-log-viewer");
    expect(data.content).toContain("real log content here");
    expect(data.content).not.toContain("Betöltés");
  });

  it("getDevLoopLog returns empty-file message for 0-byte log", async () => {
    mockLogDirFiles = ["cursor-PKG-099-empty.log"];
    mockFileContents["cursor-PKG-099-empty.log"] = "";
    const data = await getDevLoopLog("PKG-099-empty");
    expect(data.content).toContain("Üres log fájl");
  });

  it("getDevLoopLog returns queue status when marker exists", async () => {
    mockLogDirFiles = [];
    await writeQueueMarker("PKG-999", 120_000);
    const data = await getDevLoopLog("PKG-999");
    expect(data.content).toContain("Sorba állítva");
    expect(data.content).toContain("Becsült várakozás");
  });

  it("getDevLoopLog returns placeholder when no log or queue", async () => {
    mockLogDirFiles = [];
    const data = await getDevLoopLog("PKG-999");
    expect(data.content).toContain("Még nincs log fájl");
  });

  it("getRunningDevLoop detects running package via provider", async () => {
    const providers = createMockProviders({
      tool: {
        ...createMockProviders().tool,
        execCommand: async () =>
          "promi 12345 bash scripts/dev-loop.sh PKG-014-log-viewer",
      },
    });
    const data = await getRunningDevLoop(providers);
    expect(data.running).toBe("PKG-014-log-viewer");
  });

  it("getDevPackages parses INDEX.md rows with estimated minutes", async () => {
    const data = await getDevPackages();
    expect(data.packages.length).toBe(3);
    expect(data.packages[0]?.id).toBe("PKG-014");
    expect(data.packages[0]?.estimatedMinutes).toBe(30);
    expect(data.packages[1]?.estimatedMinutes).toBe(90);
    expect(data.packages[2]?.done).toBe(true);
  });

  it("parsePackageIndex handles markdown table", () => {
    const rows = parsePackageIndex(
      "| PKG-002 | Cron Data | 📋 F0 | — | S | 45m | PKG-013 |",
    );
    expect(rows).toEqual([
      {
        id: "PKG-002",
        name: "Cron Data",
        phase: "📋 F0",
        done: false,
        estimatedMinutes: 45,
      },
    ]);
  });

  it("parseEstimatedMinutes handles common formats", () => {
    expect(parseEstimatedMinutes("1.5h")).toBe(90);
    expect(parseEstimatedMinutes("30m")).toBe(30);
    expect(parseEstimatedMinutes("2-3h")).toBe(150);
    expect(parseEstimatedMinutes("✅ kész")).toBeNull();
  });

  it("parseActionOverlay parses valid implement entries, letting later lines win", () => {
    const jsonl = [
      JSON.stringify({ id: "PKG-014", action: "implement", status: "pending", ts: "2026-07-16T10:00:00.000Z" }),
      JSON.stringify({ id: "PKG-014", action: "implement", status: "processing", ts: "2026-07-16T10:05:00.000Z" }),
      JSON.stringify({ id: "PKG-031", action: "implement", status: "done", ts: "2026-07-16T09:00:00.000Z", completedAt: "2026-07-16T09:10:00.000Z" }),
    ].join("\n");

    const overlay = parseActionOverlay(jsonl);
    expect(overlay.get("PKG-014")).toEqual({
      status: "processing",
      queuedAt: "2026-07-16T10:05:00.000Z",
      completedAt: undefined,
    });
    expect(overlay.get("PKG-031")).toEqual({
      status: "done",
      queuedAt: "2026-07-16T09:00:00.000Z",
      completedAt: "2026-07-16T09:10:00.000Z",
    });
  });

  it("parseActionOverlay ignores non-implement actions, non-PKG ids, malformed JSON, and invalid statuses", () => {
    const jsonl = [
      JSON.stringify({ id: "decide_thing", action: "delegate", status: "resolved" }),
      JSON.stringify({ id: "PKG-999", action: "investigate", status: "pending" }),
      "not json at all",
      JSON.stringify({ id: "PKG-998", action: "implement", status: "bogus" }),
      "",
      JSON.stringify({ id: "PKG-997", action: "implement", status: "pending" }),
    ].join("\n");

    const overlay = parseActionOverlay(jsonl);
    expect(overlay.size).toBe(1);
    expect(overlay.get("PKG-997")?.status).toBe("pending");
  });

  it("applyActionOverlay merges overlay onto matching ids only", () => {
    const packages = [
      { id: "PKG-014", name: "Log Viewer", phase: "📋 F2", done: false },
      { id: "PKG-031", name: "Package Clarity", phase: "📋 F2", done: false },
    ];
    const overlay = new Map([
      ["PKG-014", { status: "processing" as const, queuedAt: "2026-07-16T10:00:00.000Z" }],
    ]);

    const merged = applyActionOverlay(packages, overlay);
    expect(merged[0]).toMatchObject({ id: "PKG-014", actionStatus: "processing" });
    expect(merged[1]).toEqual(packages[1]);
  });

  it("getDevPackages overlays live JSONL status onto INDEX.md rows", async () => {
    mockFileContents["noema-actions.jsonl"] = [
      JSON.stringify({ id: "PKG-014", action: "implement", status: "processing", ts: "2026-07-16T10:00:00.000Z" }),
    ].join("\n");

    const providers = createMockProviders({
      filesystem: {
        ...createMockProviders().filesystem,
        readState: async (path) => {
          if (path === "noema-actions.jsonl") {
            return mockFileContents["noema-actions.jsonl"] ?? "";
          }
          return "{}";
        },
      },
    });

    const data = await getDevPackages(providers);
    const pkg014 = data.packages.find((p) => p.id === "PKG-014");
    const pkg031 = data.packages.find((p) => p.id === "PKG-031");
    expect(pkg014?.actionStatus).toBe("processing");
    expect(pkg031?.actionStatus).toBeUndefined();
  });

  it("getDevPackages tolerates a missing/unreadable noema-actions.jsonl", async () => {
    const providers = createMockProviders({
      filesystem: {
        ...createMockProviders().filesystem,
        readState: async () => {
          throw new Error("ENOENT");
        },
      },
    });

    const data = await getDevPackages(providers);
    expect(data.packages.length).toBe(3);
    expect(data.packages.every((p) => p.actionStatus === undefined)).toBe(true);
  });
});
